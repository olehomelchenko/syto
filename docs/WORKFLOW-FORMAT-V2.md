# Workflow Format v2 Specification

**Status**: Draft (March 2026)
**Context**: Portable workflow format for CLI execution, LLM agents, and cross-environment sharing

---

## Goals

1. **Portable**: A workflow file works on any machine — no opaque IDs, no embedded file paths
2. **Multi-model**: Represent full DAGs (joins, unions, lookups) not just single pipelines
3. **Reproducible**: Carry enough parsing metadata to produce identical results from the same input files
4. **CLI-native**: Designed for `syto run workflow.json --bind orders=orders.csv`
5. **Inspectable**: Flat, human-readable JSON that an LLM can generate and a human can hand-edit

### Non-Goals

- Embedding raw data (export data separately)
- Replacing IndexedDB internal storage format (v2 is the _export/interchange_ format)

---

## Format Schema

```jsonc
{
  // ── Metadata ──────────────────────────────────────────────
  "formatVersion": 2,
  "sytoVersion": "0.2.0",
  "exportedAt": "2026-03-21T14:00:00.000Z",

  // ── Sources ───────────────────────────────────────────────
  // Each source is a named data input. Names are the portable reference key.
  // Sources contain NO data — just schema and parsing hints.
  "sources": {
    "orders": {
      "columns": [
        { "name": "id", "type": "integer" },
        { "name": "customer_id", "type": "integer" },
        { "name": "amount", "type": "number" },
        { "name": "order_date", "type": "date" },
      ],
      "parsing": {
        "format": "csv",
        "delimiter": ",",
        "headerMode": "first-row",
        "encoding": "utf-8",
      },
    },
    "customers": {
      "columns": [
        { "name": "cust_id", "type": "integer" },
        { "name": "name", "type": "string" },
        { "name": "region", "type": "string" },
      ],
      "parsing": {
        "format": "csv",
        "delimiter": ",",
        "headerMode": "first-row",
        "encoding": "utf-8",
      },
    },
  },

  // ── Models ────────────────────────────────────────────────
  // Keys use sourceName/modelName composite format for global uniqueness.
  // "source" can reference a raw source OR another model key (chaining).
  "models": {
    "orders/clean-orders": {
      "source": "orders", // ← starts from raw source
      "steps": [{ "filter": { "expr": "amount > 0" } }, { "derive": { "total": "amount * 1.2" } }],
    },
    "customers/clean-customers": {
      "source": "customers", // ← starts from raw source
      "steps": [{ "rename": { "cust_id": "id" } }],
    },
    "orders/sales-report": {
      "source": "orders/clean-orders", // ← starts from model's computed output
      "steps": [
        {
          "join": {
            "right": "customers/clean-customers",
            "on": [["customer_id", "id"]],
            "how": "left",
          },
        },
        { "aggregate": { "groupby": ["region"], "rollup": { "revenue": "op.sum(d.total)" } } },
      ],
    },
  },

  // ── Outputs ───────────────────────────────────────────────
  // Which model(s) the user wants as final results.
  // The CLI produces one output file per entry.
  "outputs": ["orders/sales-report"],

  // ── Bindings (optional) ───────────────────────────────────
  // Default file paths for sources. Convenience for "just run it" workflows.
  // CLI --bind args override these.
  "bindings": {
    "orders": "data/orders.csv",
    "customers": "data/customers.csv",
  },
}
```

---

## Detailed Field Reference

### Top Level

| Field           | Type                      | Required | Description                          |
| --------------- | ------------------------- | -------- | ------------------------------------ |
| `formatVersion` | `2`                       | Yes      | Always `2` for this format           |
| `sytoVersion`   | `string`                  | Yes      | App version that produced the export |
| `exportedAt`    | `string`                  | Yes      | ISO 8601 timestamp                   |
| `sources`       | `Record<name, SourceDef>` | Yes      | Named data inputs (at least one)     |
| `models`        | `Record<name, ModelDef>`  | Yes      | Named pipelines (at least one)       |
| `outputs`       | `string[]`                | Yes      | Model names to produce as results    |
| `bindings`      | `Record<name, string>`    | No       | Default source → file path mapping   |

### SourceDef

