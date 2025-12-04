/**
 * FHIRPath Usage Examples in Bun/TypeScript
 *
 * This file demonstrates how to use fhirpath.js in a Bun/TypeScript environment,
 * with special focus on extracting path metadata for results.
 */

import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

// Sample Medication resource for testing
const sampleMedication = {
  resourceType: "Medication",
  id: "med0301",
  code: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "322254008",
        display: "Vancomycin 500mg Injection"
      },
      {
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: "66955",
        display: "Vancomycin"
      }
    ],
    text: "Vancomycin 500mg"
  },
  status: "active",
  form: {
    coding: [
      {
        system: "http://snomed.info/sct",
        code: "385219001",
        display: "Injection solution"
      }
    ]
  },
  ingredient: [
    {
      itemCodeableConcept: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "372733002",
            display: "Vancomycin"
          }
        ]
      },
      isActive: true,
      strength: {
        numerator: {
          value: 500,
          system: "http://unitsofmeasure.org",
          code: "mg"
        },
        denominator: {
          value: 10,
          system: "http://unitsofmeasure.org",
          code: "mL"
        }
      }
    }
  ]
};

console.log("=".repeat(80));
console.log("FHIRPath.js Usage Examples");
console.log("=".repeat(80));

// Example 1: Basic evaluation without path metadata
console.log("\n1. BASIC EVALUATION");
console.log("-".repeat(80));

const expression1 = "Medication.code.coding.code";
const result1 = fhirpath.evaluate(sampleMedication, expression1);
console.log(`Expression: ${expression1}`);
console.log("Results:", result1);
console.log("Result type:", typeof result1, "length:", result1.length);

// Example 2: Using model for better type support
console.log("\n2. EVALUATION WITH R4 MODEL");
console.log("-".repeat(80));

const expression2 = "Medication.ingredient.strength.numerator.value";
const result2 = fhirpath.evaluate(
  sampleMedication,
  expression2,
  null,
  fhirpath_r4_model
);
console.log(`Expression: ${expression2}`);
console.log("Results:", result2);

// Example 3: CRITICAL - Getting path metadata using custom function with internalStructures
console.log("\n3. GETTING PATH METADATA (Key Feature!)");
console.log("-".repeat(80));

/**
 * Helper function to build the full path from a ResourceNode by traversing parent chain
 */
function buildFullPath(node: any): string {
  const pathParts: string[] = [];
  let current = node;

  while (current) {
    if (current.path) {
      pathParts.unshift(current.path);
    }
    current = current.parentResNode;
  }

  return pathParts.join('.');
}

/**
 * Custom function that extracts both values and their paths from ResourceNode objects.
 * This is the key technique for getting provenance/path information for FHIRPath results.
 */
