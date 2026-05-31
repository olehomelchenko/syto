# Syto — Data Specification

> **Related Documentation**:
>
> - **[SPECIFICATION.md](SPECIFICATION.md)**: Technical architecture and codebase map
> - **[DEVELOPMENT-PATTERNS.md](DEVELOPMENT-PATTERNS.md)**: How to add transforms, testing, state management
> - **[FUNCTION-DOCS-SYSTEM.md](FUNCTION-DOCS-SYSTEM.md)**: Auto-generated function documentation system
> - **[FUTURE-PROOFING.md](FUTURE-PROOFING.md)**: Schema evolution and compatibility constraints
> - **[TRANSFORM-ARCHITECTURE-REVIEW.md](TRANSFORM-ARCHITECTURE-REVIEW.md)**: Transform design analysis, gaps, and proposed additions

This document describes how data is structured, stored, and serialized in Syto.

---

## 1. Core Data Structures

### 1.1 Source

A **Source** represents imported raw data before any transformations.

```typescript
interface Source {
  id: string; // Unique identifier (e.g., "src_abc123")
  name: string; // Display name
  fileName?: string; // Original filename if imported from file
  columns: ColumnSchema[]; // Column definitions with types
  data: DataRow[] | null; // Row data (null = not yet loaded from IndexedDB)
  headerMode: 'first-row' | 'auto-generate' | 'manual';
  delimiter: string; // CSV delimiter used
  customHeaders: string[] | null;
  origin: string; // Import source (file, clipboard, url)
  schema?: ColumnSchema[]; // Duplicate of columns (legacy)
  rawSize?: number; // Original file size in bytes
  rowCount?: number; // Number of rows (available even when data is not loaded)
  colCount?: number; // Number of columns (available even when data is not loaded)
  createdAt?: string; // ISO timestamp
  comment?: string; // User-provided comment/notes about the dataset
  rawText?: string; // Original text for sources created via text entry (enables re-editing)
  backup?: Omit<Source, 'backup'>; // Snapshotted previous version of the source
}
```

### 1.2 Model

A **Model** represents a transformation pipeline applied to a Source.

```typescript
interface Model {
  id: string; // Unique identifier (e.g., "mdl_xyz789")
  name: string; // Display name
  sourceId: string; // Reference to parent Source.id or Model.id (model chaining)
  steps: TransformStep[]; // Ordered transformation pipeline
  schema: ColumnSchema[]; // Current column definitions (after transforms)
  data: DataRow[] | null; // Computed result data (null = not yet loaded from IndexedDB)
  rowCount?: number; // Number of rows (available even when data is not loaded)
  colCount?: number; // Number of columns (available even when data is not loaded)
  stats?: EDAStats | null; // Cached EDA statistics for selected column
  isStale?: boolean; // True if a dependency changed but model not yet recomputed
  comment?: string; // User-provided comment/notes about the model
}
```

### 1.3 Non-Destructive Data Model

Syto employs a non-destructive data model where the **Source** (raw data) is immutable. Any transformation applied by the user is stored as a `TransformStep` within a **Model**.

This architecture ensures:

- **Zero Data Loss**: The original dataset is never modified or overwritten.
- **Full Traceability**: Every change is a discrete, inspectable step in a pipeline.
- **State Reversal**: Users can "roll back" by removing steps or editing previous ones, causing the model to recompute from the original source.
- **Data Replacement & Backups**: While sources can be updated with new data (e.g., refreshing a CSV), Syto maintains a one-level `.backup` of the previous source data and metadata. This allows users to restore the previous state if the new data schema causes downstream model failures. Restoring a backup is a "swap" operation, enabling both undo and redo of the replacement.

### 1.4 DataRow

A **DataRow** is a generic object representing one row of tabular data.

```typescript
type DataRow = Record<string, any>;

// Example:
{ "name": "Alice", "age": 30, "active": true }
```

### 1.5 Null Semantics

Syto uses `null` to represent missing data — never `undefined`. This is universal across import, transforms, expressions, aggregates, and joins. Per SOUL §7 ("Predictable, Not Clever"), every operation that could plausibly produce `undefined` (Arquero rollup of an empty group, unmatched join cell, etc.) is normalised to `null` at the engine boundary.

Contracts that follow from "null is a value, not absence of a value":

- **Group-by**: rows with `null` in a groupby column form their own group, like SQL standard. Pinned in `transforms-aggregate.test.ts` (`CONTRACT: nulls in groupby form their own group`).
- **Join keys**: `null` does not match `null`, like SQL standard. Null-keyed rows are dropped from inner/semi joins; kept as unmatched in left/right/full/anti/lookup. Pinned in `transforms-join.test.ts` under "Null-in-join-keys contract". The dialog warns when a candidate key column contains nulls.
- **Aggregate of all-null**: `sum`/`mean`/`min`/`max`/`median` of an all-null column return `null` (not `undefined`, not `0`). `valid` and `distinct` keep their integer semantics.
- **Type inference**: `null`, `undefined`, and empty strings are excluded from pattern matching when inferring column types (see §2.3.5).

---

## 2. Column Schema

### 2.1 ColumnSchema Interface