| Field     | Type             | Required | Description                 |
| --------- | ---------------- | -------- | --------------------------- |
| `columns` | `ColumnSchema[]` | Yes      | Expected columns and types  |
| `parsing` | `ParsingHints`   | No       | How to parse the input file |

### ParsingHints

| Field           | Type                                         | Default       | Description                                        |
| --------------- | -------------------------------------------- | ------------- | -------------------------------------------------- |
| `format`        | `"csv" \| "json" \| "excel"`                 | `"csv"`       | Input file format                                  |
| `delimiter`     | `string`                                     | `","`         | CSV delimiter character                            |
| `headerMode`    | `"first-row" \| "auto-generate" \| "manual"` | `"first-row"` | How to determine column names                      |
| `encoding`      | `string`                                     | `"utf-8"`     | File encoding                                      |
| `customHeaders` | `string[]`                                   | —             | Column names for `manual` header mode              |
| `jsonPath`      | `string`                                     | —             | Path to array in JSON files (e.g., `"data.items"`) |
| `sheet`         | `string \| number`                           | —             | Excel sheet name or index                          |

### ModelDef

| Field    | Type              | Required | Description                                                                                                                           |
| -------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `source` | `string`          | Yes      | Name of a **source** or **model** to start from. If a model name, that model is computed first and its output becomes the input data. |
| `steps`  | `TransformStep[]` | Yes      | Ordered pipeline (may be empty)                                                                                                       |

**Model chaining**: A model's `source` can reference another model's name, creating a pipeline chain. The executor computes dependencies first (via topological sort). This eliminates the need to duplicate steps across models that build on each other's work. Circular references are a validation error.

### ColumnSchema

| Field  | Type         | Required | Description                                                                 |
| ------ | ------------ | -------- | --------------------------------------------------------------------------- |
| `name` | `string`     | Yes      | Column name                                                                 |
| `type` | `ColumnType` | Yes      | One of: `string`, `integer`, `float`, `boolean`, `date`, `datetime`, `json` |

---

## Naming Rules

### Source and Model Names

**Source names** are plain strings, globally unique. **Model keys** use a `sourceName/modelName` composite format, making them globally unique even when multiple sources have models with the same display name (e.g., `orders/main` and `customers/main`).

- **Non-empty** strings
- Allowed characters: letters, digits, hyphens, underscores, spaces, forward slash (for model keys)
- Case-sensitive (`Orders` and `orders` are different)

### Composite Model Keys

The browser export constructs model keys as `rootSourceName/modelName`, where `rootSourceName` is resolved by walking the `sourceId` chain upward. The CLI treats these as opaque strings — it doesn't parse the slash.

```jsonc
// v1 (current): opaque IDs
{ "join": { "right": "mdl_x9y8z7", ... } }

// v2: composite keys
{ "join": { "right": "customers/clean", ... } }
```

### Uniqueness Enforcement (Browser)

- **Sources**: globally unique. On import, auto-dedup via `NameService.suggestUniqueName()` (`data`, `data-2`, ...)
- **Models**: unique per-source. Two sources can each have a model named "main" — the Sidebar shows both under their respective source headers, keeping names short and readable.

---

## CLI Usage

### Core Commands

```bash
# Run a workflow, binding sources to files
syto run workflow.json --bind orders=orders.csv --bind customers=customers.csv

# If bindings are in the spec, just run it
syto run workflow.json

# Override in-spec bindings
syto run workflow.json --bind orders=newer-orders.csv

# Output control
syto run workflow.json --output results/         # one CSV per output model
syto run workflow.json --json                    # JSON output instead of CSV
syto run workflow.json -o sales-report.csv       # single output file (when one output)

# Validate without executing
syto validate workflow.json
syto validate workflow.json --bind orders=orders.csv  # also validate schema match

# Inspect a data file
syto schema data.csv
syto schema data.csv --json
```

### stdin/stdout (Single-Source Workflows)

For simple single-source workflows, Unix piping works naturally:

```bash
# Pipe data in via stdin (binds to the single source automatically)
cat orders.csv | syto run workflow.json > result.csv

# Explicit stdin binding
syto run workflow.json --bind orders=- < orders.csv
```

