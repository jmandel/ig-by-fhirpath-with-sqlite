# FHIRPath.js in Bun/TypeScript - Usage Notes

## Overview

This document provides comprehensive notes on using fhirpath.js in a Bun/TypeScript environment, with special focus on extracting path metadata for FHIRPath evaluation results.

## Installation

```bash
bun install fhirpath
```

The package is already included in `package.json` with version `^3.15.1`.

## Basic Usage

### Simple Evaluation

```typescript
import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

const resource = {
  resourceType: "Medication",
  code: {
    coding: [
      { system: "http://snomed.info/sct", code: "322254008" }
    ]
  }
};

// Basic evaluation
const results = fhirpath.evaluate(resource, "Medication.code.coding.code");
// Returns: ["322254008"]

// With R4 model for better type support
const results2 = fhirpath.evaluate(
  resource,
  "Medication.code.coding.code",
  null,  // environment variables
  fhirpath_r4_model
);
```

### API Signature

```typescript
fhirpath.evaluate(
  resourceObject,      // FHIR resource as JS object
  expression,          // FHIRPath expression string
  envVars,            // environment variables (optional)
  model,              // FHIR model (e.g., fhirpath_r4_model)
  options             // additional options
)
```

## Getting Path Metadata (Critical Feature!)

### The Challenge

By default, `fhirpath.evaluate()` returns only the values that match the expression. **It does not provide information about where in the resource those values came from.** This is a problem for indexing use cases where we need to know the source path of each result.

### The Solution: Custom Functions with `internalStructures`

FHIRPath.js internally uses `ResourceNode` objects that contain both the `data` (value) and `path` information. You can access these by creating a custom function with `internalStructures: true`.

#### Step 1: Understanding ResourceNode

Every value in FHIRPath evaluation is wrapped in a `ResourceNode` object with these properties:
- `data`: The actual value
- `path`: The immediate field/type name
- `parentResNode`: Reference to parent ResourceNode (forms a chain to root)
- `fhirNodeDataType`: The FHIR data type
- `model`: The FHIR model being used

#### Step 2: Create a Path Extraction Function

```typescript
function buildFullPath(node: any): string {
  const pathParts: string[] = [];
  let current = node;

  // Traverse up the parent chain to build full path
  while (current) {
    if (current.path) {
      pathParts.unshift(current.path);
    }
    current = current.parentResNode;
  }

  return pathParts.join('.');
}

const pathExtractorFunction = {
  fn: (inputs: any[]) => {
    return inputs.map(node => {
      // Check if this is a ResourceNode
      if (node && typeof node === 'object' && 'path' in node && 'data' in node) {
        return {
          path: buildFullPath(node),
          immediateField: node.path,  // Just the immediate field name
          value: node.data
        };
      }
      // Fallback for primitive values
      return {
        path: null,
        immediateField: null,
        value: node
      };
    });
  },
  arity: { 0: [] },  // This function takes no parameters
  internalStructures: true  // CRITICAL FLAG!
};
```

#### Step 3: Use the Custom Function

```typescript
const userInvocationTable = {
  getPath: pathExtractorFunction
};

const results = fhirpath.evaluate(
  resource,
  "Medication.code.coding.getPath()",  // Call your custom function
  null,
  fhirpath_r4_model,
  { userInvocationTable }
);

// Results now include path metadata:
// [
//   {
//     path: "Medication.CodeableConcept.Coding",
//     immediateField: "Coding",
//     value: { system: "...", code: "...", display: "..." }
//   }
// ]
```

### Helper Function for Convenience

```typescript
function evaluateWithPaths(
  resource: any,
  expression: string,
  model = fhirpath_r4_model
): Array<{ path: string | null, immediateField: string | null, value: any }> {
  const pathExtractor = {
    getPath: {
      fn: (inputs: any[]) => {
        return inputs.map(node => {
          if (node && typeof node === 'object' && 'path' in node && 'data' in node) {
            return {
              path: buildFullPath(node),
              immediateField: node.path,
              value: node.data
            };
          }
          return {
            path: null,
            immediateField: null,
            value: node
          };
        });
      },
      arity: { 0: [] },
      internalStructures: true
    }
  };

  // Automatically append .getPath() to expression
  const modifiedExpression = `(${expression}).getPath()`;

  return fhirpath.evaluate(
    resource,
    modifiedExpression,
    null,
    model,
    { userInvocationTable: pathExtractor }
  );
}

// Usage:
const results = evaluateWithPaths(medication, "Medication.code.coding");
```

## Path Format: Type-Based vs Field-Based

### Important Note on Path Format

The paths returned by fhirpath.js are **type-based** rather than **field-based**. This means:

- **Type-based path**: `Medication.CodeableConcept.Coding.code`
- **Field-based path**: `Medication.code.coding[0].code`

### Why Type-Based?

FHIRPath operates on the FHIR logical model, not the JSON structure. The paths reflect FHIR data types:
- `CodeableConcept` instead of the field name `code`
- `Coding` instead of the array field `coding`

### Array Indices

**Important limitation**: The paths do NOT include array indices by default. If you have multiple codings in an array, they will all report the same path:

