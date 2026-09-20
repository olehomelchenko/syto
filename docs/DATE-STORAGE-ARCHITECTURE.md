# Date Storage Architecture

> **Purpose:** Documents Syto's date handling strategy, the approaches considered, and the rationale for the current design.

**Status:** Implemented
**Created:** January 2026
**Last updated:** February 2026

---

## Table of Contents

1. [Decision Summary](#decision-summary)
2. [Architecture](#architecture)
3. [The JavaScript Date Problem](#the-javascript-date-problem)
4. [Approaches Considered](#approaches-considered)
5. [Why Strings Won](#why-strings-won)
6. [Implementation Details](#implementation-details)
7. [Developer Guide](#developer-guide)

---

## Decision Summary

**Dates are stored as formatted strings throughout the entire data layer.** No native `Date` objects exist in `model.data` or `source.data` at any point in the pipeline.

| Layer              | Format                                              | Example                                              |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| Source data        | Strings (as imported)                               | `"2024-01-15"`                                       |
| Model data         | Strings (after type conversion)                     | `"2024-01-15"`                                       |
| Schema             | Type hints (`"date"`, `"datetime"`)                 | `{ type: "date" }`                                   |
| Expression runtime | Strings in, `parseToDate()` internally, strings out | `date_add("2024-01-15", 1, "days")` → `"2024-01-16"` |
| Persistence        | Strings (IndexedDB, JSON export)                    | `"2024-01-15"`                                       |

---

## Architecture

### Data Flow

```
CSV/JSON Import → Raw strings → Schema inference (pattern matching) →
Types step (string→string conversion via type-converter) →
Transforms (strings throughout) → Persistence (strings) → Export (strings)
```

### Key Files

| File                                                                              | Responsibility                                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`src/core/type-converter.ts`](../src/core/type-converter.ts)                     | `convertToDate()` / `convertToDateTime()` — validates and normalizes date strings |
| [`src/core/schema-engine.ts`](../src/core/schema-engine.ts)                       | Type inference via regex pattern matching on string values                        |
| [`src/core/functions/date-functions.ts`](../src/core/functions/date-functions.ts) | Expression functions (`today`, `now`, `date_add`, etc.) — all return strings      |
| [`src/core/ast-interpreter.ts`](../src/core/ast-interpreter.ts)                   | `parseToDate()` — internal string→Date conversion for computation only            |
| [`src/app/infrastructure/storage.ts`](../src/app/infrastructure/storage.ts)       | `convertDatesForStorage()` — safety net at the persistence boundary               |

### Key Invariant

**`Date` objects never exist in `model.data`.** The `types` step uses `convertToDate()` and `convertToDateTime()` from `type-converter.ts`, which validate the input and return formatted strings — not `Date` objects. Date functions (`today()`, `date_add()`, etc.) also return formatted strings.

`parseToDate()` creates temporary `Date` objects inside expression functions (e.g., to compute `year()`, `date_add()`), but these are always converted back to strings before returning.

---

## The JavaScript Date Problem

JavaScript's `Date` type has fundamental issues that make it unsuitable as a runtime data format for a date-only use case:

### 1. No Date-Only Type

`Date` always includes time and timezone. There is no way to represent "January 15, 2024" without also carrying hours, minutes, seconds, and a timezone offset.

### 2. UTC Serialization Trap

`Date.toJSON()` and `Date.toISOString()` always convert to UTC, silently shifting dates:

```javascript
const jan1 = new Date(2024, 0, 1); // Jan 1, local midnight
JSON.stringify({ date: jan1 });
// In UTC+3: {"date":"2023-12-31T21:00:00.000Z"}  ← Dec 31!
```

This affects every place that touches JSON: `JSON.stringify()`, `JSON.parse()`, IndexedDB structured cloning, export, clipboard copy, debug views, and logging.

### 3. Parsing Inconsistency

```javascript
new Date('2024-01-15'); // → UTC midnight (spec says date-only = UTC)
new Date(2024, 0, 15); // → Local midnight
new Date('2024-01-15T00:00:00'); // → Local midnight (has time = local)
```

The same date string produces different `Date` objects depending on whether it includes a time component.

### 4. Pervasive Leak Surface

Every code path that touches a `Date` object is a potential timezone bug: display formatting, comparison, persistence, export, clipboard, debug views, tooltip rendering, logging. The workaround isn't one fix — it's dozens of fixes scattered across the codebase, each one a maintenance risk.

---

## Approaches Considered

### Approach A: Native Date Objects with Schema-Driven Serialization

**Concept:** Store `Date` objects in runtime memory, convert to strings only at persistence/export boundaries using schema-aware `hydrateData()` and `serializeData()` functions.

**This approach was fully implemented and then reverted.** The implementation revealed that the serialization boundary is not a clean line — Date objects leak into:

- `JSON.stringify()` calls for deep cloning (`JSON.parse(JSON.stringify(data))`)
- Debug/logging output
- Clipboard operations
- `toISOString()` calls in various utilities
- Any new code path added in the future that touches data

Each leak point required its own local-time formatting workaround, creating a fragile system where any missed boundary silently corrupts dates. The workarounds themselves (replacing `toISOString()` with manual local-time formatting) were indistinguishable from bugs to future developers.

**Verdict:** Rejected after implementation. The fix surface is too large and the failure mode (silent date shifting) is too dangerous.

### Approach B: Formatted Strings Throughout (Chosen)

**Concept:** Dates remain as formatted strings (`"2024-01-15"`, `"2024-01-15T14:30:00"`) at every layer. Date functions parse strings internally, compute with `Date` objects, and return formatted strings.

**Verdict:** Adopted. Simple, timezone-safe, no serialization boundaries to manage.

### Approach C: Temporal API

**Concept:** Use the TC39 Temporal API (`Temporal.PlainDate`, `Temporal.PlainDateTime`) which provides proper date-only and datetime types without timezone issues.

**Verdict:** Deferred. Browser support is incomplete as of early 2026. When Temporal reaches broad availability, it would be the ideal solution — `Temporal.PlainDate` is exactly the type Syto needs. Migration would be straightforward since the string format (`YYYY-MM-DD`) is compatible.

### Approach D: Timestamp Storage

**Concept:** Store dates as Unix timestamps (milliseconds since epoch).

**Verdict:** Rejected. Loses human readability, still has timezone issues on display, and doesn't solve the core problem.

### Approach E: Wrapper Objects

**Concept:** Store dates as `{ __type: "date", value: "2024-01-15" }`.

**Verdict:** Rejected. Bloats data, complicates all access patterns, incompatible with Arquero.

---

## Why Strings Won

1. **Zero timezone risk** — Strings don't shift. `"2024-01-15"` is `"2024-01-15"` in every timezone, in every code path, after every serialization.

2. **No serialization boundaries** — No need for `hydrateData()` / `serializeData()`. Data flows unchanged from import to persistence to export.

3. **Debuggable** — Data looks correct in every view: console, debug page, IndexedDB inspector, JSON export. No `"1969-12-31T21:00:00.000Z"` surprises.

4. **Low maintenance** — New code paths don't need to know about date handling. A developer can `JSON.stringify(data)` anywhere without worrying about date corruption.

5. **Future-compatible** — When Temporal API is available, the string format (`YYYY-MM-DD`) maps directly to `Temporal.PlainDate.from("2024-01-15")`.

### Trade-offs Accepted

- **Repeated parsing** — Expression functions like `year(date_col)` re-parse the string on each row. In practice this is fast (regex + `new Date()`) and hasn't been a measurable bottleneck.
- **No native comparison** — Date comparisons require parsing. String comparison (`"2024-01-15" < "2024-02-01"`) works for `YYYY-MM-DD` format due to lexicographic ordering, which is used where possible.
- **No type enforcement** — Schema says `"date"` but the data cell is just a string. The `types` step validates format on conversion, but downstream transforms could produce invalid date strings.

---

## Implementation Details

### Type Converter (`type-converter.ts`)

The `types` transform step calls `convertToDate()` / `convertToDateTime()` for columns marked as `date` / `datetime`. These functions:

1. Pass through already-formatted strings (regex check)
2. Parse other values via `parseToDate()`
3. Return a formatted string (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`) — never a `Date` object
4. Return a `ConversionError` for unparseable values

### Date Functions (`date-functions.ts`)

All date functions follow the same pattern:

```
String input → parseToDate() → compute with Date → format back to string → return
```

| Function                    | Returns                                       |
| --------------------------- | --------------------------------------------- |
| `today()`                   | `"2024-01-15"`                                |
| `now()`                     | `"2024-01-15T14:30:45"`                       |
| `date_add(date, n, unit)`   | `"2024-01-16"` or `"2024-01-15T15:30:45"`     |
| `date_trunc(date, unit)`    | `"2024-01-01"` or `"2024-01-01T00:00:00"`     |
| `parse_date(str, format)`   | `"2024-01-15"` or `"2024-01-15T14:30:45"`     |
| `format_date(date, format)` | Custom format string (e.g., `"Jan 15, 2024"`) |
| `year(date)`                | `2024` (number)                               |
| `month(date)`               | `1` (number)                                  |

### Date vs Datetime Format

The system distinguishes between date and datetime based on whether time components are present:

- **Date:** `YYYY-MM-DD` (e.g., `"2024-01-15"`)
- **Datetime:** `YYYY-MM-DDTHH:mm:ss` (e.g., `"2024-01-15T14:30:45"`)

When a date function produces a result with non-zero time components, it returns datetime format. Otherwise, it returns date format. This preserves time information without forcing all dates into datetime format.

### Safety Net: `convertDatesForStorage()`

`convertDatesForStorage()` in `storage.ts` remains as a safety net at the IndexedDB persistence boundary. It converts any `Date` objects it encounters to `YYYY-MM-DD` strings. In normal operation it's a no-op (data already contains strings), but it guards against future regressions that might accidentally introduce Date objects into the data layer.

### Display Formatting

`formatCellValue()` in `helper-handlers.ts` includes Date-aware formatting as a defensive measure. If a `Date` object somehow reaches the display layer, it renders using local time rather than calling `toISOString()`.

---

## Developer Guide

### Rules

1. **Never return `Date` objects from functions that produce data values.** Date functions, type converters, and transforms must return formatted strings.

2. **Use `parseToDate()` for computation, not storage.** Create temporary `Date` objects inside functions for arithmetic, then format the result back to a string before returning.

3. **Never use `toISOString()` for display or formatting.** It converts to UTC, shifting dates. Use `getFullYear()`, `getMonth()`, `getDate()` for local-time formatting.

4. **String format is `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm:ss` for datetimes.** Always zero-pad months and days.

5. **Lexicographic comparison works.** `"2024-01-15" < "2024-02-01"` is correct for `YYYY-MM-DD` strings.

### Adding New Date Functions

When adding a new function that operates on dates:

```typescript
function myDateFunction(dateStr: string): string {
  const date = parseToDate(dateStr); // String → Date (temporary)
  if (!date) return dateStr; // Graceful fallback

  // ... compute with Date object ...

  // Format back to string before returning
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

### Future: Temporal API Migration

When `Temporal.PlainDate` and `Temporal.PlainDateTime` reach broad browser support, migration would be:

1. Replace `parseToDate()` internals with `Temporal.PlainDate.from()`
2. Replace formatted-string returns with `Temporal.PlainDate` objects
3. `Temporal.PlainDate` serializes correctly (`toString()` → `"2024-01-15"`) with no timezone issues
4. Remove `convertDatesForStorage()` safety net

The string format is already Temporal-compatible, so persisted data requires no migration.

---

## Related Documentation

- [DATA-SPECIFICATION.md](DATA-SPECIFICATION.md) - Data structures and type system
- [FUTURE-PROOFING.md](FUTURE-PROOFING.md) - Schema evolution guidelines
- [DEVELOPMENT-PATTERNS.md](DEVELOPMENT-PATTERNS.md) - Implementation patterns
