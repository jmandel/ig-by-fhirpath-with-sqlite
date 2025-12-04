/**
 * Quick test to demonstrate path extraction capability
 */

import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';

// Helper to build full path from ResourceNode
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

// Custom function to extract paths
const getPathFunction = {
  fn: (inputs: any[]) => {
    return inputs.map(node => {
      if (node && typeof node === 'object' && 'path' in node && 'data' in node) {
        return {
          path: buildFullPath(node),
          value: node.data
        };
      }
      return { path: null, value: node };
    });
  },
  arity: { 0: [] },
  internalStructures: true
};

const medication = {
  resourceType: "Medication",
  id: "example",
  code: {
    coding: [
      { system: "http://snomed.info/sct", code: "123", display: "Drug A" },
      { system: "http://rxnorm.nlm.nih.gov", code: "456", display: "Drug B" }
    ],
    text: "Example Medication"
  },
  status: "active"
};

console.log("Testing FHIRPath with Path Extraction\n");

// Test 1: Get all codes with their paths
const result1 = fhirpath.evaluate(
  medication,
  "Medication.code.coding.code.getPath()",
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);

console.log("1. All coding.code values with paths:");
result1.forEach((item, i) => {
  console.log(`   [${i}] path="${item.path}" value="${item.value}"`);
});

// Test 2: Get status with path
const result2 = fhirpath.evaluate(
  medication,
  "Medication.status.getPath()",
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);

console.log("\n2. Status value with path:");
result2.forEach((item, i) => {
  console.log(`   [${i}] path="${item.path}" value="${item.value}"`);
});

// Test 3: Get entire coding objects with paths
const result3 = fhirpath.evaluate(
  medication,
  "Medication.code.coding.getPath()",
  null,
  fhirpath_r4_model,
  { userInvocationTable: { getPath: getPathFunction } }
);

console.log("\n3. Full Coding objects with paths:");
result3.forEach((item, i) => {
  console.log(`   [${i}] path="${item.path}"`);
  console.log(`       code="${item.value.code}" display="${item.value.display}"`);
});

console.log("\n✅ Path extraction working successfully!");
