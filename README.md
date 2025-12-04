# FHIRPath-Indexed Static IG Viewer

A proof-of-concept for rendering large FHIR Implementation Guides (IGs) dynamically in the browser, using pre-indexed FHIRPath expressions materialized into SQLite.

## Problem

The HL7 IG Publisher generates static HTML for every resource in an IG. For large IGs with O(100K) resources, this is extremely slow. Additionally, views that need to query across all resources (e.g., "show all medications by therapeutic class") require evaluating FHIRPath expressions at runtime, which is too slow for browser-based rendering.

## Solution

Instead of pre-generating HTML, we:

1. **Pre-compute FHIRPath expressions at build time** using fhirpath.js
2. **Materialize results into SQLite** with full path provenance
3. **Ship a static web app** that queries the SQLite database using sql.js
4. **Render views dynamically** based on YAML view definitions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUILD TIME (CI)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ FHIR        │    │ View        │    │ Indexer             │ │
│  │ Resources   │───▶│ Definitions │───▶│ (fhirpath.js)       │ │
│  │ (NDJSON)    │    │ (YAML)      │    │                     │ │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │
│                                                    │            │
│                                                    ▼            │
│                                        ┌─────────────────────┐ │
│                                        │ SQLite Database     │ │
│                                        │ - fhirpath_index    │ │
│                                        │ - expressions       │ │
│                                        │ - views             │ │
│                                        └─────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Deploy to GitHub Pages
┌─────────────────────────────────────────────────────────────────┐
│                      RUNTIME (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ index.html  │    │ sql.js      │    │ SQLite DB           │ │
│  │ (Static JS) │───▶│ (WASM)      │───▶│ (pre-indexed)       │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                                        │              │
│         ▼                                        ▼              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Dynamic View Rendering                   ││
│  │  - Tables with pagination                                   ││
│  │  - Filters (from pre-indexed distinct values)               ││
│  │  - Technical details showing FHIRPath expressions           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. View Definitions (`views/*.yaml`)

YAML files defining pages with blocks. Each block can be:
- `markdown`: Static content
- `fhirpath-table`: Table driven by a FHIRPath expression with column projections and optional filters

```yaml
views:
  - id: dashboard
    title: "Medication Registry"
    blocks:
      - type: fhirpath-table
        title: "Oral Medications"
        expression: "Medication.where(form.coding.display in ('Tablet' | 'Capsule'))"
        columns:
          - header: "Name"
            path: "code.text"
          - header: "Form"
            path: "form.coding.first().display"
        pageSize: 10
```

### 2. Indexer (`src/indexer.ts`)

Bun/TypeScript tool that:
- Parses view definitions to extract FHIRPath expressions
- Evaluates each expression against all resources using fhirpath.js
- Captures **path metadata** for each result (where in the source resource the value came from)
- Writes results to SQLite

**Key insight**: We use a custom fhirpath.js function with `internalStructures: true` to access the internal node representation and extract source paths.

### 3. SQLite Schema

```sql
-- Main index: one row per FHIRPath result item
CREATE TABLE fhirpath_index (
  expression_id TEXT,        -- which expression produced this
  source_resource_id TEXT,   -- resource evaluated against
  source_resource_type TEXT,
  source_path TEXT,          -- path within resource (e.g., "Medication.CodeableConcept.Coding")
  value_json TEXT            -- the result value as JSON
);

-- Expression metadata
CREATE TABLE expressions (
  id TEXT PRIMARY KEY,
  expression TEXT,
  projections_json TEXT      -- column definitions for tables
);

-- View definitions (for runtime rendering)
CREATE TABLE views (
  id TEXT PRIMARY KEY,
  definition_json TEXT
);
```

### 4. Browser Runtime (`web/index.html`)

Single-page app that:
- Loads SQLite database via sql.js (WebAssembly)
- Reads view definitions from the database
- Renders blocks by querying the `fhirpath_index` table
- Supports pagination and filters
- Shows "Technical Details" boxes with FHIRPath expressions for debugging

### 5. Data Generator (`src/generate-medications.ts`)

Synthetic FHIR R4 Medication generator for testing:
- Creates 10K and 100K medication resources
- Realistic variety: code systems, dose forms, statuses, ingredients
- Deterministic output for reproducible builds

## Design Choices

| Decision | Rationale |
|----------|-----------|
| **SQLite + sql.js** | Mature, fast, works offline, familiar SQL interface |
| **Pre-index at build time** | FHIRPath evaluation is too slow for browser runtime |
| **Store full JSON values** | Flexibility - column projections are done at render time |
| **Path metadata** | Enables future features like "click to see source" |
| **YAML view definitions** | Human-readable, can live alongside IG source |
| **Single HTML file** | Simple deployment, no build step for frontend |
| **Bun** | Fast TypeScript execution, native SQLite support |

## Performance

| Dataset | Resources | Index Rows | Build Time | DB Size |
|---------|-----------|------------|------------|---------|
| 10K     | 10,000    | ~76,000    | ~8s        | 28 MB   |
| 100K    | 100,000   | ~750,000   | ~55s       | 273 MB  |

Browser load time for 28MB database: ~2-3 seconds (varies by network).

## Usage

### Local Development

```bash
# Install dependencies
bun install

# Generate test data
bun run generate

# Build (generates data + indexes + assembles dist/)
bun run build

# Serve locally
bun run serve:10k
# Open http://localhost:3000
```

### GitHub Pages Deployment

Push to `main` branch. GitHub Actions will:
1. Generate medication data
2. Run the indexer
3. Assemble `dist/` with HTML + SQLite
4. Deploy to GitHub Pages

## Future Work

- [ ] Support for runtime FHIRPath evaluation (for detail pages with URL params)
- [ ] Filter implementation (currently shows filters but doesn't apply them)
- [ ] More block types: `fhirpath-list`, `fhirpath-single`
- [ ] Resource detail pages with full JSON view
- [ ] Search across indexed values
- [ ] Incremental indexing for large IGs
- [ ] Integration with actual IG Publisher output

## License

MIT