When a workflow has exactly one source and data arrives on stdin, the CLI binds it automatically. When a workflow has multiple sources, stdin binding requires an explicit `--bind name=-`.

### Exit Codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 0    | Success                                                        |
| 1    | Invalid arguments or missing files                             |
| 2    | Workflow validation error (malformed JSON, unknown transforms) |
| 3    | Binding error (missing bindings, schema mismatch)              |
| 4    | Transform execution error (runtime failure)                    |

### Structured Errors (--json flag on validate)

```json
{
  "valid": false,
  "errors": [
    {
      "type": "missing_binding",
      "source": "customers",
      "message": "Source 'customers' has no binding. Use --bind customers=<file>"
    },
    {
      "type": "schema_mismatch",
      "source": "orders",
      "column": "amount",
      "expected": "integer",
      "actual": "string",
      "message": "Source 'orders' column 'amount': expected integer, got string"
    }
  ]
}
```

---

## Pre-Flight Validation

Before executing any transforms, the CLI validates:

### 1. Structural Validation (no data needed)

- Workflow JSON parses correctly
- `formatVersion` is recognized
- All `outputs` reference existing model names
- All model `source` fields reference an existing source name or model name
- All multi-model references (`right`, `with`) resolve to existing models or sources
- No circular dependencies in the model DAG
- Transform steps use known transform keys

### 2. Binding Validation (files must be present)

- Every source has a binding (from `--bind` args or in-spec `bindings`)
- Bound files exist and are readable
- File format matches `parsing.format` hint (or is auto-detected from extension)

### 3. Schema Validation (files are parsed)

After parsing each bound file, compare inferred schema against expected `columns`:

| Check                                              | Severity    | Behavior                                                  |
| -------------------------------------------------- | ----------- | --------------------------------------------------------- |
| Missing expected column                            | **Error**   | Abort — pipeline will fail                                |
| Extra unexpected column                            | **Warning** | Continue — extra columns are ignored                      |
| Column name case mismatch                          | **Warning** | Suggest: `did you mean "Amount"?`                         |
| Type mismatch (e.g., expected integer, got string) | **Warning** | Continue — type coercion may handle it, but flag for user |
| Fewer rows than expected for sampling transforms   | **Info**    | Note only                                                 |

The `--strict` flag promotes all warnings to errors.

---

## Execution Model

### Topological Sort

The CLI determines execution order from the model DAG:

1. Parse all model `source` fields and multi-model references
2. Build dependency graph
3. Topological sort — dependencies before dependents
4. Execute models in order, building up the `TransformContext`

For the example workflow above:

```
1. Load source "orders" (from binding)
2. Load source "customers" (from binding)
3. Compute model "clean-orders" (source: "orders" → raw data)
4. Compute model "clean-customers" (source: "customers" → raw data)
5. Compute model "sales-report" (source: "clean-orders" → model output, joins "clean-customers")
```

Only models reachable from `outputs` are executed. If an intermediate model isn't in any output's dependency chain, it's skipped.

### TransformContext

At each step, the CLI maintains a context with all computed data so far:

```
TransformContext {
  sources: { "orders": [...rows], "customers": [...rows] }
  models: { "clean-customers": [...rows] }   // grows as models are computed
}
```

Multi-model transform steps resolve references against this context by name.

---

## Browser Export Behavior

### DAG-Based Export

When the user exports from the browser:

1. User selects target model(s) to export
2. System walks the dependency graph upstream, collecting:
   - All transitively referenced models
   - All transitively referenced sources
3. For each collected source: extract `columns` and `parsing` metadata from the `Source` object
4. For each collected model: extract `steps`, translate ID references to names
5. Assemble the v2 JSON with only the relevant subset

### ID → Name Translation

At export time, the system builds an ID→name map from all sources and models in scope:

```
src_abc123 → "orders"           (source — plain name)
src_def456 → "customers"        (source — plain name)
mdl_ghi789 → "orders/clean-orders"      (model — composite key)
mdl_jkl012 → "customers/clean-customers" (model — composite key)
mdl_mno345 → "orders/sales-report"       (model — composite key, root source is orders)
```

Then rewrites all references in transform steps:

