/**
 * FHIRPath Indexer
 *
 * Parses view definitions, extracts FHIRPath expressions,
 * evaluates them against all resources, and materializes
 * results to SQLite.
 */

import * as fhirpath from 'fhirpath';
import * as fhirpath_r4_model from 'fhirpath/fhir-context/r4';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as readline from 'readline';
import YAML from 'yaml';
import type { ViewRegistry, ExpressionToIndex, FhirpathIndexRow, FilterToIndex } from './types';

// Helper to build full path from fhirpath.js internal node
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

// Custom function to extract paths from fhirpath results
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

/**
 * Evaluate a FHIRPath expression and get results with path metadata
 */
function evaluateWithPaths(resource: any, expression: string): Array<{ path: string | null; value: any }> {
  try {
    const results = fhirpath.evaluate(
      resource,
      `(${expression}).getPath()`,
      null,
      fhirpath_r4_model,
      { userInvocationTable: { getPath: getPathFunction } }
    );
    return results;
  } catch (err) {
    console.error(`Error evaluating expression "${expression}":`, err);
    return [];
  }
}

/**
 * Check if expression has unbound variables (starts with %)
 */
function hasUnboundVariables(expression: string): boolean {
  // Match %varname but not %resource (which is bound to current context)
  return /%(?!resource\b)[a-zA-Z]/.test(expression);
}

/**
 * Evaluate a simple FHIRPath expression (without path metadata)
 */