```typescript
// Both codings report: "Medication.CodeableConcept.Coding"
Medication.code.coding[0]  // First coding
Medication.code.coding[1]  // Second coding
```

To track array indices, you would need to:
1. Keep a counter in your evaluation logic
2. Use the array index from the original FHIRPath result order
3. Build custom logic to map back to JSON structure

## Alternative Approaches

### 1. Using trace() for Debugging

The `trace()` function can help debug but doesn't provide structured path info:

```typescript
const traceFn = (value: any, label: string) => {
  console.log(`Trace [${label}]:`, value);
};

fhirpath.evaluate(
  resource,
  "Medication.code.coding.trace('here').code",
  null,
  fhirpath_r4_model,
  { traceFn }
);
```

**Limitations**:
- Prints to console/callback, not structured output
- Still shows ResourceNode objects, not clean path strings
- Requires manual trace() calls in expressions

### 2. Pre-compile Expressions

You can pre-compile expressions for reuse:

```typescript
const compiled = fhirpath.compile(
  "Medication.code.coding.code",
  fhirpath_r4_model
);

// Use against multiple resources
const result1 = compiled(resource1);
const result2 = compiled(resource2);
```

**Note**: This doesn't help with path extraction, but improves performance.

## Gotchas and Limitations

### 1. Array Index Tracking

**Problem**: Paths don't include array indices automatically.

**Workaround**: Track the order of results and manually correlate with your resource structure.

### 2. Type Names vs Field Names

**Problem**: Paths use FHIR type names (e.g., "CodeableConcept") not JSON field names (e.g., "code").

**Workaround**: You may need to maintain a mapping between type-based paths and field-based paths using the FHIR StructureDefinitions.

### 3. Choice Types

**Problem**: Choice types (like `value[x]`) are represented by their specific type in the path.

**Example**:
- JSON: `{ "valueString": "hello" }`
- Path: `Observation.value` (where `value` resolves to `valueString`)

### 4. Resource Modification

**Important**: The `evaluate()` function **modifies the input resource** to add type information. If you need the original resource unchanged, pass a deep clone:

```typescript
import { structuredClone } from 'node:v8';

const results = fhirpath.evaluate(
  structuredClone(resource),
  expression,
  null,
  model
);
```

### 5. TypeScript Types

The fhirpath package includes TypeScript definitions (`fhirpath.d.ts`), but they're fairly loose. You'll often need to use `any` for ResourceNode manipulation:

```typescript
// Type definitions exist but are limited
const node: any = ...;  // ResourceNode isn't exported as a type
```

### 6. Model Required for Type Resolution

Always pass the FHIR model (e.g., `fhirpath_r4_model`) to get accurate type information in paths. Without it, type resolution is limited.

## Use Cases for Path Metadata

### 1. Search Indexing

Build inverted indices that map search parameters to resource locations:

```typescript
const codePaths = evaluateWithPaths(medication, "Medication.code.coding");
// Index: code -> ["Medication.CodeableConcept.Coding", ...]
```

### 2. Data Extraction

Extract values with their provenance for data warehousing:

```typescript
const values = evaluateWithPaths(patient, "Patient.name.given");
// Extract: { value: "John", path: "Patient.HumanName.given" }
```

### 3. Validation and Quality Checks

Identify which fields in a resource have specific properties:

```typescript
const emptyFields = evaluateWithPaths(resource, "descendants().where($this = {})");
// Find all empty objects and their locations
```

### 4. Differential Updates

Track which paths changed between resource versions:

```typescript
const oldPaths = evaluateWithPaths(oldResource, "descendants()");
const newPaths = evaluateWithPaths(newResource, "descendants()");
// Compare to find changes
```

## Performance Considerations

1. **Pre-compile expressions** when using them repeatedly
2. **Clone resources** only if you need the original unchanged (cloning has overhead)
3. **Custom functions with `internalStructures`** have minimal overhead
4. **Traversing parent chains** (for full paths) adds some overhead per node

## Working Example

See `/home/jmandel/hobby/fhirpathindex/src/fhirpath-usage.ts` for a complete working example with:
- Basic evaluation
- Path metadata extraction
- Multiple techniques demonstrated
- Sample Medication resource
- Helper functions

Run it with:
```bash
bun run src/fhirpath-usage.ts
```

## Summary

### Key Takeaways

1. ✅ **Path metadata IS possible** via `internalStructures: true` custom functions
2. ✅ **ResourceNode** objects contain both value and path information
3. ⚠️ **Paths are type-based**, not field-based (uses FHIR types)
4. ⚠️ **Array indices** are NOT included in paths automatically
5. ✅ **Full paths** can be built by traversing the parent chain
6. ✅ **Best approach** is a custom `getPath()` function with the `internalStructures` flag

### For Indexing Purposes

For building a FHIRPath-based search index, you can:
1. Use the type-based paths from fhirpath.js
2. Track array indices separately by order of results
3. Map paths to actual resource locations as needed
4. Build your index using the combination of path + value

The type-based paths are actually **advantageous** for search indexing because they align with how FHIR SearchParameters are defined (which also use type-aware paths).