- `model.sourceId` → `model.source` (source name or composite model key)
- `join.right: "mdl_jkl012"` → `join.right: "customers/clean-customers"`
- `concat.with: "src_abc123"` → `concat.with: "orders"`

No name collision handling is needed — sources use plain names and models use `source/model` composite keys, so they never overlap.

---

## Backward Compatibility

### v1 → v2 Upgrade Path

The CLI and browser should accept both formats:

```typescript
function detectVersion(json: any): 1 | 2 {
  return json.formatVersion === 2 ? 2 : 1;
}

function upgradeV1toV2(v1: V1Workflow): V2Workflow {
  return {
    formatVersion: 2,
    sytoVersion: v1.sytoVersion,
    exportedAt: v1.exportedAt,
    sources: {
      [v1.source.name]: {
        columns: v1.source.columns,
        // No parsing hints available from v1
      },
    },
    models: {
      [v1.model.name]: {
        source: v1.source.name,
        steps: v1.model.steps,
      },
    },
    outputs: [v1.model.name],
  };
}
```

**Limitations of upgraded v1**: No parsing hints, no multi-model references (v1 was single-model), no bindings. The CLI will require `--bind` for the single source.

### v2 Forward Compatibility

Following existing FUTURE-PROOFING.md principles:

- Unknown transform keys → skipped with warning
- Unknown column types → treated as `string`
- Unknown top-level fields → ignored
- `formatVersion` enables future structural changes

---

## Edge Cases & Mitigations

### Date/Type Inference Drift

The workflow stores expected column types in `sources.*.columns`. But type inference from a new file may produce different types than when the workflow was built.

**Mitigation**: The model's first `types` step (which is standard Syto practice) explicitly coerces columns to expected types. Even if `amount` infers as `string` from the new file, the `types` step will convert it to `integer`. The pre-flight warning still fires so the user knows something is different.

### Join Key Type Mismatch

Two independently-loaded files may infer different types for join key columns — e.g., `id` as integer in one, string in another. This causes silent zero-match joins.

**Mitigation**: Before executing a join, compare key column types across both sides. If they differ, emit a warning:

```
Warning: join key "id" has type integer in "clean-orders" but string in "clean-customers"
```

### CSV Delimiter Mismatch

A semicolon-delimited file parsed with comma delimiter produces a single column.

**Mitigation**: After parsing, if the result has exactly one column and the source expects multiple, emit an error suggesting a delimiter mismatch:

```
Error: Source 'orders' expects 4 columns but file has 1.
Hint: the file may use a different delimiter (expected: ",")
```

### Encoding Issues

Non-UTF-8 files read as UTF-8 silently corrupt characters.

**Mitigation**: The `parsing.encoding` hint tells the CLI what to expect. If the hint is absent, default to UTF-8. Node.js `Buffer` / `TextDecoder` supports common encodings. No auto-detection — the hint is the source of truth.

---

## Open Questions

1. **Inline bindings path resolution**: Are paths in `bindings` relative to the workflow file, or to the working directory? Proposal: relative to the workflow file (like how imports work in most tools).

2. **Multiple outputs to stdout**: If `outputs` has multiple entries and the user pipes to stdout, what happens? Proposal: error — require `--output <dir>` for multi-output workflows, or allow `--output-model <name>` to select one.

3. **Workflow composition**: Can one workflow import another? (e.g., shared cleaning steps.) Out of scope for v2 — this is a package/module system.

4. **Non-CSV sources**: Excel and JSON files have different parsing semantics. The `parsing` hints cover basics (`sheet`, `jsonPath`), but more complex cases (multi-sheet Excel, nested JSON) may need richer configuration. Start minimal, extend as needed.

---

## References

- [CLI-CONSIDERATIONS.md](CLI-CONSIDERATIONS.md) — Strategic rationale and competitive analysis
- [DATA-SPECIFICATION.md](../DATA-SPECIFICATION.md) — Current data structures and transform schemas
- [FUTURE-PROOFING.md](../FUTURE-PROOFING.md) — Schema evolution constraints
- [MULTI-MODEL-ARCHITECTURE.md](../MULTI-MODEL-ARCHITECTURE.md) — Dependency graph system

---

**End of Document**