function evaluateSimple(resource: any, expression: string): any {
  try {
    const results = fhirpath.evaluate(
      resource,
      expression,
      null,
      fhirpath_r4_model
    );
    // Return first result or null
    return results.length > 0 ? results[0] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Extract filter values from a result value using FHIRPath expressions
 */
function extractFilterValues(value: any, filters: FilterToIndex[]): Record<string, any> | null {
  if (!filters || filters.length === 0) return null;

  const result: Record<string, any> = {};

  for (const filter of filters) {
    // Evaluate FHIRPath expression on the result value
    const filterValue = evaluateSimple(value, filter.valueExpression);
    if (filterValue !== undefined && filterValue !== null) {
      result[filter.name] = filterValue;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract all FHIRPath expressions from view definitions
 */
function extractExpressions(registry: ViewRegistry): ExpressionToIndex[] {
  const expressions: ExpressionToIndex[] = [];
  const seen = new Set<string>();

  for (const view of registry.views) {
    for (const block of view.blocks) {
      if (block.type === 'markdown') continue;

      const expr = block.expression;

      // Skip expressions with unbound variables - they're for runtime lookup
      if (hasUnboundVariables(expr)) {
        console.log(`  Skipping expression with variables: ${expr}`);
        continue;
      }

      if (!seen.has(expr)) {
        seen.add(expr);

        const toIndex: ExpressionToIndex = {
          id: `expr_${expressions.length}`,
          expression: expr,
        };

        // Extract column projections for table blocks
        if (block.type === 'fhirpath-table' && block.columns) {
          toIndex.projections = block.columns.map(col => ({
            name: col.header,
            path: col.path
          }));
        }

        // Extract filter definitions
        if ('variables' in block && block.variables) {
          const filters: FilterToIndex[] = [];
          for (const v of block.variables) {
            if (v.type === 'filter' && v.valueExpression) {
              filters.push({
                name: v.name,
                valueExpression: v.valueExpression
              });
            }
          }
          if (filters.length > 0) {
            toIndex.filters = filters;
          }
        }

        expressions.push(toIndex);
      }

      // Also extract optionsExpression for filter variables
      if ('variables' in block && block.variables) {
        for (const variable of block.variables) {
          if (variable.optionsExpression && !seen.has(variable.optionsExpression)) {
            seen.add(variable.optionsExpression);
            expressions.push({
              id: `expr_${expressions.length}`,
              expression: variable.optionsExpression
            });
          }
        }
      }
    }
  }

  return expressions;
}

/**
 * Read NDJSON file and yield resources
 */
async function* readNdjson(filePath: string): AsyncGenerator<any> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      yield JSON.parse(line);
    }
  }
}

/**
 * Create and initialize the SQLite database
 */
function initDatabase(dbPath: string): Database {
  // Remove existing db
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);

  // Create main index table
  db.exec(`
    CREATE TABLE fhirpath_index (
      expression_id TEXT NOT NULL,
      source_resource_id TEXT NOT NULL,
      source_resource_type TEXT NOT NULL,
      source_path TEXT,
      value_json TEXT NOT NULL,
      filter_values_json TEXT
    );

    CREATE INDEX idx_expression ON fhirpath_index(expression_id);
    CREATE INDEX idx_resource ON fhirpath_index(source_resource_id);
    CREATE INDEX idx_type ON fhirpath_index(source_resource_type);
  `);

  // Create expressions metadata table
  db.exec(`
    CREATE TABLE expressions (
      id TEXT PRIMARY KEY,
      expression TEXT NOT NULL,
      projections_json TEXT
    );
  `);

  // Create views metadata table
  db.exec(`
    CREATE TABLE views (
      id TEXT PRIMARY KEY,
      definition_json TEXT NOT NULL
    );
  `);

  return db;
}

/**
 * Main indexing function
 */
async function runIndexer(
  ndjsonPath: string,
  viewsPath: string,
  outputDbPath: string
) {
  console.log('=== FHIRPath Indexer ===\n');

  // Load view definitions
  console.log(`Loading views from ${viewsPath}...`);
  const viewsYaml = fs.readFileSync(viewsPath, 'utf-8');
  const registry: ViewRegistry = YAML.parse(viewsYaml);
  console.log(`  Found ${registry.views.length} views\n`);

  // Extract expressions to index
  const expressions = extractExpressions(registry);
  console.log(`Extracted ${expressions.length} unique expressions to index:`);
  for (const expr of expressions) {
    console.log(`  [${expr.id}] ${expr.expression.substring(0, 60)}${expr.expression.length > 60 ? '...' : ''}`);
  }
  console.log();

  // Initialize database
  console.log(`Creating database at ${outputDbPath}...`);
  const db = initDatabase(outputDbPath);

  // Store expressions metadata
  const insertExpr = db.prepare(
    'INSERT INTO expressions (id, expression, projections_json) VALUES (?, ?, ?)'
  );
  for (const expr of expressions) {
    insertExpr.run(
      expr.id,
      expr.expression,
      expr.projections ? JSON.stringify(expr.projections) : null
    );
  }

  // Store view definitions
  const insertView = db.prepare(
    'INSERT INTO views (id, definition_json) VALUES (?, ?)'
  );
  for (const view of registry.views) {
    insertView.run(view.id, JSON.stringify(view));
  }

  // Prepare insert statement for index rows
  const insertIndex = db.prepare(`
    INSERT INTO fhirpath_index (
      expression_id, source_resource_id, source_resource_type, source_path, value_json, filter_values_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Process resources
  console.log(`\nProcessing resources from ${ndjsonPath}...`);
  let resourceCount = 0;
  let rowCount = 0;
  const startTime = Date.now();

  // Use transaction for better performance
  const insertMany = db.transaction((rows: FhirpathIndexRow[]) => {
    for (const row of rows) {
      insertIndex.run(
        row.expression_id,
        row.source_resource_id,
        row.source_resource_type,
        row.source_path,
        row.value_json,
        row.filter_values_json
      );
    }
  });

  let batch: FhirpathIndexRow[] = [];
  const BATCH_SIZE = 1000;

  for await (const resource of readNdjson(ndjsonPath)) {
    resourceCount++;

    if (resourceCount % 1000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`  Processed ${resourceCount} resources (${rowCount} index rows, ${elapsed.toFixed(1)}s)`);
    }

    // Evaluate each expression against this resource
    for (const expr of expressions) {
      const results = evaluateWithPaths(resource, expr.expression);

      for (const result of results) {
        // Compute filter values if this expression has filters
        const filterValues = expr.filters
          ? extractFilterValues(result.value, expr.filters)
          : null;

        const row: FhirpathIndexRow = {
          expression_id: expr.id,
          source_resource_id: resource.id || 'unknown',
          source_resource_type: resource.resourceType || 'unknown',
          source_path: result.path || '',
          value_json: JSON.stringify(result.value),
          filter_values_json: filterValues ? JSON.stringify(filterValues) : null
        };

        batch.push(row);
        rowCount++;

        if (batch.length >= BATCH_SIZE) {
          insertMany(batch);
          batch = [];
        }
      }
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    insertMany(batch);
  }

  // Create additional indexes after bulk insert
  console.log('\nCreating additional indexes...');
  db.exec(`
    CREATE INDEX idx_expr_type ON fhirpath_index(expression_id, source_resource_type);
  `);

  db.close();

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n=== Complete ===`);
  console.log(`  Resources processed: ${resourceCount}`);
  console.log(`  Index rows created: ${rowCount}`);
  console.log(`  Total time: ${totalTime.toFixed(1)}s`);
  console.log(`  Rate: ${(resourceCount / totalTime).toFixed(0)} resources/sec`);
  console.log(`  Output: ${outputDbPath}`);

  // Report file size
  const stats = fs.statSync(outputDbPath);
  console.log(`  Database size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: bun run src/indexer.ts <resources.ndjson> <views.yaml> <output.db>');
  console.log('\nExample:');
  console.log('  bun run src/indexer.ts data/medications-10k.ndjson views/medications.yaml output/index-10k.db');
  process.exit(1);
}

runIndexer(args[0], args[1], args[2]).catch(err => {
  console.error('Indexer failed:', err);
  process.exit(1);
});