```typescript
interface ColumnSchema {
  name: string; // Column name
  type: ColumnType; // Inferred or assigned type
  format?: Record<string, any>; // Reserved for future metadata
  originalPosition?: number; // Column order from import
}
```

### 2.2 Column Types

```typescript
type ColumnType = 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'json';
```

| Type       | Description          | Example Values                  |
| ---------- | -------------------- | ------------------------------- |
| `string`   | Text data            | `"hello"`, `"Product A"`        |
| `integer`  | Whole numbers        | `42`, `-7`, `0`                 |
| `float`    | Decimal numbers      | `3.14`, `-0.5`                  |
| `boolean`  | True/false           | `true`, `false`                 |
| `date`     | Date without time    | `"2024-01-15"`                  |
| `datetime` | Date with time       | `"2024-01-15T10:30:00"`         |
| `json`     | Serialized JSON data | `'{"name":"Alice"}'`, `'[1,2]'` |

### 2.3 Type System: Physical vs Logical Types

Syto distinguishes between **physical types** (what the parser returns) and **logical types** (what's used for data wrangling).

#### 2.3.1 Physical Types (Import Types)

When a dataset is imported, **physical types** are extracted based on what the parser returns:

- **Source**: PapaParse with `dynamicTyping: true` (CSV) or `JSON.parse` (JSON)
- **Sample size**: First **20 rows** of each column
- **Implementation**: `SchemaEngine.createPhysicalSchema()`
- **Result**: Stored in `Source.columns` as `ColumnSchema[]`
- **UI Label**: "Import Types" in Dataset Info View

**Physical Type Detection:**

For CSV with `dynamicTyping: true`:

- JavaScript `number` → `integer` or `float` (based on `Number.isInteger()`)
- JavaScript `boolean` → `boolean`
- Everything else (including date strings like `"2024-01-15"`) → `string`

For JSON:

- JavaScript `number` → `integer` or `float`
- JavaScript `boolean` → `boolean`
- JavaScript `object` (non-null, non-Date) → `json`
- JavaScript `string` → `string`
- `null`/`undefined` → `string` (fallback)

**Key Point**: Physical types reflect what PapaParse/JSON.parse gives us after `dynamicTyping`. **No pattern-based inference** is applied at the dataset level. Dates remain as strings because CSV/JSON formats don't have native date types.

#### 2.3.2 Logical Types (Data Types)

When a model is created from a dataset, **logical types** are inferred from the data:

- **Timing**: First `types` transform step in the model pipeline
- **Sample size**: First **20 rows** of each column
- **Implementation**: `SchemaEngine.inferType()` (see algorithm below)
- **Result**: Stored in model's first `types` step, then propagated to `Model.schema`
- **UI Label**: "Data Types" in Model Info View

**This is where type inference happens** - pattern matching converts:

- String `"2024-01-15"` → logical type `date`
- String `"123"` → logical type `integer`
- String `"true"` → remains `string` (unless it's already a boolean from `dynamicTyping`)

#### 2.3.3 Transform Propagation

When transforms are applied, schema is recalculated:

- **Sample size**: Up to **100 rows** of result data
- **Implementation**: `SchemaEngine.deriveNextSchema()`
- **Triggers**:
  - New columns created (e.g., `derive`, `split`)
  - Aggregation operations change types
  - User applies `types` transform with explicit type assignments
- **Result**: Updated `Model.schema`

#### 2.3.4 Auto-Detect Feature

The "Auto-Detect Types" button re-infers logical types for all columns in current model view:

- **Sample size**: First **50 rows**
- **Implementation**: `autoDetectSchema()` handler
- **Effect**: Creates a new `types` transform step with re-inferred logical types

#### 2.3.5 Logical Type Inference Algorithm

Types are inferred using pattern matching with the following priority order:

1. **Boolean**: All non-null values are JavaScript `boolean` type (`true` or `false`)
2. **Integer**: All non-null values are JavaScript `number` type and are whole numbers
3. **Float**: All non-null values are JavaScript `number` type (includes decimals)
4. **Numeric Strings**: All non-null values are strings that parse cleanly as numbers (e.g., `"123"`, `"45.67"`, `"1e10"`)
   - Trimmed and validated with `Number()`, excluding `NaN` and `Infinity`
   - Returns `integer` if all parse as whole numbers, `float` otherwise
   - Scientific notation is accepted (`"1e10"` → integer; `"1.5e-3"` → float). Round-trip is lossy: the textual form is replaced by the numeric value's default `toString()`. Overflow forms like `"1e500"` parse to `Infinity` and fall through to `string`.
5. **JSON**: All non-null string values look like JSON (`{...}` or `[...]`) and at least one parses successfully
6. **DateTime**: All non-null string values match regex:
   - ISO format: `YYYY-MM-DDTHH:MM:SS...`
   - SQL format: `YYYY-MM-DD HH:MM:SS...`
7. **Date**: All non-null string values match one of:
   - ISO format: `YYYY-MM-DD` or `YYYY/MM/DD`
   - American format: `MM/DD/YYYY` or `M/D/YYYY`
8. **String**: Default fallback for all other cases

**Null handling**: `null`, `undefined`, and empty strings (`""`) are excluded from pattern matching during inference.

#### 2.3.6 Type Conversion

When a `types` transform is applied, values are converted to the target logical type:

- **Implementation**: `convertType()` in `type-converter.ts`
- **Error handling**: Failed conversions create error objects (Power Query-style) rather than throwing exceptions
- **Null/empty strings**: Handled intelligently per target type
  - Dates: convert to `null`
  - Numbers: create error object for empty strings
  - Strings: preserve as-is
- **Examples**:
  - String `"123"` → Integer `123`
  - String `"true"` → Boolean `true`
  - String `"2024-01-15"` → Date object
  - String `"abc"` → Integer conversion error object

#### 2.3.7 Type System Summary

**Clear separation between physical and logical types:**

| Aspect           | Physical Types (Datasets)           | Logical Types (Models)                  |
| ---------------- | ----------------------------------- | --------------------------------------- |
| **What**         | Parser output after `dynamicTyping` | Inferred types for data wrangling       |
| **When**         | During CSV/JSON import              | In model's first `types` step           |
| **How**          | JavaScript type detection           | Pattern matching (dates, numbers, etc.) |
| **Where Stored** | `Source.columns`                    | `Model.schema` (via `types` step)       |
| **UI Label**     | "Import Types"                      | "Data Types"                            |
| **Example**      | `"2024-01-15"` → `string`           | `"2024-01-15"` → `date`                 |

**Why this separation matters:**

1. **Clarity**: Datasets show what was actually imported (physical reality)
2. **Provenance**: You can see the raw data types before inference
3. **Flexibility**: Type inference decisions are visible and modifiable in the model's first step
4. **Correctness**: CSV/JSON truly don't have date types - now this is represented accurately

**Data Flow:**

```
CSV File → PapaParse (dynamicTyping) → Physical Types (dataset) →
Inference → Logical Types (model's first types step) → Data Wrangling
```

#### 2.3.8 JSON Type: Design Rationale

The `json` column type follows the same pattern as `date`/`datetime` — it's a **schema annotation on string data**, not a different storage mechanism. All types in the system store values as JavaScript primitives (strings, numbers, booleans, null); the type metadata tells the UI and transforms what operations are meaningful.

**What `json` as a type provides:**

- **UI signaling**: The `{}` badge in `TypeIndicator` tells users a column contains structured data
- **Type conversion validation**: Casting a column to `json` validates that values parse as valid JSON
- **Semantic intent**: Signals that `spread`, `unroll`, and `json_*` expression functions are relevant operations

**What `json` does NOT provide:**

- Expression functions (`json_extract`, `json_keys`, etc.) operate on any string containing valid JSON regardless of column type — they inspect runtime values, not schema metadata
- `spread`/`unroll` transforms also inspect runtime values (`checkIfNeedsJsonParsing`) rather than checking the schema type

**Dual representation (by design):**

JSON columns can hold either serialized JSON strings or native JS objects:

- **Serialized strings**: From CSV import, JSON import with `serializeNested: true`, or type conversion. Expression functions (`json_extract`, etc.) work correctly on these via `JSON.parse(String(value))`.
- **Native JS objects**: From JSON import with `serializeNested: false`, or from expressions like `json_extract()` returning a nested object. Arquero `spread`/`unroll` work directly on these without parsing.

This dual representation was considered for unification (always serialize to strings), but rejected because:

1. `json_extract()` navigating to a nested path returns native objects — auto-stringifying the result would be surprising and would require a serialization pass after every derive step
2. The current code handles both representations where they appear (`spread`/`unroll` check for strings and parse when needed)
3. No bugs have been observed from the dual representation in practice

**Type promotion**: When `json` is mixed with any other type in `promoteTypes()`, the result is `string`.

---

## 3. Data Generation

Syto includes a synthetic data generator for creating test datasets and illustrative examples without external files.

### 3.1 Generator Configuration

Data is generated by defining one or more **Column Generators**.

```typescript
interface ColumnGenerator {
  name: string;
  type: GeneratorType;
  config: GeneratorConfig;
}

type GeneratorType =
  | 'numberSequence'
  | 'dateSequence'
  | 'randomNumber'
  | 'randomDate'
  | 'randomBoolean'
  | 'randomCategory';
```

### 3.2 Generator Types

| Generator Type   | Purpose                                      | Key Parameters                         |
| ---------------- | -------------------------------------------- | -------------------------------------- |
| `numberSequence` | Linear numeric sequence (e.g., ID, Year)     | `start`, `step`, `stop`, `decimals`    |
| `dateSequence`   | Chronological sequence (e.g., Daily series)  | `start`, `increment`, `unit`, `stop`   |
| `randomNumber`   | Random numeric values within range           | `min`, `max`, `decimals`               |
| `randomDate`     | Random dates within a temporal range         | `from`, `to`                           |
| `randomBoolean`  | True/False values with weighted probability  | `trueProbability`                      |
| `randomCategory` | Random selection from a list of fixed values | `values`, `weights` (optional weights) |

### 3.3 Dynamic Row Count

The generator supports both fixed row counts and **auto-calculated** row counts derived from sequence constraints:

- **Manual**: User specifies exactly how many rows to generate (max 100,000).
- **Auto**: If a sequence generator (number or date) has a `stop` value, the total row count is automatically calculated to satisfy the full range.

### 3.4 Data Types & Schema

Generated columns are assigned physical types based on their generator configuration:

- `numberSequence` / `randomNumber` with 0 decimals → `integer`
- `numberSequence` / `randomNumber` with >0 decimals → `float`
- `dateSequence` / `randomDate` with time components → `datetime`
- `dateSequence` / `randomDate` without time → `date`
- `randomBoolean` → `boolean`
- `randomCategory` → `string`

---

## 4. Transform Steps

### 4.1 TransformStep Interface

Each step in a pipeline is a single-key object. Only one transform type per step.

```typescript
interface TransformStep {
  // Column operations
  select?: string[];
  remove?: string[];
  rename?: Record<string, string>;

  // Row operations
  filter?: string;                    // Expression string
  sort?: { field: string; order: 'asc' | 'desc' }   // Single field
      | Array<{ field: string; order: 'asc' | 'desc' }>;  // Multi-field
  dedupe?: { columns?: string[]; mode?: 'remove' | 'keep' };
  sliceRows?: { count: number; mode: 'first' | 'last' | 'removeFirst' | 'removeLast' };
  removeRows?: { indices: number[] };   // Remove specific rows by index
  keepRows?: { indices: number[] };     // Keep only specific rows by index

  // Value operations
  derive?: Record<string, string>;    // column -> expression
  replace?: { column: string; find: any; replace: any; isRegex?: boolean; matchMode?: 'errors' | 'null' };
  types?: Record<string, ColumnType>;
  addIndex?: { columnName: string; startFrom?: number };

  // Reshape operations
  aggregate?: { groupby: string[]; rollup: Record<string, string> };
  describe?: { columns: string[] };
  fold?: { columns: string[]; as: [string, string] };
  pivot?: { rows?: string[]; keys: string; values: string; aggregation: string; options?: {...} };
  split?: { column: string; mode: string; delimiter: string; ... };
  spread?: { column: string; limit?: number; keepOriginal?: boolean };
  unroll?: { column: string; indices?: boolean; keepOriginal?: boolean };

  // Multi-model operations
  join?: { right: string; on: [string, string][]; how: string; suffixes?: [string, string] };
  concat?: { with: string; columns?: string[]; targetColumns?: string[] };
  union?: { with: string; columns?: string[]; targetColumns?: string[] };
  semijoin?: { right: string; on: [string, string][] };
  antijoin?: { right: string; on: [string, string][] };
  lookup?: { right: string; on: [string, string][]; values: string[] };

  // Advanced operations
  impute?: { column: string; strategy: string; value?: any };
  sample?: { count: number; seed?: number };

  // Window operations
  window?: {
    orderBy: Array<{ field: string; order: 'asc' | 'desc' }>;
    partitionBy?: string[];
    derive: Record<string, string>;  // column -> op.func() expression
    frames?: Record<string, [number | null, number | null]>;  // per-column window frame
  };
}
```

### 3.2 Transform Examples

**Filter** — Keep rows matching expression:

```json
{ "filter": "sales > 1000 && region == 'North'" }
```

**Derive** — Add calculated columns:

```json
{ "derive": { "profit": "revenue - cost", "margin": "profit / revenue * 100" } }
```

**Replace** — Replace values in a column:

```json
{ "replace": { "column": "status", "find": "active", "replace": "ACTIVE" } }
```

With regex pattern (e.g., format phone numbers):

```json
{
  "replace": {
    "column": "phone",
    "find": "(\\d{3})-(\\d{4})",
    "replace": "($1) $2",
    "isRegex": true
  }
}
```

Replace conversion errors or null values (`matchMode` skips `find`/`isRegex`):

```json
{ "replace": { "column": "price", "replace": "0", "matchMode": "errors" } }
{ "replace": { "column": "name", "replace": "Unknown", "matchMode": "null" } }
```

**Remove Rows** — Remove specific rows by index:

```json
{ "removeRows": { "indices": [0, 3, 7] } }
```

**Keep Rows** — Keep only specific rows by index:

```json
{ "keepRows": { "indices": [1, 2, 5] } }
```

**Aggregate** — Group and summarize:

```json
{
  "aggregate": {
    "groupby": ["region", "category"],
    "rollup": {
      "total_sales": "op.sum('sales')",
      "avg_price": "op.mean('price')",
      "count": "op.count()"
    }
  }
}
```

**Describe** — Summary statistics (count, mean, median, stdev, min, max) for selected columns. Output is transposed: statistics as rows, columns as columns.

```json
{ "describe": { "columns": ["sales", "revenue"] } }
```

**Window** — Apply window functions with ordering and optional partitioning:

```json
{
  "window": {
    "orderBy": [{ "field": "date", "order": "asc" }],
    "partitionBy": ["category"],
    "derive": {
      "prev_value": "op.lag('value', 1)",
      "next_value": "op.lead('value', 1)",
      "row_num": "op.row_number()",
      "rank": "op.rank()"
    }
  }
}
```

Cumulative aggregate example (running sum per category):

```json
{
  "window": {
    "orderBy": [{ "field": "date", "order": "asc" }],
    "partitionBy": ["category"],
    "derive": {
      "cumulative_revenue": "op.sum('revenue')",
      "running_avg_price": "op.mean('price')"
    }
  }
}
```

Rolling window example (3-row moving average):

```json
{
  "window": {
    "orderBy": [{ "field": "date", "order": "asc" }],
    "derive": {
      "moving_avg": "op.mean('price')"
    },
    "frames": {
      "moving_avg": [-2, 0]
    }
  }
}
```

The `frames` field specifies per-column window frame bounds as `[start, end]` relative to the current row. `null` means unbounded. Omitting `frames` defaults aggregate functions to cumulative (`[null, 0]`), matching SQL's `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

Available window functions:

- `op.lag('column', offset)` — Previous row value
- `op.lead('column', offset)` — Next row value
- `op.row_number()` — Sequential row numbers
- `op.rank()` — Rank with gaps for ties
- `op.dense_rank()` — Rank without gaps
- `op.percent_rank()` — Percentage rank (0-1)
- `op.ntile(n)` — Distribute into N buckets
- `op.first_value('column')` — First value in partition
- `op.last_value('column')` — Last value in partition
- `op.fill_down('column')` — Fill nulls with preceding value
- `op.fill_up('column')` — Fill nulls with following value

Available aggregate functions (cumulative/rolling):

- `op.sum('column')` — Running sum
- `op.mean('column')` — Running average
- `op.min('column')` — Running minimum
- `op.max('column')` — Running maximum
- `op.count()` — Running count
- `op.median('column')` — Running median
- `op.mode('column')` — Running mode (most frequent value)
- `op.product('column')` — Running product
- `op.stdev('column')` — Running standard deviation
- `op.variance('column')` — Running variance

**Compound expressions**: To compute expressions that combine window results (e.g., `value - lag(value)`), use a window step followed by a derive step that references the window output columns.

**Join** — Combine with another model:

```json
{
  "join": {
    "right": "mdl_customers",
    "on": [["customer_id", "id"]],
    "how": "left",
    "suffixes": ["", "_customer"]
  }
}
```

**Append (Concat / Union)** — Stacks rows from another model or source.

Unified in the UI as the **Append** dialog, which allows choosing between keeping or removing duplicates.

**Concat** — Keeps duplicates:

```json
{
  "concat": {
    "with": "mdl_monthly_data",
    "columns": ["col_1", "col_2"],
    "targetColumns": ["col_A", "col_B"]
  }
}
```

**Union** — Removes duplicates (based on all columns):

```json
{
  "union": {
    "with": "mdl_other_table",
    "columns": ["id", "val"],
    "targetColumns": ["id", "val"]
  }
}
```

**Pivot** — Long to wide:

```json
{
  "pivot": {
    "rows": ["product"],
    "keys": "month",
    "values": "sales",
    "aggregation": "sum"
  }
}
```

**Fold** — Wide to long (unpivot):

```json
{
  "fold": {
    "columns": ["jan", "feb", "mar"],
    "as": ["month", "sales"]
  }
}
```

**Impute** — Fill missing values:

```json
{
  "impute": {
    "column": "sales",
    "strategy": "mean"
  }
}
```

**Sample** — Extract random rows:

```json
{
  "sample": {
    "count": 1000,
    "seed": 42
  }
}
```

The `seed` parameter is optional. When provided, sampling is deterministic (same seed produces same results). Useful for reproducible workflows.

**Semijoin** — Filter to rows that exist in another table (no columns added):

```json
{
  "semijoin": {
    "right": "mdl_customers",
    "on": [["customer_id", "id"]]
  }
}
```

Use case: Filter orders to only those from customers in a specific customer list.

**Antijoin** — Filter to rows that don't exist in another table:

```json
{
  "antijoin": {
    "right": "mdl_processed",
    "on": [["id", "id"]]
  }
}
```

Use case: Find records that are missing from another table (e.g., orders not yet shipped).

**Lookup** — Fast left join for adding specific columns:

```json
{
  "lookup": {
    "right": "mdl_reference",
    "on": [["category_id", "id"]],
    "values": ["category_name", "department"]
  }
}
```

More efficient than a full join when you only need to add a few columns from a reference table.

**Spread** — Convert array column into multiple columns:

```json
{
  "spread": {
    "column": "tags",
    "limit": 5,
    "keepOriginal": false
  }
}
```

Spreads array values into separate columns. For example, `tags: ['a','b','c']` becomes three columns: `tags_1: 'a'`, `tags_2: 'b'`, `tags_3: 'c'`. The `limit` parameter caps the number of columns created. Set `keepOriginal: true` to preserve the original array column.

Works with both native arrays and JSON string arrays (e.g., `["a","b","c"]`).

**Unroll** — Expand array values into separate rows:

```json
{
  "unroll": {
    "column": "items",
    "indices": true,
    "keepOriginal": false
  }
}
```

Expands array values into separate rows. For example, a row with `id: 1, items: ['a','b','c']` becomes three rows, each with `id: 1` and one item from the array. All other columns are duplicated across the new rows.

When `indices: true`, adds a column named `{column}__unroll_index` containing the 0-based position of each value in the original array. Set `keepOriginal: true` to preserve the original array column.

Works with both native arrays and JSON string arrays.

**Merge** — Concatenate multiple columns with a separator:

The merge operation is implemented using the `derive` transform (and optionally `remove`). It's not a separate transform type, but a UI convenience that generates the appropriate derive expression.

Example: Merging `first_name` and `last_name` with a space separator creates:

```json
{
  "derive": {
    "full_name": "(first_name ?? \"\") + \" \" + (last_name ?? \"\")"
  }
}
```

If "Remove original columns" is selected, a second step is added:

```json
{
  "remove": ["first_name", "last_name"]
}
```

**Null handling:** The merge operation uses the nullish coalescing operator (`??`) to convert null values to empty strings before concatenation. This ensures that `null` values don't break the concatenation.

**Column name escaping:** Columns with special characters or spaces use bracket notation: `[Column Name]`

**Examples:**

- No separator: `"(col1 ?? \"\") + (col2 ?? \"\")"`
- Space separator: `"(col1 ?? \"\") + \" \" + (col2 ?? \"\")"`
- Comma separator: `"(col1 ?? \"\") + \", \" + (col2 ?? \"\")"`
- Single column: `"(col1 ?? \"\")"`

### 4.5 Manual JSON Editing

Advanced users can edit the transformation pipeline directly as JSON. This "Danger Zone" feature allows for:

- Bulk editing of several steps at once
- Reordering steps via copy-paste
- Copying pipelines between different models or sources
- Applying complex configurations not yet exposed in the visual UI

Direct JSON editing is available via the **JSON** tab in the sidebar, which opens a dedicated modal with syntax highlighting and real-time linting.

**Warning**: Direct JSON editing bypasses the safety checks of the visual dialogs. While the application provides linting for basic syntax and schema errors, invalid changes can still break the pipeline or cause recomputation errors.

---

## 5. Expression Syntax

Expressions are used in `filter` and `derive` transforms.

### 4.1 Column References

- Simple names: `sales`, `revenue`
- Names with spaces: `[Product Name]`, `[Total Sales]`

**Reserved bare identifiers:** `and`, `or`, `not`, `let`, `in`. Columns whose bare name collides with a keyword must be written in bracket notation (`[and]`, `[in]`, etc.). Bracketed names never collide because they are preprocessed to opaque placeholders before jsep parsing.

### 4.2 Operators

| Category        | Operators                                      |
| --------------- | ---------------------------------------------- |
| Arithmetic      | `+`, `-`, `*`, `/`, `%`                        |
| Comparison      | `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==` |
| Logical         | `and` / `&&`, `or` / `\|\|`, `not` / `!`       |
| Null coalescing | `??`                                           |
| Conditional     | `condition ? trueValue : falseValue`           |

> **Note:** Word-form operators (`and`, `or`, `not`) are beginner-friendly alternatives to the symbolic operators (`&&`, `||`, `!`). Both syntaxes are fully supported.

### 4.2b Let Bindings

Name an intermediate value and reuse it in the body of an expression:

```
let s = trim(lower([Name])) in if(len(s) > 0, s, "unknown")
```

- Multiple bindings: `let x = [a], y = x + 1 in x * y` (sequential — later bindings see earlier ones).
- Bindings may be nested: `let x = let y = 1 in y + 1 in x * 2`.
- A binding shadows any column with the same name inside its body.
- Binding names must be identifiers; function names (`trim`, `if`, …) cannot be shadowed.
- Bound values are passed through as-is — including error values — so `is_error(x)` and `x ?? fallback` work in the body.

### 4.3 Functions

> **Complete Function Reference**: See [FUNCTION-DOCS-SYSTEM.md](FUNCTION-DOCS-SYSTEM.md) for auto-generated documentation with examples, parameters, and return values. The function reference dialog is accessible via Help → "Expression Reference" in the UI.

**String functions:**

- `upper(s)`, `lower(s)`, `trim(s)`
- `substring(s, start, length?)`, `len(s)`

**Math functions:**

- `abs(n)`, `round(n, decimals?)`, `floor(n)`, `ceil(n)`
- `min(a, b, ...)`, `max(a, b, ...)`
- `pow(base, exponent)`, `sqrt(n)`, `cbrt(n)`, `exp(n)`, `ln(n)`, `log10(n)`, `log2(n)`
- `sin(n)`, `cos(n)`, `tan(n)`, `asin(n)`, `acos(n)`, `atan(n)`, `atan2(y, x)`
- `radians(n)`, `degrees(n)`, `sign(n)`, `trunc(n)`, `pi()`, `e()`
- `parse_int(s)`, `parse_float(s)`, `is_nan(n)`

**Date functions:**

- `year(d)`, `month(d)`, `day(d)`, `hour(d)`, `minute(d)`, `second(d)`
- `weekday(d)`, `week(d)`, `quarter(d)`
- `today()`, `now()`
- `days_between(d1, d2)`, `date_add(d, amount, unit)`, `date_trunc(d, unit, interval?)`
- `format_date(d, format)`

**Regex functions:**

- `regexp_match(s, pattern)` — Returns boolean
- `regexp_extract(s, pattern, group?)` — Returns matched string
- `regexp_replace(s, pattern, replacement)` — Returns text with replacements (supports capture groups)

**JSON functions:**

- `is_json(s)` — Tests if string contains valid JSON
- `json_extract(s, path)` — Extracts value from JSON at dot-notation path
- `json_keys(s)` — Returns array of top-level keys from a JSON object, or null
- `json_array_length(s)` — Returns length of a JSON array, or null
- `json_type(s)` — Returns the JSON type: `"object"`, `"array"`, `"string"`, `"number"`, `"boolean"`, `"null"`, or null
- `json_stringify(value)` — Converts any value to its JSON string representation

### 4.4 Aggregate Functions (in rollup)

Used in `aggregate.rollup` with Arquero syntax:

```
op.count()           — Count rows
op.sum('column')     — Sum values
op.mean('column')    — Average
op.median('column')  — Median
op.min('column')     — Minimum
op.max('column')     — Maximum
op.distinct('column') — Count unique values
op.first('column')   — First value in group
op.last('column')    — Last value in group
op.stdev('column')   — Standard deviation
op.variance('column') — Variance
```

---

## 6. Persistence

### 5.1 IndexedDB Structure

| Object Store  | Key  | Contents                                          |
| ------------- | ---- | ------------------------------------------------- |
| `sources`     | `id` | Source metadata (columns, settings) — no row data |
| `models`      | `id` | Model metadata (steps, schema) — no row data      |
| `source-data` | `id` | Row data arrays for sources (`{ id, data }`)      |
| `model-data`  | `id` | Row data arrays for models (`{ id, data }`)       |

**Database name:** `syto-db`
**Version:** `2`

Row data is stored separately from metadata and loaded lazily per source/model. On app startup, only metadata is loaded; data is fetched on demand via `ensureSourceData()`/`ensureModelData()`. The v1→v2 migration runs automatically on first open.

**Pre-migration backup:** Before any destructive migration, `backupV1IfNeeded()` copies the existing database to `syto-db-v1-backup`. Startup flow: `loadInitialData()` → `backupV1IfNeeded()` → `openDatabase()` (triggers migration) → load metadata. The backup is a recovery safety net and must not be deleted programmatically.

### 5.2 localStorage

| Key             | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `syto-settings` | User preferences (theme, performance settings) |

### 5.3 URL Hash State

Format: `/#/sourceId/modelId` or `/#/page/section`

Examples:

- `/#/src_abc123/mdl_xyz789` — View specific model
- `/#/reference/filter` — View reference page

**Scope**: URL hash stores **navigation state only** — active source/model selection and dialog pages. Workflow definitions (transform steps) are **not** persisted via URL; they exist only in IndexedDB. On app load, `loadInitialData()` reads workflows from IndexedDB, then `UrlStateSync` restores which source/model/dialog to display.

### 5.4 Validation on Load

`loadInitialData()` validates all model steps after loading from IndexedDB using `validateSteps()` from `transform-linter.ts`. Checks include unknown transform keys and expression syntax (filter, derive, conditional). Validation warnings are returned to the caller and displayed as a persistent toast — invalid steps are **not** removed or modified, preserving the stored state.

---

## 7. Workflow Format (v2)

Workflow JSON uses the v2 portable format — name-based references, multi-source/model DAGs, parsing hints, and declared outputs. Exported from the browser via `ExportService.exportWorkflowV2()`, importable in the browser via drag-and-drop, and executable by the CLI.

**Note:** Workflow JSON contains only the pipeline definition, not the data. Data must be re-imported and pipeline replayed.

### 7.2 Workflow Format v2 (Portable)

v2 is the sole workflow format, designed for CLI execution and cross-environment sharing. Uses **names** instead of IDs, supports **multiple sources/models**, includes **parsing hints**, and declares **outputs**.

- **Implementation**: `src/core/workflow-v2.ts` (types, validation, translation functions)
- **Spec**: `docs/WORKFLOW-FORMAT-V2.md` (full field reference, CLI usage, edge cases)
- **Browser export**: `ExportService.exportWorkflowV2()` — walks upstream from active model, collects all dependencies, translates IDs to names
- **CLI execution**: `src/cli/run-command.ts` — parses workflow, binds data files, topological-sorts models, executes pipeline

v2 is the **sole** workflow format. v1 has been removed — there is no migration path (no users existed on v1).

**Name translation**: At export, `translateIdsToNames()` rewrites multi-model references (`join.right`, `concat.with`, etc.) from internal IDs to portable names. At import, `translateNamesToIds()` reverses this. Both use `MULTI_MODEL_REFERENCE_PATHS` as the single source of truth for which fields contain references.

**Browser import**: Dropping a v2 workflow JSON file triggers automatic detection in `handleJsonPreview()`, which routes to the workflow import dialog. Users bind CSV files to each source, then `WorkflowImportService.importWorkflow()` creates sources/models in topological order.

**Shared graph utilities**: `getReachableModels()` and `topologicalSortV2()` in `workflow-v2.ts` are used by both the CLI runner and the browser import service.

---

## 8. Error Objects

Type conversion failures and expression evaluation errors produce error objects instead of null:

```typescript
interface ConversionError {
  type: 'error';
  message: string; // e.g., "Cannot convert 'abc' to integer"
  toString(): string; // Returns "Error"
  valueOf(): string; // Returns "Error"
}
```

**Implementation**: `createErrorObject()`, `isConversionError()`, and `cloneData()` in `src/core/type-converter.ts`.

> **Cloning constraint**: The `toString()`/`valueOf()` methods make error objects incompatible with `structuredClone`. Use `cloneData()` for deep-cloning data arrays that may contain errors.

### 8.1 Sources of Errors

- **Type conversion**: Failed `types` transform (e.g., `"abc"` → integer)
- **Expression evaluation**: Failed `derive` or `conditional` expression (e.g., division by zero)

### 8.2 Error Display and Statistics

- Display as "Error" in the table (red background, warning icon; click shows full message)
- Tracked separately from nulls in EDA statistics (`errorCount`, `errorPercentage`)
- Excluded from numeric calculations (mean, median, etc.)
- Displayed as dark red bar in categorical charts
- All error objects group together during aggregation (regardless of message)

### 8.3 Error Handling in Expressions

Errors propagate through expressions similarly to `null`:

- **Arithmetic and comparisons**: `error + 1` → error. `error > 10` → error. Left error takes precedence.
- **`??` (nullish coalescing)**: Treats errors as "missing" — `price ?? 0` returns `0` when `price` is null OR an error.
- **`&&` / `||`**: If the left operand is an error, the error propagates (no short-circuit).
- **`coalesce()`**: Skips error values (consistent with `??`).
- **`is_error(value)`**: Returns `true` if the value is a conversion error, `false` otherwise.
- **Ternary `? :`**: If the test is an error, the error propagates (neither branch executes).
- **Unary operators**: `-error` → error. `!error` → error.
- **Function arguments and `let` bindings**: **Pass-through** — an error value is handed to the function / bound to the name as-is, without short-circuiting. This is what lets `is_error(x)`, `coalesce(x, …)`, and `x ?? fallback` actually observe the error in the body. Any new scope-introducing construct must preserve this rule (see DEVELOPMENT-PATTERNS.md §7.3).

### 8.4 Error Handling in Transforms

- **Impute**: Error cells are treated as missing values and replaced by the imputation strategy.
- **Filter**: Expression errors silently exclude the row.
- **Aggregate (groupby)**: All error objects are grouped together as a single group (via `toString()` → `"Error"`).

### 8.5 Error Handling in Export

- **CSV/JSON export**: Error cells are exported as `null`.
- **Clipboard copy**: Same as export — errors become `null`.

---

## 9. EDA Statistics

Statistics calculated for column analysis:

```typescript
interface BaseStats {
  column: string;
  type: string;           // 'number', 'string', 'date', 'boolean'
  totalCount: number;
  nullCount: number;
  nullPercentage: string;
  errorCount: number;
  errorPercentage: string;
  uniqueCount: number;
  uniquePercentage: string;
}

// For numeric columns:
interface NumericStats extends BaseStats {
  min: string;
  max: string;
  mean: string;
  median: string;
  p25: string;           // 25th percentile
  p75: string;           // 75th percentile
  std: string;           // Standard deviation
  raw: { ... };          // Same values as numbers
}

// For categorical columns:
interface CategoricalStats extends BaseStats {
  topValues: Array<{
    value: string;
    count: number;
    percentage: string;
    isNull?: boolean;
    isError?: boolean;
    isOther?: boolean;   // Aggregated "other" category
  }>;
}
```

**Categorical overlay**: `EDAEngine.calculateCategoricalOverlay(data, column)` computes `topValues` for any column type, including numeric. This is used when the user toggles a numeric column to categorical treatment in the EDA panel. The overlay is computed lazily (only on toggle) and stored separately from the main `edaStats`.

---

## 10. ID Generation

IDs are generated as random strings with prefixes:

| Entity | Prefix | Example        |
| ------ | ------ | -------------- |
| Source | `src_` | `src_a1b2c3d4` |
| Model  | `mdl_` | `mdl_x9y8z7w6` |

IDs are:

- Generated client-side using random alphanumeric strings
- Stable across sessions (stored in IndexedDB)
- Used for foreign key references (Model.sourceId, Join.right)

---

## 11. Data Flow

```
┌─────────────┐
│   Import    │  CSV, clipboard, URL
└──────┬──────┘
       ▼
┌─────────────┐
│   Source    │  Raw data + schema
└──────┬──────┘
       │ sourceId reference
       ▼
┌─────────────┐
│    Model    │  Pipeline + computed result
└──────┬──────┘
       │ steps[] array
       ▼
┌─────────────┐
│ Transform 1 │──▶ Intermediate result
├─────────────┤
│ Transform 2 │──▶ Intermediate result
├─────────────┤
│ Transform N │──▶ Final data + schema
└─────────────┘
       │
       ▼
┌─────────────┐
│   Export    │  CSV, JSON, Workflow JSON
└─────────────┘
```

Models are recomputed from Source through all steps whenever:

- A step is added, edited, or deleted
- The step order changes
- The user views an intermediate step

**Step result caching**: When a user is editing step N, `StepResultCache` stores a single checkpoint of the intermediate result at step N-1. On resubmission, computation resumes from the checkpoint rather than replaying from step 0. The cache holds one entry (not per-model), is evicted on model switch, and is invalidated on undo/redo, step removal, or source replacement. See §5 in DEVELOPMENT-PATTERNS.md for the invalidation convention.

---

**End of Data Specification**
