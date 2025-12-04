/**
 * View definition schema for FHIRPath-indexed static IG viewer
 */

// A variable that can be used in FHIRPath expressions
export interface ViewVariable {
  name: string;
  type: "filter" | "param";  // filter = dropdown, param = URL param
  label?: string;
  // FHIRPath to get distinct values for dropdown (only for filter type)
  optionsExpression?: string;
  // FHIRPath expression evaluated on each result to get filter value
  // e.g., "status" or "form.coding.first().display"
  valueExpression?: string;
  defaultValue?: string;
}

// A column projection for table/list views
export interface ViewColumn {
  header: string;
  // FHIRPath relative to each result item
  path: string;
  // Optional link template, e.g., "/medication-detail?id={{id}}"
  link?: string;
}

// Block types that can appear in a view
export type ViewBlock =
  | MarkdownBlock
  | FhirpathTableBlock
  | FhirpathListBlock
  | FhirpathSingleBlock;

export interface MarkdownBlock {
  type: "markdown";
  content: string;
}

export interface FhirpathTableBlock {
  type: "fhirpath-table";
  // Title shown above the table
  title?: string;
  // Description of what this block shows
  description?: string;
  // FHIRPath expression to select resources/elements
  expression: string;
  // Variables that can be used in the expression
  variables?: ViewVariable[];
  // Columns to display
  columns: ViewColumn[];
  // Pagination settings
  pageSize?: number;
}

export interface FhirpathListBlock {
  type: "fhirpath-list";
  expression: string;
  variables?: ViewVariable[];
  // Template for each item (simple string interpolation)
  itemTemplate: string;
  pageSize?: number;
}

export interface FhirpathSingleBlock {
  type: "fhirpath-single";
  expression: string;
  variables?: ViewVariable[];
  // Named template to render the single result
  template: string;
}

// A view/page definition
export interface ViewDefinition {
  id: string;
  title: string;
  // URL params this view accepts
  params?: string[];
  blocks: ViewBlock[];
}

// The full view registry
export interface ViewRegistry {
  views: ViewDefinition[];
}

// SQLite index schema types
export interface FhirpathIndexRow {
  expression_id: string;
  source_resource_id: string;
  source_resource_type: string;
  source_path: string;
  value_json: string;
  filter_values_json: string | null; // JSON object {filterName: filterValue, ...}
}

// Filter definition for indexing
export interface FilterToIndex {
  name: string;
  // FHIRPath expression evaluated on each result item to get filter value
  valueExpression: string;
}

// Extracted expression info for indexing
export interface ExpressionToIndex {
  id: string;
  expression: string;
  // Column projections to also index
  projections?: { name: string; path: string }[];
  // Filters to compute for each result
  filters?: FilterToIndex[];
}
