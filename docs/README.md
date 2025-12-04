# FHIRPath Research Documentation

This directory contains research and documentation on using fhirpath.js in preparation for building a FHIRPath-based search indexer.

## Files

### [fhirpath-notes.md](./fhirpath-notes.md)
Comprehensive documentation covering:
- How to use fhirpath.js in Bun/TypeScript
- **How to extract path metadata from FHIRPath results** (the key finding!)
- API reference and examples
- Gotchas and limitations
- Performance considerations
- Use cases for indexing

## Source Code Examples

### [/src/fhirpath-usage.ts](/src/fhirpath-usage.ts)
Comprehensive demonstration file with 9 different examples showing:
1. Basic evaluation
2. Evaluation with R4 model
3. **Path metadata extraction** (critical feature)
4. Complex path extraction for all codings
5. Extracting specific values with paths
6. Using trace() for debugging
7. Working with array elements
8. Utility helper functions
9. Comparison of normal vs path-aware evaluation

Run it:
```bash
bun run src/fhirpath-usage.ts
```

### [/src/test-path-extraction.ts](/src/test-path-extraction.ts)
Focused test demonstrating the path extraction capability clearly.

Run it:
```bash
bun run src/test-path-extraction.ts
```

## Key Findings

### Path Metadata IS Possible! ✅

The critical discovery is that **fhirpath.js DOES support extracting path metadata** for results, but it's not obvious from the basic API. Here's how:

1. **Use `internalStructures: true`** in custom functions to receive `ResourceNode` objects
2. **ResourceNode objects contain:**
   - `data`: The actual value
   - `path`: The immediate field/type name
   - `parentResNode`: Link to parent (forms chain to root)
3. **Build full paths** by traversing the parent chain

### Example Code

```typescript
function buildFullPath(node: any): string {
  const pathParts: string[] = [];
  let current = node;
  while (current) {
    if (current.path) pathParts.unshift(current.path);
    current = current.parentResNode;
  }
  return pathParts.join('.');
}

const getPathFunction = {
  fn: (inputs: any[]) => inputs.map(node => ({
    path: buildFullPath(node),
    value: node.data
  })),
  arity: { 0: [] },
  internalStructures: true  // KEY FLAG!
};

const results = fhirpath.evaluate(
  resource,
  "Medication.code.coding.code.getPath()",
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);

// Results: [
//   { path: "Medication.CodeableConcept.Coding.code", value: "123" },
//   { path: "Medication.CodeableConcept.Coding.code", value: "456" }
// ]
```

### Path Format

Paths are **type-based** (FHIR logical model), not field-based (JSON structure):
- ✅ `Medication.CodeableConcept.Coding.code` (what you get)
- ❌ `Medication.code.coding[0].code` (not directly available)

This is actually **good for indexing** because FHIR SearchParameters use type-aware paths too!

### Limitations

1. **Array indices not included** - Need to track separately
2. **Type names not field names** - Paths use FHIR types
3. **Resource gets modified** - Clone if you need original unchanged

See [fhirpath-notes.md](./fhirpath-notes.md) for full details and workarounds.

## Next Steps for Indexer

With this research complete, we can now build the indexer with confidence:

1. ✅ We know how to extract values from resources using FHIRPath
2. ✅ We know how to get path metadata for each result
3. ✅ We understand the path format (type-based)
4. ✅ We know the limitations (array indices, etc.)

Ready to implement the actual search indexer!
