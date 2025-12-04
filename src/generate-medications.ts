#!/usr/bin/env bun

import { writeFileSync } from "fs";

// Realistic medication data pools
const medicationNames = [
  { name: "Lisinopril", rxnorm: "314076", ndc: "0093-7366-01" },
  { name: "Metformin", rxnorm: "860975", ndc: "0093-7214-01" },
  { name: "Amlodipine", rxnorm: "197361", ndc: "0093-7371-01" },
  { name: "Atorvastatin", rxnorm: "617310", ndc: "0071-0155-23" },
  { name: "Omeprazole", rxnorm: "312681", ndc: "0093-7316-01" },
  { name: "Levothyroxine", rxnorm: "966221", ndc: "0074-6596-13" },
  { name: "Albuterol", rxnorm: "307782", ndc: "0093-0058-12" },
  { name: "Gabapentin", rxnorm: "284089", ndc: "0093-1019-01" },
  { name: "Losartan", rxnorm: "203160", ndc: "0093-7360-01" },
  { name: "Sertraline", rxnorm: "312938", ndc: "0093-7212-01" },
  { name: "Hydrochlorothiazide", rxnorm: "310798", ndc: "0093-0024-01" },
  { name: "Furosemide", rxnorm: "202991", ndc: "0054-0203-25" },
  { name: "Amoxicillin", rxnorm: "308192", ndc: "0093-4181-73" },
  { name: "Azithromycin", rxnorm: "248656", ndc: "0093-7146-12" },
  { name: "Prednisone", rxnorm: "312617", ndc: "0054-0206-25" },
  { name: "Warfarin", rxnorm: "855333", ndc: "0093-0142-01" },
  { name: "Clopidogrel", rxnorm: "309362", ndc: "0093-7298-01" },
  { name: "Pantoprazole", rxnorm: "402014", ndc: "0093-5097-01" },
  { name: "Metoprolol", rxnorm: "866426", ndc: "0093-7376-01" },
  { name: "Carvedilol", rxnorm: "200031", ndc: "0093-7363-01" },
  { name: "Insulin Glargine", rxnorm: "261542", ndc: "0088-2220-33" },
  { name: "Insulin Lispro", rxnorm: "259111", ndc: "0002-7510-01" },
  { name: "Montelukast", rxnorm: "349483", ndc: "0093-7347-56" },
  { name: "Tramadol", rxnorm: "835603", ndc: "0093-0058-01" },
  { name: "Escitalopram", rxnorm: "321988", ndc: "0093-7356-01" },
  { name: "Duloxetine", rxnorm: "596928", ndc: "0002-3240-30" },
  { name: "Bupropion", rxnorm: "993503", ndc: "0093-3147-01" },
  { name: "Citalopram", rxnorm: "351772", ndc: "0093-7355-01" },
  { name: "Simvastatin", rxnorm: "312961", ndc: "0093-7273-01" },
  { name: "Pravastatin", rxnorm: "861634", ndc: "0093-7375-01" },
  { name: "Rosuvastatin", rxnorm: "859424", ndc: "0093-7663-01" },
  { name: "Tamsulosin", rxnorm: "835620", ndc: "0093-7340-01" },
  { name: "Meloxicam", rxnorm: "283420", ndc: "0093-0857-01" },
  { name: "Alprazolam", rxnorm: "308047", ndc: "0093-0094-01" },
  { name: "Lorazepam", rxnorm: "848117", ndc: "0093-0065-01" },
  { name: "Clonazepam", rxnorm: "349371", ndc: "0093-0832-01" },
  { name: "Zolpidem", rxnorm: "854880", ndc: "0093-5989-01" },
  { name: "Cyclobenzaprine", rxnorm: "202365", ndc: "0093-0803-01" },
  { name: "Trazodone", rxnorm: "314054", ndc: "0093-0101-01" },
  { name: "Hydrocodone/Acetaminophen", rxnorm: "857001", ndc: "0093-0133-01" },
  { name: "Oxycodone", rxnorm: "1049621", ndc: "0054-0234-25" },
  { name: "Aspirin", rxnorm: "308414", ndc: "0113-0472-62" },
  { name: "Ibuprofen", rxnorm: "310965", ndc: "0113-0348-62" },
  { name: "Acetaminophen", rxnorm: "313782", ndc: "0113-0266-62" },
  { name: "Naproxen", rxnorm: "283742", ndc: "0093-0147-01" },
  { name: "Diphenhydramine", rxnorm: "309684", ndc: "0113-0231-62" },
  { name: "Cetirizine", rxnorm: "310784", ndc: "0113-0496-62" },
  { name: "Fexofenadine", rxnorm: "310800", ndc: "0093-7449-01" },
  { name: "Doxycycline", rxnorm: "316006", ndc: "0093-3143-50" },
  { name: "Ciprofloxacin", rxnorm: "309093", ndc: "0093-0092-01" },
];

