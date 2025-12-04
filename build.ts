/**
 * Build script for GitHub Pages deployment
 *
 * Generates data, indexes it, and assembles dist/ folder
 */

import { mkdir, cp, rm, exists } from 'fs/promises';
import { join } from 'path';

const ROOT = import.meta.dir;
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'data');
const OUTPUT = join(ROOT, 'output');

async function run(cmd: string, description: string) {
  console.log(`\n=> ${description}`);
  const proc = Bun.spawn(['sh', '-c', cmd], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed with exit code ${exitCode}: ${cmd}`);
  }
}

async function build() {
  console.log('=== FHIRPath Index Build ===\n');

  // Clean dist
  if (await exists(DIST)) {
    await rm(DIST, { recursive: true });
  }
  await mkdir(DIST, { recursive: true });

  // Ensure data directory exists
  if (!await exists(DATA)) {
    await mkdir(DATA, { recursive: true });
  }

  // Ensure output directory exists
  if (!await exists(OUTPUT)) {
    await mkdir(OUTPUT, { recursive: true });
  }

  // Generate medications if not present
  const has10k = await exists(join(DATA, 'medications-10k.ndjson'));
  if (!has10k) {
    await run('bun run src/generate-medications.ts', 'Generating medication data');
  } else {
    console.log('=> Medication data already exists, skipping generation');
  }

  // Run indexer for 10k dataset (faster for demo, use 100k for full)
  await run(
    'bun run src/indexer.ts data/medications-10k.ndjson views/medications.yaml output/index.db',
    'Indexing medications with FHIRPath'
  );

  // Copy web assets to dist
  console.log('\n=> Copying web assets to dist/');
  await cp(join(ROOT, 'web'), DIST, { recursive: true });

  // Copy database to dist
  console.log('=> Copying database to dist/');
  await cp(join(OUTPUT, 'index.db'), join(DIST, 'index.db'));

  // Get file sizes
  const dbFile = Bun.file(join(DIST, 'index.db'));
  const htmlFile = Bun.file(join(DIST, 'index.html'));

  console.log('\n=== Build Complete ===');
  console.log(`  dist/index.html: ${(htmlFile.size / 1024).toFixed(1)} KB`);
  console.log(`  dist/index.db: ${(dbFile.size / 1024 / 1024).toFixed(1)} MB`);
  console.log('\nReady for deployment to GitHub Pages!');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
