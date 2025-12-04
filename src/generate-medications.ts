#!/usr/bin/env bun

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import * as readline from "readline";
import { createReadStream } from "fs";

const ROOT = dirname(dirname(import.meta.path));

// RxNorm term type to SNOMED dose form mapping
const formMapping: Record<string, { code: string; display: string }> = {
  Tab: { code: "385055001", display: "Tablet" },
  Cap: { code: "385049006", display: "Capsule" },
  Sol: { code: "385023001", display: "Solution" },
  Susp: { code: "385087003", display: "Suspension" },
  Cream: { code: "385139002", display: "Cream" },
  Ointment: { code: "385124005", display: "Ointment" },
  Gel: { code: "385148007", display: "Gel" },
  Lotion: { code: "385101003", display: "Lotion" },
  Spray: { code: "421606006", display: "Spray" },
  "Prefilled Syringe": { code: "385052003", display: "Prefilled syringe" },
  Pwdr: { code: "385108007", display: "Powder" },
  Suppository: { code: "385194003", display: "Suppository" },
  "Medicated Pad": { code: "385118009", display: "Medicated pad" },
  "Medicated Shampoo": { code: "385110009", display: "Shampoo" },
  "Medicated Liquid Soap": { code: "421079001", display: "Soap" },
  Mouthwash: { code: "385116000", display: "Mouthwash" },
  Oil: { code: "385101003", display: "Oil" },
  Foam: { code: "385134001", display: "Foam" },
  Gas: { code: "385064001", display: "Gas" },
  "Irrig Sol": { code: "385116000", display: "Irrigation solution" },
  Toothpaste: { code: "385115001", display: "Toothpaste" },
  MDI: { code: "420768007", display: "Aerosol" },
  Patch: { code: "385113006", display: "Transdermal patch" },
  Enema: { code: "385089000", display: "Enema" },
  Film: { code: "385107002", display: "Film" },
  Wafer: { code: "385105005", display: "Wafer" },
  Lozenge: { code: "385106006", display: "Lozenge" },
  Pellet: { code: "385108007", display: "Pellet" },
  Implant: { code: "385112001", display: "Implant" },
};

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
  "Aurobindo Pharma",
  "Sun Pharmaceutical",
  "Cipla Ltd.",
  "Hikma Pharmaceuticals",
  "Amneal Pharmaceuticals",
];

const statuses: Array<"active" | "inactive" | "entered-in-error"> = [
  "active",
  "active",
  "active",
  "active",  // 80% active
  "inactive",
];

interface RxNormEntry {
  code: string;
  display: string;
  form: string;
  strength: string | null;
  ingredients: string[];
}

// Load RxNorm source data
async function loadRxNormData(filePath: string): Promise<RxNormEntry[]> {
  const entries: RxNormEntry[] = [];
  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        // Skip invalid lines
      }
    }
  }

  return entries;
}

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Parse strength string like "5 MG / 25 MG / 40 MG" or "0.05 MG/MG" into components
function parseStrength(
  strengthStr: string | null
): Array<{ value: number; unit: string }> {
  if (!strengthStr) return [];

  const parts = strengthStr.split(" / ");
  return parts.map((part) => {
    // Handle formats like "5 MG", "0.05 MG/MG", "100 MG/ML", "50000 UNT/ML"
    const match = part.match(/^([\d.]+)\s*(\S+)/);
    if (match) {
      return { value: parseFloat(match[1]), unit: match[2] };
    }
    return { value: 1, unit: "unit" };
  });
}

// Extract drug name from display string
function extractDrugName(display: string): string {
  // Remove strength info to get just the drug name
  // e.g., "metformin HCl 500 MG Oral Tablet" -> "metformin HCl"
  const parts = display.split(/\d+/);
  if (parts[0]) {
    return parts[0].trim();
  }
  return display.split(" ").slice(0, 2).join(" ");
}