const doseForms = [
  { code: "385055001", display: "Tablet" },
  { code: "385049006", display: "Capsule" },
  { code: "385219001", display: "Solution for injection" },
  { code: "385229008", display: "Oral solution" },
  { code: "420699003", display: "Liquid" },
  { code: "385087003", display: "Suspension" },
  { code: "385108007", display: "Powder" },
  { code: "420768007", display: "Aerosol" },
  { code: "385113006", display: "Transdermal patch" },
  { code: "385124005", display: "Ointment" },
  { code: "385139002", display: "Cream" },
  { code: "385148007", display: "Gel" },
];

const manufacturers = [
  "Pfizer Inc.",
  "Novartis AG",
  "Merck & Co.",
  "Johnson & Johnson",
  "GlaxoSmithKline",
  "Sanofi",
  "AstraZeneca",
  "Teva Pharmaceutical",
  "Mylan N.V.",
  "Sandoz Inc.",
  "Fresenius Kabi",
  "Baxter International",
  "Abbott Laboratories",
  "Bristol-Myers Squibb",
  "Eli Lilly and Company",
];

const statuses = ["active", "inactive", "entered-in-error"];

const strengths = [
  "5 mg",
  "10 mg",
  "20 mg",
  "25 mg",
  "50 mg",
  "100 mg",
  "250 mg",
  "500 mg",
  "1000 mg",
  "2.5 mg",
  "7.5 mg",
  "15 mg",
  "30 mg",
  "40 mg",
  "80 mg",
  "200 mg",
  "300 mg",
  "400 mg",
  "600 mg",
  "800 mg",
];

// Fast random selection helper
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMedication(id: number): any {
  const med = randomItem(medicationNames);
  const doseForm = randomItem(doseForms);
  const status = randomItem(statuses);
  const hasIngredients = Math.random() > 0.3; // 70% have ingredients
  const hasManufacturer = Math.random() > 0.2; // 80% have manufacturer
  const hasMultipleCodings = Math.random() > 0.5; // 50% have multiple code systems

  const codings: any[] = [
    {
      system: "http://www.nlm.nih.gov/research/umls/rxnorm",
      code: med.rxnorm,
      display: med.name,
    },
  ];

  if (hasMultipleCodings) {
    codings.push({
      system: "http://hl7.org/fhir/sid/ndc",
      code: med.ndc,
      display: `${med.name} ${randomItem(strengths)}`,
    });
  }

  const resource: any = {
    resourceType: "Medication",
    id: `med-${id}`,
    status: status,
    code: {
      coding: codings,
      text: med.name,
    },
    form: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: doseForm.code,
          display: doseForm.display,
        },
      ],
    },
  };

  if (hasManufacturer) {
    resource.manufacturer = {
      reference: `Organization/org-${randomInt(1, 100)}`,
      display: randomItem(manufacturers),
    };
  }

  if (hasIngredients) {
    const numIngredients = Math.random() > 0.8 ? 2 : 1; // 20% have 2 ingredients
    resource.ingredient = [];

    for (let i = 0; i < numIngredients; i++) {
      resource.ingredient.push({
        itemCodeableConcept: {
          coding: [
            {
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: `${randomInt(100000, 999999)}`,
              display: i === 0 ? med.name : `${med.name} component ${i + 1}`,
            },
          ],
        },
        strength: {
          numerator: {
            value: parseFloat(randomItem(strengths).split(" ")[0]),
            unit: "mg",
            system: "http://unitsofmeasure.org",
            code: "mg",
          },
          denominator: {
            value: 1,
            unit: randomItem(["tablet", "capsule", "mL"]),
          },
        },
      });
    }
  }

  // 30% have batch information
  if (Math.random() > 0.7) {
    resource.batch = {
      lotNumber: `LOT-${randomInt(1000, 9999)}-${randomInt(10, 99)}`,
      expirationDate: `${randomInt(2025, 2027)}-${String(randomInt(1, 12)).padStart(2, "0")}-${String(randomInt(1, 28)).padStart(2, "0")}`,
    };
  }

  return resource;
}

function generateMedications(count: number, outputPath: string) {
  console.log(`Generating ${count.toLocaleString()} medication resources...`);
  const startTime = Date.now();

  let output = "";
  const batchSize = 10000;
  let batch = "";

  for (let i = 1; i <= count; i++) {
    const med = generateMedication(i);
    batch += JSON.stringify(med) + "\n";

    if (i % batchSize === 0 || i === count) {
      output += batch;
      batch = "";
      if (i % batchSize === 0) {
        console.log(`  Generated ${i.toLocaleString()} resources...`);
      }
    }
  }

  writeFileSync(outputPath, output);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const fileSizeMB = (output.length / (1024 * 1024)).toFixed(2);

  console.log(`\nCompleted in ${duration}s`);
  console.log(`File size: ${fileSizeMB} MB`);
  console.log(`Output: ${outputPath}\n`);
}

// Main execution
console.log("FHIR R4 Medication Resource Generator\n");

// Generate 10K medications
generateMedications(10000, "/home/jmandel/hobby/fhirpathindex/data/medications-10k.ndjson");

// Generate 100K medications
generateMedications(100000, "/home/jmandel/hobby/fhirpathindex/data/medications-100k.ndjson");

console.log("Generation complete!");
