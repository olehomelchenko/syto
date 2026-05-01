# Adversarial Fixtures

Real-world-ugly inputs that every significant pipeline should either handle or fail
gracefully on. See [docs/TESTING_STRATEGY.md](../../docs/TESTING_STRATEGY.md) §3 — these
fixtures exist to surface bugs from "inputs the author didn't think of."

## Conventions

- **Per-fixture imports.** No barrel `index.ts`. Tests import the specific fixture they
  pin behaviour against, so a reader can tell at a glance what scenario is being tested.
- **Pure data modules.** All fixtures live as `.ts` files exporting typed arrays or
  strings. Even the "raw CSV" fixtures are TS strings (`'﻿…\r\n…'`), not files on
  disk — keeps byte-fidelity unambiguous and avoids any build-time copy step.
- **Homogeneous arrays.** `inferType` operates column-at-a-time, so a fixture array
  represents one column's values. Keep arrays type-homogeneous unless the fixture is
  specifically about heterogeneity (`mixed-types.ts`).

## Fixture catalogue

### Raw CSV strings

Exercised through PapaParse / `parseCSV` to test the import path end-to-end.

| File                 | What it stresses                                   |
| -------------------- | -------------------------------------------------- |
| `bom-utf8.ts`        | UTF-8 BOM at start of file                         |
| `crlf.ts`            | `\r\n` line endings                                |
| `ragged.ts`          | Rows with too few or too many fields               |
| `unicode-headers.ts` | NFC vs NFD normalisation in column names; ZWJ/ZWNJ |

### Column-value modules

Exercised through `SchemaEngine.inferType` and friends.

| File                     | What it stresses                                              |
| ------------------------ | ------------------------------------------------------------- |
| `extreme-numerics.ts`    | `MAX_SAFE_INTEGER`, beyond-safe-int strings, `-0`, subnormals |
| `scientific-notation.ts` | `1e10`, `1.5e-3`, capital `E`, overflow to `Infinity`         |
| `timezones.ts`           | `Z`, `±HH:MM`, naive datetimes, mixed offsets                 |
| `mixed-types.ts`         | Heterogeneous columns (numbers + strings, bools + strings)    |
| `combining-marks.ts`     | NFC vs NFD codepoint forms, zero-width joiners                |