const pathExtractorFunction = {
  fn: (inputs: any[]) => {
    return inputs.map(node => {
      // Check if this is a ResourceNode (internal structure)
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
  arity: { 0: [] },
  internalStructures: true  // This is CRITICAL - tells fhirpath to pass ResourceNode objects
};

const userInvocationTable = {
  getPath: pathExtractorFunction
};

// Use the custom function to get paths
const expression3 = "Medication.code.coding.getPath()";
const result3 = fhirpath.evaluate(
  sampleMedication,
  expression3,
  null,
  fhirpath_r4_model,
  { userInvocationTable }
);
console.log(`Expression: ${expression3}`);
console.log("Results with paths:", JSON.stringify(result3, null, 2));

// Example 4: More complex path extraction - get all codings with their paths
console.log("\n4. COMPLEX PATH EXTRACTION - ALL CODINGS");
console.log("-".repeat(80));

const expression4 = "Medication.descendants().where($this.ofType(Coding)).getPath()";
const result4 = fhirpath.evaluate(
  sampleMedication,
  expression4,
  null,
  fhirpath_r4_model,
  { userInvocationTable }
);
console.log(`Expression: ${expression4}`);
console.log("All coding elements with paths:");
result4.forEach((item: any, idx: number) => {
  console.log(`  [${idx}] Path: ${item.path}`);
  console.log(`      Value:`, JSON.stringify(item.value, null, 6));
});

// Example 5: Extract specific values with their paths
console.log("\n5. SPECIFIC VALUES WITH PATHS - CODE VALUES");
console.log("-".repeat(80));

const expression5 = "Medication.code.coding.code.getPath()";
const result5 = fhirpath.evaluate(
  sampleMedication,
  expression5,
  null,
  fhirpath_r4_model,
  { userInvocationTable }
);
console.log(`Expression: ${expression5}`);
console.log("Code values with their source paths:");
result5.forEach((item: any, idx: number) => {
  console.log(`  [${idx}] Path: ${item.path}, Value: ${item.value}`);
});

// Example 6: Alternative approach - using trace for debugging
console.log("\n6. USING TRACE FUNCTION FOR DEBUGGING");
console.log("-".repeat(80));

let traceOutput: any[] = [];
const traceFn = (value: any, label: string) => {
  traceOutput.push({ label, value });
};

const expression6 = "Medication.code.coding.trace('codings').code.trace('codes')";
const result6 = fhirpath.evaluate(
  sampleMedication,
  expression6,
  null,
  fhirpath_r4_model,
  { traceFn }
);
console.log(`Expression: ${expression6}`);
console.log("Trace output:");
traceOutput.forEach(({ label, value }) => {
  console.log(`  Label: ${label}`);
  console.log(`  Value:`, value);
});
console.log("Final result:", result6);

// Example 7: Working with arrays - ingredient values with paths
console.log("\n7. ARRAY ELEMENTS WITH PATHS");
console.log("-".repeat(80));

const expression7 = "Medication.ingredient.itemCodeableConcept.coding.getPath()";
const result7 = fhirpath.evaluate(
  sampleMedication,
  expression7,
  null,
  fhirpath_r4_model,
  { userInvocationTable }
);
console.log(`Expression: ${expression7}`);
console.log("Ingredient coding with paths:");
result7.forEach((item: any, idx: number) => {
  console.log(`  [${idx}] Path: ${item.path}`);
  console.log(`      Code: ${item.value?.code}, Display: ${item.value?.display}`);
});

// Example 8: Utility function for general path extraction
console.log("\n8. UTILITY HELPER FOR PATH EXTRACTION");
console.log("-".repeat(80));

/**
 * Helper function to evaluate a FHIRPath expression and return results with their paths
 */
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

  // Append .getPath() to the expression to extract paths
  const modifiedExpression = `(${expression}).getPath()`;

  return fhirpath.evaluate(
    resource,
    modifiedExpression,
    null,
    model,
    { userInvocationTable: pathExtractor }
  );
}

// Use the helper
const result8 = evaluateWithPaths(sampleMedication, "Medication.code.coding");
console.log("Using helper function:");
result8.forEach((item, idx) => {
  console.log(`  [${idx}] ${item.path} = ${JSON.stringify(item.value)}`);
});

// Example 9: Compare normal evaluation vs path-aware evaluation
console.log("\n9. COMPARISON: NORMAL vs PATH-AWARE EVALUATION");
console.log("-".repeat(80));

const expr = "Medication.status";
const normalResult = fhirpath.evaluate(sampleMedication, expr, null, fhirpath_r4_model);
const pathAwareResult = evaluateWithPaths(sampleMedication, expr);

console.log("Normal evaluation:");
console.log("  Result:", normalResult);

console.log("\nPath-aware evaluation:");
console.log("  Result:", pathAwareResult);

console.log("\n" + "=".repeat(80));
console.log("KEY FINDINGS:");
console.log("=".repeat(80));
console.log(`
1. ResourceNode objects contain 'path' and 'data' properties
2. Use 'internalStructures: true' in custom functions to receive ResourceNode objects
3. The 'path' property contains the full path in the resource (e.g., "Medication.code.coding")
4. For arrays, paths include indices would need manual tracking or different approach
5. The trace() function can help debug but doesn't provide structured path info
6. Best approach: Create a custom getPath() function with internalStructures flag
`);