function generateMedication(
  id: number,
  rxnormEntry: RxNormEntry
): Record<string, unknown> {
  const status = randomItem(statuses);
  const hasManufacturer = Math.random() > 0.3; // 70% have manufacturer
  const hasBatch = Math.random() > 0.7; // 30% have batch

  // Get SNOMED form from RxNorm form abbreviation
  const snomedForm = formMapping[rxnormEntry.form] || {
    code: "385055001",
    display: "Tablet",
  };

  const drugName = extractDrugName(rxnormEntry.display);

  const resource: Record<string, unknown> = {
    resourceType: "Medication",
    id: `med-${id}`,
    status: status,
    code: {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: rxnormEntry.code,
          display: rxnormEntry.display,
        },
      ],
      text: rxnormEntry.display,
    },
    form: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: snomedForm.code,
          display: snomedForm.display,
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

  // Add ingredients from RxNorm data
  if (rxnormEntry.ingredients && rxnormEntry.ingredients.length > 0) {
    const strengths = parseStrength(rxnormEntry.strength);

    resource.ingredient = rxnormEntry.ingredients.map((ingredientCode, idx) => {
      const strength = strengths[idx] || strengths[0] || { value: 10, unit: "mg" };

      return {
        itemCodeableConcept: {
          coding: [
            {
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: ingredientCode,
              display: drugName,
            },
          ],
        },
        strength: {
          numerator: {
            value: strength.value,
            unit: strength.unit,
            system: "http://unitsofmeasure.org",
            code: strength.unit.toLowerCase(),
          },
          denominator: {
            value: 1,
            unit: snomedForm.display.toLowerCase(),
          },
        },
      };
    });
  }

  if (hasBatch) {
    resource.batch = {
      lotNumber: `LOT-${randomInt(1000, 9999)}-${randomInt(10, 99)}`,
      expirationDate: `${randomInt(2025, 2027)}-${String(randomInt(1, 12)).padStart(2, "0")}-${String(randomInt(1, 28)).padStart(2, "0")}`,
    };
  }

  return resource;
}

async function generateMedications(
  rxnormData: RxNormEntry[],
  count: number,
  outputPath: string
) {
  console.log(`Generating ${count.toLocaleString()} medication resources...`);
  const startTime = Date.now();

  let output = "";
  const batchSize = 10000;
  let batch = "";

  for (let i = 1; i <= count; i++) {
    // Cycle through RxNorm data, with randomization for variety
    const rxnormIndex = (i - 1) % rxnormData.length;
    const rxnormEntry = rxnormData[rxnormIndex];

    const med = generateMedication(i, rxnormEntry);
    batch += JSON.stringify(med) + "\n";

    if (i % batchSize === 0 || i === count) {
      output += batch;
      batch = "";
      if (i % batchSize === 0) {
        console.log(`  Generated ${i.toLocaleString()} resources...`);
      }
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const fileSizeMB = (output.length / (1024 * 1024)).toFixed(2);

  console.log(`\nCompleted in ${duration}s`);
  console.log(`File size: ${fileSizeMB} MB`);
  console.log(`Output: ${outputPath}\n`);
}

// Main execution
async function main() {
  console.log("FHIR R4 Medication Resource Generator (using RxNorm data)\n");

  // Load RxNorm source data
  const rxnormPath = join(ROOT, "data/rxnorm-source.jsonl");
  console.log(`Loading RxNorm data from ${rxnormPath}...`);

  const rxnormData = await loadRxNormData(rxnormPath);
  console.log(`Loaded ${rxnormData.length.toLocaleString()} RxNorm entries\n`);

  // Shuffle to get variety
  rxnormData.sort(() => Math.random() - 0.5);

  // Generate 10K medications
  await generateMedications(
    rxnormData,
    10000,
    join(ROOT, "data/medications-10k.ndjson")
  );

  // Generate 100K medications
  await generateMedications(
    rxnormData,
    100000,
    join(ROOT, "data/medications-100k.ndjson")
  );

  console.log("Generation complete!");
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
