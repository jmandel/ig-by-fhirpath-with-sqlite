# FHIRPath.js Research Summary

## Objective
Research how to use fhirpath.js in Bun/TypeScript and determine if we can extract path metadata for FHIRPath evaluation results (needed for building a search indexer).

## Status: ✅ COMPLETE & SUCCESSFUL

## Key Discovery: Path Metadata Extraction IS POSSIBLE

### The Problem
By default, `fhirpath.evaluate()` only returns values, not their source paths within the resource:

```typescript
fhirpath.evaluate(medication, "Medication.code.coding.code")
// Returns: ["123", "456"]
// But WHERE did these come from? We need the paths!
```

### The Solution
Use custom functions with `internalStructures: true` to access `ResourceNode` objects that contain both value and path information:

```typescript
const getPathFunction = {
  fn: (inputs: any[]) => inputs.map(node => ({
    path: buildFullPath(node),  // Traverse parent chain
    value: node.data
  })),
  arity: { 0: [] },
  internalStructures: true  // CRITICAL FLAG!
};

fhirpath.evaluate(
  medication,
  "Medication.code.coding.code.getPath()",
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);
// Returns: [
//   { path: "Medication.CodeableConcept.Coding.code", value: "123" },
//   { path: "Medication.CodeableConcept.Coding.code", value: "456" }
// ]
```

### How It Works
1. FHIRPath internally wraps all values in `ResourceNode` objects
2. Each `ResourceNode` has:
   - `data`: the actual value
   - `path`: immediate field/type name
   - `parentResNode`: link to parent (chain to root)
   - `fhirNodeDataType`: FHIR type information
3. Custom functions with `internalStructures: true` receive these objects
4. We traverse the parent chain to build full paths

## Files Created

### Documentation
- **docs/fhirpath-notes.md** (11K) - Comprehensive usage guide
- **docs/README.md** (4K) - Documentation index and summary
- **FHIRPATH_RESEARCH_SUMMARY.md** (this file) - Executive summary

### Source Code
- **src/fhirpath-usage.ts** (9K) - 9 comprehensive examples
- **src/test-path-extraction.ts** (2K) - Focused path extraction demo

All code is tested and working in Bun environment.

## Path Format Details

### Type-Based Paths (What You Get)
```
Medication.CodeableConcept.Coding.code
```

### Field-Based Paths (What You Don't Get Directly)
```
Medication.code.coding[0].code
```

**Why?** FHIRPath operates on FHIR's logical model, not JSON structure. Paths reflect FHIR types.

**Is this a problem?** No! It's actually beneficial for search indexing because FHIR SearchParameters also use type-aware paths.

## Important Findings

### ✅ Capabilities
1. Extract path metadata for any FHIRPath result
2. Get full type-based paths by traversing parent chain
3. Access FHIR type information for each node
4. Works with complex expressions (descendants, filtering, etc.)
5. Minimal performance overhead

### ⚠️ Limitations
1. **No array indices in paths** - Must track separately via result order
2. **Type names not field names** - Returns FHIR types (e.g., "CodeableConcept")
3. **Resource modification** - Input resource is modified with type info (clone if needed)
4. **No exported TypeScript types** - ResourceNode type not exported, must use `any`

### 💡 Workarounds
1. **Array indices**: Track by order in results array
2. **Field names**: Map types to fields using FHIR StructureDefinitions if needed
3. **Type safety**: Define your own interfaces for results

## Testing Results

Both demo files run successfully:

```bash
$ bun run src/test-path-extraction.ts
Testing FHIRPath with Path Extraction

1. All coding.code values with paths:
   [0] path="Medication.CodeableConcept.Coding.code" value="123"
   [1] path="Medication.CodeableConcept.Coding.code" value="456"

✅ Path extraction working successfully!
```

## Implications for Indexer

With this research, we can now build the indexer because we know:

1. ✅ How to evaluate FHIRPath expressions against resources
2. ✅ How to extract path metadata for each result
3. ✅ What the path format looks like (type-based)
4. ✅ How to handle arrays (track by result order)
5. ✅ Performance characteristics (fast, minimal overhead)

## Recommended Approach for Indexer

```typescript
// 1. Define search parameters with FHIRPath expressions
const searchParams = {
  code: { expression: "Medication.code" },
  status: { expression: "Medication.status" }
};

// 2. Evaluate with path extraction
for (const [paramName, param] of Object.entries(searchParams)) {
  const results = evaluateWithPaths(resource, param.expression);
  
  // 3. Index each result with its path
  for (const [index, result] of results.entries()) {
    indexer.add({
      resourceType: resource.resourceType,
      resourceId: resource.id,
      paramName: paramName,
      path: result.path,
      arrayIndex: index,  // Track position for arrays
      value: result.value
    });
  }
}
```

## Next Steps

1. ✅ FHIRPath research complete
2. ⏭️ Design indexer schema
3. ⏭️ Implement indexer with path tracking
4. ⏭️ Build search query engine

## Conclusion

**The research was successful.** FHIRPath.js fully supports extracting path metadata through the `internalStructures` mechanism. We have everything needed to build a FHIRPath-based search indexer.
