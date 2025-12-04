# FHIRPath.js Quick Reference

## Basic Import

```typescript
import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
```

## Simple Evaluation

```typescript
const results = fhirpath.evaluate(
  resource,                // FHIR resource object
  "Patient.name.given",    // FHIRPath expression
  null,                    // environment variables (optional)
  fhirpath_r4_model        // FHIR model for type support
);
```

## Path Extraction (The Secret Sauce)

### Step 1: Build Path Helper

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
```

### Step 2: Create Custom Function

```typescript
const getPathFunction = {
  fn: (inputs: any[]) => inputs.map(node => ({
    path: buildFullPath(node),
    value: node.data
  })),
  arity: { 0: [] },
  internalStructures: true  // CRITICAL!
};
```

### Step 3: Use It

```typescript
const results = fhirpath.evaluate(
  resource,
  "Patient.name.given.getPath()",  // Note: .getPath() at end
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);

// Results:
// [
//   { path: "Patient.HumanName.given", value: "John" },
//   { path: "Patient.HumanName.given", value: "Jane" }
// ]
```

## Complete Helper Function

```typescript
function evaluateWithPaths(resource: any, expression: string) {
  const getPath = {
    fn: (inputs: any[]) => inputs.map(node =>
      node?.path && node?.data
        ? { path: buildFullPath(node), value: node.data }
        : { path: null, value: node }
    ),
    arity: { 0: [] },
    internalStructures: true
  };

  return fhirpath.evaluate(
    resource,
    `(${expression}).getPath()`,
    null,
    fhirpath_r4_model,
    { userInvocationTable: { getPath } }
  );
}

// Usage:
const results = evaluateWithPaths(patient, "Patient.name.given");
```

## Common Patterns

### Extract All Codings

```typescript
evaluateWithPaths(resource, "descendants().where($this.ofType(Coding))")
```

### Extract Specific Field

```typescript
evaluateWithPaths(resource, "Medication.status")
```

### Extract Nested Arrays

```typescript
evaluateWithPaths(resource, "Patient.name.given")
// Automatically handles multiple names and multiple given names per name
```

## Path Format

Paths are **type-based** (FHIR types), not field-based (JSON keys):

| What you get | JSON structure |
|--------------|----------------|
| `Patient.HumanName.given` | `Patient.name[0].given[0]` |
| `Medication.CodeableConcept.Coding` | `Medication.code.coding[0]` |
| `Observation.Quantity.value` | `Observation.valueQuantity.value` |

## Important Notes

- ⚠️ **Array indices NOT included** - track by result order
- ⚠️ **Input resource is modified** - clone if needed
- ✅ **Works with any FHIRPath expression**
- ✅ **Minimal performance impact**
- ✅ **Type-aware (good for FHIR SearchParameters)**

## Complete Working Example

See `/home/jmandel/hobby/fhirpathindex/src/test-path-extraction.ts`

```bash
bun run src/test-path-extraction.ts
```

## Documentation

- [fhirpath-notes.md](./fhirpath-notes.md) - Full documentation
- [README.md](./README.md) - Overview and summary
- [/FHIRPATH_RESEARCH_SUMMARY.md](../FHIRPATH_RESEARCH_SUMMARY.md) - Research findings
