# Auto-Generated Function Documentation System

## Overview

Syto includes an automated documentation generation system that creates both human-readable markdown documentation and machine-readable JSON schema from JSDoc comments in function source files.

## Architecture

### 1. Source of Truth: JSDoc Comments

Function implementations live in `src/core/functions/`, organized by category:

| File                  | Category   |
| --------------------- | ---------- |
| `date-functions.ts`   | Date       |
| `math-functions.ts`   | Math       |
| `string-functions.ts` | Text       |
| `regex-functions.ts`  | Regex      |
| `json-functions.ts`   | JSON       |
| `type-functions.ts`   | Conversion |

All are aggregated in `src/core/functions/index.ts` as `FUNCTION_IMPLS`.

Each function uses structured JSDoc:

```typescript
/**
 * @category Date
 * @description Extracts the year from a date value
 * @param value - Date value or date string
 * @returns Year as number (e.g., 2024), or null if invalid
 * @example year(order_date)
 * @example year("2024-01-15") → 2024
 */
export const year = (value: any) => { ... }
```

### 2. Build Script: Documentation Generator

The script [scripts/generate-function-docs.ts](../scripts/generate-function-docs.ts):

- Reads all function files from `src/core/functions/`
- Parses JSDoc comments using regex
- Extracts metadata (name, category, description, params, returns, examples)
- Auto-generates function signatures from name + params
- Generates categorized markdown files
- Generates JSON schema

**Run manually:**

```bash
npm run docs:generate
```

**Automatically runs during build:**

```bash
npm run build  # includes docs:generate
```

### 3. Generated Output

#### Markdown Documentation

Located in `src/content/functions/`:

- `operators.md` - Arithmetic, comparison, logical, special operators (manually defined in generator)
- `date.md` - Date extraction, utilities, arithmetic, formatting
- `text.md` - String manipulation and comparison
- `math.md` - Mathematical operations, trigonometry, rounding
- `regex.md` - Regular expression functions
- `conversion.md` - Type conversion functions
- `json.md` - JSON parsing and extraction
- `aggregate.md` - Aggregate functions

These are compiled to HTML at build time via `vite-plugin-markdown` and imported in UI components.

#### JSON Schema

Located at `src/schemas/functions.json`:

```json
{
  "version": "1.0.0",
  "generated": "...",
  "functions": [
    {
      "name": "year",
      "category": "Date",
      "description": "Extracts the year from a date value",
      "signature": "year(value)",
      "params": [{ "name": "value", "description": "Date value or date string" }],
      "returns": "Year as number (e.g., 2024), or null if invalid",
      "examples": [
        { "expression": "year(order_date)" },
        { "expression": "year(\"2024-01-15\") -> 2024" }
      ]
    }
  ]
}
```

**Current consumers:**

- `src/app/services/expression-language.ts` — imports `functions.json` for autocomplete signatures in ExpressionEditor
- `src/app/components/FunctionReferenceDialog.tsx` — uses compiled markdown HTML for the full reference viewer

### 4. Documentation Viewer Component

The [FunctionReferenceDialog](../src/app/components/FunctionReferenceDialog.tsx) component provides:

- Sidebar navigation with categorized help sections
- Categories: Getting Started, Operators, Date, Text, Math, Regex, Conversion, JSON, Aggregate, Shortcuts, What's New
- Accessible via "Full Reference" button in expression dialogs

### 5. Inline Help in Dialogs

Expression-based dialogs (Derive, Filter) include static inline documentation showing common examples, operators, and function summaries. This is manually maintained in each dialog component (e.g., `DeriveDialog.tsx`, `FilterDialog.tsx`).

## Adding New Functions

1. **Implement the function** in the appropriate category file (`src/core/functions/<category>-functions.ts`)
2. **Add JSDoc comment** with all required tags (`@category`, `@description`, `@param`, `@returns`, `@example`). Use `@name` to override the display name if the JS identifier differs (e.g., `if_` → `if`)
3. **Export from category module** and ensure it's included in `FUNCTION_IMPLS` via `functions/index.ts`
4. **Add to whitelist** in `src/core/ast-validator.ts` (ALLOWED_FUNCTIONS + FUNCTION_ARITY)
5. **Regenerate documentation:** `npm run docs:generate`
6. **Verify tests pass:** `npm test -- function-docs-validation.test.ts`

## Valid Categories

`Date` | `Text` | `Math` | `Regex` | `Conversion` | `JSON`

The generator validates categories against this whitelist. Operators and Aggregate categories are handled separately in the generator script.

## Validation Tests

The test suite [src/core/function-docs-validation.test.ts](../src/core/function-docs-validation.test.ts) ensures:

- JSON schema file exists
- All expected markdown files exist
- Schema contains sufficient functions
- Each function has complete metadata (name, category, description, signature, params, returns, examples)
- Categories are valid (from whitelist)
- All functions have at least one example
- Function counts match between schema and markdown
- No duplicate function names

## Key Files

| Path                                             | Purpose                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| `src/core/functions/*.ts`                        | Function implementations + JSDoc (source of truth) |
| `scripts/generate-function-docs.ts`              | JSDoc parser & documentation generator             |
| `src/schemas/functions.json`                     | Machine-readable metadata (generated)              |
| `src/content/functions/*.md`                     | Human-readable documentation (generated)           |
| `src/app/components/FunctionReferenceDialog.tsx` | Full reference viewer UI                           |
| `src/core/function-docs-validation.test.ts`      | Metadata validation tests                          |

## Benefits

1. **Single source of truth** — Documentation lives with function code
2. **Always in sync** — Docs regenerate on every build
3. **Machine-readable** — JSON schema enables autocomplete and future tooling
4. **Human-friendly** — Markdown compiled to styled HTML for users
5. **Testable** — Validation ensures completeness and consistency
