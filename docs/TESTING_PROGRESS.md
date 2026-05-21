# Testing Progress

Companion to [TESTING_STRATEGY.md](./TESTING_STRATEGY.md). That document describes what _good_ looks like; this one tracks the state of the work against it.

Update this doc as batches land, findings are resolved, or priorities shift. Date entries so it's easy to see what's stale.

---

## Status at a glance

| Area                                                                         | State      |
| ---------------------------------------------------------------------------- | ---------- |
| Tier 1 audit (transform core, expression language, schema, integration, e2e) | ✅ done    |
| Tier 2 audit (handlers, services, components)                                | 🟡 partial |
| Tier 2 close-out Session 1 — dialog coverage                                 | ✅ done    |
| Tier 2 close-out Session 2 — stores + property tests                         | ✅ done    |
| Tier 2 close-out Session 3 — architectural mocking lift                      | ✅ done    |
| Batch 1 — deterministic edge cases                                           | ✅ done    |
| Batch 2 — contract decisions + ReDoS                                         | ✅ done    |
| Batch 3 — adversarial fixtures + multi-step composition                      | 🟡 partial |
| Property-based testing (fast-check)                                          | ✅ done    |

---

## Batch 1 — Deterministic edge cases

**Goal:** close the "happy-path-only" gaps surfaced in the Tier 1 audit, for cases where the correct behaviour is either unambiguous or can be pinned by characterising current behaviour.

### Done (2026-04-24)

- **Interpreter numeric edges** (`src/core/interpreter-operators.test.ts` — `AST Interpreter - Numeric Edge Cases`): division by zero (`Infinity` / `-Infinity` / `NaN`), modulo by zero, `NaN` propagation and comparison (all `false`), `Infinity` arithmetic, signed zero, `MAX_SAFE_INTEGER` precision loss. Pure JS passthrough, pinned.
- **Join degenerate cases** (`src/core/transforms-join.test.ts` — `Join degenerate cases`): no-match right in semijoin/antijoin/lookup, empty-but-schemad left, duplicate right keys (lookup picks one, semijoin preserves left cardinality).
- **Window degenerate cases** (`src/core/transforms-window.test.ts` — `Window degenerate cases`): empty-but-schemad table, single-row window, single-partition edge, null in `partitionBy` (nulls form their own partition).
- **Aggregate degenerate cases** (`src/core/transforms-aggregate.test.ts` — `Aggregate degenerate cases`): empty-but-schemad input, single-row input, null in `groupby` (forms its own group).
- **Combine degenerate cases** (`src/core/transforms-combine.test.ts` — `Combine degenerate cases`): concat with empty left/right/both, union with empty right.
- **Idempotence witnesses** (`src/core/transforms-idempotence.test.ts`): `filter`, `select`, `sort`, `sliceRows`, `removeRows`, `keepRows`, type conversion; plus identity-filter and identity-select.

**Delta:** +45 tests (2223 → 2268). Suite still ≈13 s. All green. Typecheck clean.

### Done (2026-04-24, follow-up)

- **`handleJoin` empty-right guard** (`src/core/transforms/handlers/join.ts`): the same `isSchemaless(right)` short-circuit used by semi/anti/lookup now covers `inner`/`left`/`right`/`full`/`cross`. Semantics: inner/right/cross → empty-but-schemad result with left columns; left/full → left table unchanged. Confirmed Arquero threw `Invalid column reference: ""` for inner/left/right/full and silently returned left unchanged for cross (wrong cardinality — n × 0 should be 0). Tests in `transforms-join.test.ts` now pin all five. **Delta:** +5 tests (2268 → 2277).

### Resolved in Batch 1

- [x] **Bug fix: empty-`data` model throws on join (semi/anti/lookup).** _Fixed 2026-04-24._ `src/core/transforms/handlers/join.ts` now detects a schema-less right table (`numCols() === 0`) in `handleSemijoin`/`handleAntijoin`/`handleLookup` and short-circuits to the correct empty-result semantics. Tests in `transforms-join.test.ts` now assert the fixed behaviour for all three.
- [x] **Follow-up: `handleJoin` (inner/left/right/full/cross) same bug.** _Fixed 2026-04-24._ Extended the `isSchemaless(right)` guard to `handleJoin` with per-`how` semantics; BACKLOG entry removed.
- [x] **Contract decision: aggregate of all-null → `null`.** _Decided 2026-04-24._ Per SOUL.md §7 ("Predictable, Not Clever"), Syto normalises Arquero's `undefined`-on-empty to `null` for sum/mean/min/max/median and any other rollup that produces `undefined`. `valid`/`distinct` keep their integer semantics (`valid` → 0, `distinct` → 1 because null counts as a distinct value). Implemented in `handleAggregate`; tests updated in `transforms-aggregate.test.ts`.

---

## Batch 2 — Contract decisions + security

### Done (2026-05-01)

- **Null in join keys** (`src/core/transforms-join.test.ts` — `Null-in-join-keys contract`): pinned SQL-correct semantics for inner/left/right/full/semi/anti/lookup. Arquero already implements "null doesn't match null" — no engine change needed. +7 contract tests.
- **`undefined → null` normalisation in joins** (`src/core/transforms/handlers/join.ts`): post-process `left`/`right`/`full`/`lookup` outputs (and the schemaless-lookup path) to coerce Arquero's `undefined` to `null`. Same pattern as the aggregate handler. Fixes the asymmetric full-join key-column quirk where unmatched left null keys came back as `undefined`. Two existing tests updated.
- **Null-key warning UX** (`src/app/handlers/transform/join-handlers.ts`, `src/app/components/join/JoinKeyPairEditor.tsx`): `KeyPairAnalysis` now exposes `leftNulls`/`rightNulls` counts; `JoinKeyPairEditor` surfaces a warning badge ("⚠️ N nulls") next to the existing duplicates badge with a tooltip explaining SQL semantics. i18n strings added to en/uk `dialogs.json` (with plural forms).
- **Null in group-by** (`src/core/transforms/handlers/aggregate.ts`, `transforms-aggregate.test.ts`): kept current behaviour (nulls form their own group). Added `// CONTRACT:` comment in the handler and renamed the pinning test to `CONTRACT: nulls in groupby form their own group`. Documented in `DATA-SPECIFICATION.md` §1.5 "Null Semantics" alongside the join contract.
- **ReDoS in `ast-validator.ts`** (`src/core/ast-validator.ts`): added `safe-regex2` dependency; `validateRegexPattern` now rejects literal patterns with catastrophic-backtracking shapes (nested quantifiers like `(a+)+`, `(.*)*`). +12 tests covering rejected and accepted patterns across `regexp_match` / `regexp_extract` / `regexp_replace`. New error type: `unsafe-regex`.
- **All-null aggregate contract** — already resolved in Batch 1 (the `aggregate.ts` `undefined → null` cleanup was uniform across all rollups, so `mean`/`min`/`max` were covered alongside `sum`). Tests already pin all five at `transforms-aggregate.test.ts:654-708`.

**Delta:** +20 tests (2277 → 2296). Suite still ≈13 s. All green. Typecheck clean.

### Out of scope (filed)

- **Phase 2 ReDoS coverage** — RE2-WASM at execution time, covering dynamic patterns (column references) which Phase 1 cannot validate. Filed to `BACKLOG.md`.

---

## Batch 3 — Adversarial fixtures + composition

### Done (2026-05-01)

- **Adversarial fixture library** (`src/__fixtures__/`): nine pure-data TS modules covering BOM, CRLF, ragged rows, NFC/NFD headers, ZWJ/ZWNJ, extreme numerics (MAX_SAFE_INTEGER, beyond-safe-int strings, `-0`, subnormals, `Infinity`/`NaN` strings), scientific notation (lowercase/uppercase E, integer/float/overflow forms), timezone-laden timestamps (zulu, numeric offset, naive, mixed), mixed-type columns (number+string, bool+string, mostly-numeric-with-outlier), Unicode combining marks, and RLO. Per-fixture imports (no barrel); see `src/__fixtures__/README.md`.
- **Wired into `schema-engine.test.ts`** (`Adversarial fixtures —` describe blocks): 27 tests pinning `inferType` behaviour against the fixtures. Includes CONTRACT pins (e.g., scientific notation infers as integer/float per SOUL §7) and SURPRISE pins for documented quirks: beyond-safe-int strings still infer as integer with silent precision loss, overflow scientific notation falls through to string, trailing garbage after timestamp seconds still infers as datetime (the regex is unanchored at the end).
- **Wired into `src/cli/file-loader.test.ts`** (new file): 10 tests against `parseCSV`. Pins BOM-stripping, CRLF/LF equivalence, ragged-row error throwing, and Unicode-header distinctness. **One concrete finding:** mixed CRLF/LF line endings throw a parse error because PapaParse infers the row terminator from the first newline and treats the rest as a single row. Documented as a SURPRISE pin; worth surfacing a clearer error message or auto-normalising on import (filed as a future ergonomic improvement).
- **Multi-step composition scenarios** (`src/core/composition.test.ts`): 5 realistic pipelines.
  - Type drift: `types: { date: 'date' } → filter year(date)==2024 → derive month → aggregate sum`
  - Lookup-then-aggregate: `lookup region price → derive revenue → filter not null → group-by sum` (exercises null propagation from unmatched lookup)
  - Window-rank-then-trim: `rank() partitioned by category → filter rnk ≤ 3 → mean per category` (top-3-per-group via composition)
  - Null propagation: pins Batch 2 contracts end-to-end — null forms its own group, all-null aggregates normalise to null
  - Type round-trip: `derive sum → select label,sum → derive doubled_sum` (regression-style: integer type survives projection)

**Delta:** +42 tests (2296 → 2338). Suite still ≈15 s. Typecheck clean.

### CONTRACT decision (2026-05-01)

**Scientific-notation strings infer as integer or float.** `["1e10","2e5"]` → `integer` (Number.isInteger holds for 10_000_000_000); `["1.5e-3"]` → `float`; capital `E` parses identically to lowercase. Trade-off: lossy round-trip — `"1e10"` is stored as the number `10000000000` and serialises back as `"10000000000"`, losing the original textual form. Accepted because the same lossy round-trip already exists for plain decimal strings (e.g. `"9007199254740993"` rounds to `…992`). Treating scientific notation differently from decimal notation would be inconsistent. Pinned in `schema-engine.test.ts → Adversarial fixtures — scientific notation`.

### Still queued from Batch 3

- [x] **Tier 2 audit.** Audit + initial test additions complete (2026-05-03). See Tier 2 section below.

---

## Tier 2 — Handlers, Services, Components

### Done (2026-05-03)

- [x] **Inventory.** All ~150 source files across handlers (28), services (14), components (76), stores (10), orchestration (6), infrastructure (8), hooks (3), linters (1) mapped against test coverage. Coverage ranges from 10% (stores) to 100% (linters).
- [x] **Diagnostic sample.** 10 representative tests sampled across all layers: 7/10 behaviour-focused, 2 over-mocked (`WorkflowImportService.test.ts`, `lazy-loading-data-integrity.test.ts`), 1 borderline (`DataTable.test.tsx`).
- [x] **Failure mode 2** (mocked-away interesting parts) confirmed in `WorkflowImportService.test.ts` and `lazy-loading-data-integrity.test.ts` — both mock internal domain services, not just I/O boundaries.
- [x] **Failure mode 3** (composition gaps) confirmed: only one multi-step E2E scenario existed. Added a second: Import two CSVs → Join → Derive → Export CSV.
- [x] **DialogStore tests** — previously 0% coverage on stores except AppStore; added 19 tests covering static state references, bridge signals, `createSignalProxy`, and `resetAll`.
- [x] **Join E2E scenario** — multi-source composition previously untested at any level. Tests: two CSV imports, left join, derive (price × quantity), CSV export round-trip. Surfaced a latent issue: same-millisecond `Date.now()` ID collisions cause `resolveModelInput` to resolve the wrong source (workaround in test via fake timers; production impact negligible since two manual imports can't happen within 1 ms).

**Delta:** +20 tests (2355 → 2375). Suite still ≈15 s. All green. Typecheck clean.

### Still queued for Tier 2

- [x] **Reduce mocking in WorkflowImportService and lazy-loading tests.** Closed Session 3 (2026-05-03). Both files now run real `StepService` and `DependencyService`. See Session 3 close-out below.
- [x] **Untested dialogs.** Closed Session 1 (2026-05-03). 20 dialogs covered, +144 tests. See Session 1 close-out below.
- [x] **Untested stores.** Closed Session 2 (2026-05-03). +23 tests. See Session 2 close-out below.
- [x] **WindowDialog tests.** Added 2026-05-03. +7 tests. Complex dialog with novel logic (function config, conditional UI, auto-naming, editing).

### Session 1 close-out — dialog coverage (2026-05-03)

Goal: knock out untested dialog components in parallel via sub-agents, with one human-written template setting the pattern.

- [x] **Template** — `DedupeDialog.test.tsx` (8 tests). Established the contract for all subsequent dialog tests: `renderWithI18n`, `beforeEach` resets `AppStore` signals, real i18n strings via the global mock in `src/test-setup.ts`, `await waitFor(...)` for debounced `useTransformPreview` assertions.
- [x] **Batch A** (5 dialogs, +34 tests): AppendDialog (8), DescribeDialog (6), ImputeDialog (7), SpreadDialog (7), UnrollDialog (6).
- [x] **Batch B** (6 dialogs, +42 tests): RemovePatternDialog (8), SelectPatternDialog (8), RenamePatternDialog (7), RegexpMatchDialog (6), RegexpExtractDialog (6), ParseDateDialog (7).
- [x] **Batch C** (5 dialogs, +37 tests): TypeConversionDialog (8), GenerateDialog (10), ImportTextDialog (5), ImportUrlDialog (8), DownloadDialog (6).
- [x] **Batch D** (3 meta dialogs, +23 tests): WorkflowImportDialog (9), DependencyImpactDialog (7), StepRemovalDialog (7). No skips — all three had viable seams without domain-mock pulls.

**Delta:** +144 tests (2382 → 2526). Suite ≈16.6 s. All green. Typecheck clean.

### Findings surfaced during Session 1

These were noticed by the parallel agents while writing tests. Pinned here so they don't get lost; none required engine changes to land Session 1 green.

- **BUG: `DependencyImpactDialog` plural keys were broken for English.** _Fixed 2026-05-03._ The component branched on `dependencyDialog.message_one` / `_few` / `_many` (manual Slavic-style ternary), but English defines only `_one` / `_other`, so any `count >= 2` rendered the literal key string. Replaced the ternary with a single `t('dependencyDialog.message', { count })` call so i18next picks the locale-correct plural form. Also extended the test-setup mock (`src/test-setup.ts`) to do English plural resolution (`_one` / `_other` lookup when `count` is supplied) so this class of bug surfaces in tests. Added two regression tests pinning singular and plural rendering.
- **Dead i18n key `errors.validation.invalid.regexPattern`.** `validation-engine.ts` uses `errors.validation.invalid.pattern` instead. The unused key is in `errors.json` but never fires.
- **`ParseDateDialog` format/i18n drift.** `getCommonFormats()` returns 10 presets; `formatKeyMap` only re-labels 4 of them, so 6 presets render with raw token labels. Conversely, i18n keys `parseDate.formats.iso` and `parseDate.formats.unix` are defined but never reached because `getCommonFormats()` doesn't emit `YYYY-MM-DD` or `timestamp` as preset values.
- **`ImputeDialog` preview ignores `currentData`.** Its preview runs against a hard-coded 8-row sample table with nulls. The "Strategy preview" panel is therefore always present regardless of test data — and regardless of _real_ data. Worth knowing if anyone touches that component.
- **`DescribeDialog` doesn't use `useTransformPreview`.** It owns a manual `createDebouncedPreview` handle that runs synchronously on a button click. Diverges from the rest of the dialog patterns.
- **`DownloadDialog` BACKLOG entry is stale.** BACKLOG.md still lists "DownloadDialog i18n" as planned, but the component is already internationalised via the `dialogs.download.*` namespace. Entry can be removed from BACKLOG.
- **a11y: `GenerateDialog` radios are `display: none`.** Visually replaced by icon labels but reachable only via name attribute, not via RTL roles or assistive tech. Worth an a11y audit.
- **a11y: pattern-dialog `<select>` has no `aria-labelledby`.** Tests had to grab the select via `screen.getByText('Match type:').nextElementSibling` — slightly brittle. An `aria-labelledby` would be a cheap fix.
- **`WorkflowImportDialog` mixes parsing + presentation.** PapaParse is invoked from inside the component; testing the file-input change handler would require mocking PapaParse. Parking the seam-extraction question under Session 3 (architectural lift).

### Session 2 close-out — stores + property tests (2026-05-03)

Goal: close the per-dialog store coverage gap and finish the property-based testing pilot (derive, fold, pivot, window, join).

**Stores** (`src/app/stores/dialogs/dialogs.test.ts`, +23 tests). One combined test file rather than nine micro-files — the per-dialog stores are signal bags + reset functions with the same shape, and a single file keeps the contract testable in one place. Coverage:

- `typeConversionState`, `importUrlState`, `previewState`, `generateState`, `importCsvState`, `importTextState`, `workflowImportState` — initial values, mutation sticks, reset returns to defaults.
- `settingsState` — initial values; CONTRACT pin that reset preserves user prefs (`analyticsOptOut`, `language`, `engine`) and only restores `theme`/`rowLimit`.
- `reset-registry` — `resetAllDialogStates()` fans out to every registered reset; `registerResetFunction` adds callbacks that fire on subsequent resets.

The "~14 files" estimate from the original Session 2 plan is misleading: roughly half of the files under `src/app/stores/dialogs/` are placeholder barrels (`text/index.ts`, `aggregate/index.ts`, `transform/index.ts`) for dialogs that have already migrated to `useDialogState`, or pure type re-exports (`combine/index.ts`). Only nine files contain actual signal state, and they're all covered.

**Property tests** (+22 tests across four files):

- `property-derive.test.ts` (4): row-count preserved, schema delta (one new column), identity (`derive: { copy_a: 'a' }`), and per-row arithmetic match for `+`/`-`/`*`.
- `property-window.test.ts` (5): row-count preserved with and without partition; column delta; partitioned `row_number()` produces a `1..k` permutation per partition; partitioned cumulative sum preserves per-partition totals from the input.
- `property-fold-pivot.test.ts` (6): fold row-count multiplication (`numRows × |cols|`), schema (folded cols disappear, `as` cols appear), every input cell becomes a (key, value) pair; pivot single-row when `rows: []`; pivot schema includes row-identity + key values; **round-trip** `pivot(fold(t))` recovers `t` modulo column ordering.
- `property-join.test.ts` (7): two-table `joinCaseArb` generator (right keys unique by construction, configurable overlap with left). Properties: left-join with unique right keys preserves left cardinality; inner ≤ left; semi+anti partition the left rows; antijoin result has no key in right; inner-join result keys are in both tables; left-join with empty right matches the schemaless-right contract from Batch 1; semijoin with null left key never matches even when right also has nulls (SQL contract reasserted as a property).

**Delta:** +45 tests (2528 → 2573). Suite ≈16.75 s. All green. Typecheck clean.

### Findings surfaced during Session 2

None. The stores tests largely confirm that the reset functions match the declared initial values; the property tests run cleanly with the same `applyTransform` interface used by the example tests. The only minor surprise was that the stores directory is mostly placeholders (see above) — adjusting the plan from "~14 files" to "9 actual signal bags" — but that's a planning artifact, not a code finding.

### Session 3 close-out — architectural mocking lift (2026-05-03)

Goal: kill the two over-mocked tests identified in the Tier 2 audit. Both failed Failure Mode 2 ("mocked-away interesting parts") by stubbing internal domain services rather than I/O boundaries.

**Up-front decision.** Two parallel Explore agents mapped the seams. The verdict was **refactor for real, not partial cleanup** — `StepService` methods are static, already accept `ComputeContext` as a parameter, and have no hidden singletons; `DependencyService` is pure computation. The mocks were convenience, not architectural necessity. The "interesting" code that was being stubbed (transform pipeline + dependency graph) is exactly what we want exercised.

**`WorkflowImportService.test.ts`** (`src/app/services/`) — removed `vi.mock('./StepService')`. Kept legitimate I/O mocks (`PersistenceService.autoSave`, notification handlers). Reworked four assertions that inspected `mock.calls` to instead assert on the resulting `model.steps` / `model.data` / `model.schema`:

- `prepends import step for root models` — was `expect(createInitialSteps).toHaveBeenCalledTimes(1)`. Now asserts the model has two steps: `[importStep, typesStep-from-workflow]`.
- `computes pipeline for each model` — was `expect(computeModelUpToStep).toHaveBeenCalledTimes(1)`. Now asserts `model.data` equals the source data (passed through the real types step) and that `rowCount`/`colCount` match.
- `computes both models in a multi-source workflow` (renamed from "passes correct context including previously created models") — instead of inspecting `mock.calls[0][2]`, asserts both models in the multi-source workflow have correct computed data.
- `populates model data and schema from compute result` — replaced the `[{name:'Alice', age:30}]` stub expectation with the real computed shape; switched schema assertion to `expect.objectContaining` to allow for the additional `format`/`originalPosition` fields the real engine emits.

**`lazy-loading-data-integrity.test.ts`** — removed `vi.mock('./DependencyService')` and `vi.mock('./StepService')`. All 9 tests passed unchanged. The mocks were genuinely just defaults that the real services produce naturally for the simple fixtures used in this file (no cross-model dependencies, single-step models). Net win: the test now exercises real graph construction and real pipeline execution against the same lazy-loading scenarios.

**Delta:** ±0 tests (one renamed). Suite still ≈18 s, 2573 passing. Typecheck clean.

### Findings surfaced during Session 3

- **Invalid `'number'` type in `createMultiSourceWorkflow` fixture.** The fixture used `type: 'number'` for a column. Syto's type system requires `'integer'` or `'float'` — there is no `'number'`. The mock made this invisible because `computeModelUpToStep` returned a fixed result regardless of input. Real engine throws `Unknown target type: number` at compute time. **Fix:** updated the fixture to `'float'`. **Note for the future:** workflow-import does not validate column types up front against the type registry — it only fails at compute time. A v2-workflow validator could catch this earlier; filed mentally as a future ergonomic improvement (no change required for Session 3).
- **`ColumnSchema` carries more than `{name, type}`.** The real schema includes `format: {}` and `originalPosition: number`. Tests that asserted exact equality on `[{name, type}]` shapes need `expect.objectContaining` (or to assert against the full shape). Worth noting in `DEVELOPMENT-PATTERNS.md` if this trips up a future test author.
- **DependencyService stubs were "useful by accident."** The lazy-loading test's `DependencyService` mocks all returned defaults that happened to match what the real service returns for fixtures with no cross-model dependencies (`canDelete: true`, empty arrays, empty graphs). The mocks weren't _wrong_, just unnecessary — and they would have masked any future bug in graph construction. Removing them was free.

---

## Future sessions — close-out plan

The remaining work to call the testing overhaul "done." Each session is sized for one focused work block. Pick them up cold with the brief below.

### Session 2 — Stores + remaining property tests

✅ Closed 2026-05-03. See "Session 2 close-out" above. +45 tests (2528 → 2573).

### Session 3 — Architectural mocking lift

✅ Closed 2026-05-03. See "Session 3 close-out" above. ±0 tests; turns out the seams were structural (static methods accepting `ComputeContext`), not architectural — no service refactor was needed, just removing convenience mocks. The dialog seam (`parseWorkflowSourceFile` extraction from `WorkflowImportDialog`) was deliberately scoped out and remains a future-ergonomic item.

### Session 4 — Wrap-up (closing session)

**Goal:** declare the testing overhaul done.

**Scope:**

1. Final pass on `TESTING_PROGRESS.md`: mark all sessions ✅, write a single closing log entry with final test count and what shipped.
2. Move anything still queued (e.g., a11y items, `ImputeDialog` hardcoded preview, `ParseDateDialog` format drift) to `BACKLOG.md` so it's not lost.
3. ~~Remove the stale `DownloadDialog i18n` entry from BACKLOG (already i18n'd).~~ Done 2026-05-03 during alignment review.
4. Optionally: run Stryker or a coverage-by-module pass once on `src/core/` as a _one-off_ diagnostic (not a CI gate). Read the surviving mutants for surprise findings. Skip if not needed.
5. Update `CLAUDE.md` / `AGENTS.md` if any guidance changed (e.g., the new plural-resolution behaviour in `test-setup.ts`).

**Estimated delta:** ~0 tests (documentation + cleanup).

---

## Property-based testing

### Done (2026-05-03)

- [x] **Add `fast-check@4.7.0`** dependency.
- [x] **Dataframe generator** (`src/core/property-generators.ts`): shared arbitraries for numeric tables with null sprinkling, filter expression + table combos, select column subsets, sort specs, and aggregate cases. Uses `fc.chain` for row-count-dependent generation and `fc.oneof` to sprinkle nulls.
- [x] **Filter** (`src/core/property-filter.test.ts`, 4 properties):
  - Row-count invariant: `result.numRows() ≤ input.numRows()` for random `v >/</≥/≤ threshold` expressions.
  - Identity: filter `true` preserves all rows.
  - False filter: filter `false` returns 0 rows.
  - Idempotence: filter twice = filter once (with empty-result schema-loss carve-out).
- [x] **Select** (`src/core/property-select.test.ts`, 4 properties):
  - Row count preserved.
  - Column set matches selection.
  - Idempotence (apply same select twice).
  - Select-all returns identical columns.
- [x] **Sort** (`src/core/property-sort.test.ts`, 4 properties):
  - Row count preserved.
  - Column names preserved.
  - Idempotence (objects() equality).
  - Output is a permutation of input rows (multiset equality check).
- [x] **Aggregate** (`src/core/property-aggregate.test.ts`, 5 properties):
  - Group count ≤ input row count.
  - Sum-over-groups equals sum-over-input.
  - Count-over-groups equals count-over-input (non-null).
  - Aggregate without groupby returns exactly one row.
  - Output columns include groupby and rollup names.

**Delta:** +17 tests (2338 → 2355). Suite still ≈15 s. All green. Typecheck clean.

### One finding

- **Filter idempotence breaks on empty result.** When a filter returns 0 rows, re-applying the same filter to the empty result loses column names (`aq.from([])` is schema-less). The handler's schema-preservation path only triggers when `input.rows > 0`. This is an Arquero edge case, not a correctness bug (the data is identical — zero rows). Documented as a carve-out in the idempotence property.

### Done (2026-05-03, follow-up)

- [x] **derive / fold / pivot / window properties** — closed in Session 2. See Session 2 close-out for the per-file rundown.
- [x] **Join properties** — closed in Session 2. New `joinCaseArb` two-table generator in `property-generators.ts`; 7 properties covering cardinality, partitioning of left rows between semi/anti, key-membership in inner/anti, the schemaless-right contract from Batch 1, and the SQL null-non-matching contract.

---

## Explicitly _not_ doing

Per the strategy doc's guidance on low-signal metrics — and to avoid make-work:

- ❌ No line/branch coverage threshold as a CI gate.
- ❌ No mutation testing wired into CI. If we run Stryker it's as a one-off diagnostic on `src/core/`, not a pass/fail gate.
- ❌ No snapshot tests for UI components. Assert on behaviour, not markup.
- ❌ No over-mocked handler tests. If a test requires stubbing internal domain modules to run, the module boundary is probably wrong — fix the architecture, not the test.

---

## Idioms and notes for test-writing

Conventions that emerged while writing Batch 1 have been promoted into [DEVELOPMENT-PATTERNS.md §3.6](DEVELOPMENT-PATTERNS.md) — see there for the empty-schemad-table idiom and the `FINDING:` / `SURPRISE:` naming convention. A lightweight idempotence pattern (`applyTwice(transform)` + `expect(once).toEqual(twice)`) is demonstrated in `src/core/transforms-idempotence.test.ts`.

---

## Log

- **2026-04-24** — Audited Tier 1, delivered Batch 1 edge-case coverage (+45 tests). Two findings pinned pending fix: empty-model join bug, all-null-sum surprise. This document created.
- **2026-04-24** — Fixed empty-`data` model bug in semijoin/antijoin/lookup. `handleJoin` (inner/left/right/full/cross) still needs the same guard — queued as follow-up. All-null-sum contract still awaiting decision.
- **2026-04-24** — Added SOUL.md §7 "Predictable, Not Clever" and resolved all-null aggregate contract to `null` for sum/mean/min/max/median (integer counts preserved for valid/distinct). Promoted TESTING_STRATEGY.md and TESTING_PROGRESS.md to first-class docs in CLAUDE.md, AGENTS.md, and quick-reference tables.
- **2026-04-24** — Closed Batch 1. Extended the `isSchemaless(right)` guard to `handleJoin` (inner/left/right/full/cross) with per-`how` semantics; +5 tests (2272 → 2277). Ready to start Batch 2 (null-in-join-keys, null-in-group-by, ReDoS in ast-validator, uniform all-null aggregate contract).
- **2026-05-01** — Closed Batch 2. Pinned null-in-join-keys (SQL-correct, no engine change), pinned null-in-group-by, added `undefined → null` normalisation to join outputs, surfaced null-key warning in the join dialog, and shipped Phase 1 ReDoS protection via `safe-regex2` in `ast-validator`. +20 tests (2277 → 2296). Phase 2 RE2-WASM filed to BACKLOG. Ready for Batch 3 (adversarial fixtures, multi-step composition, Tier 2 audit).
- **2026-05-01** — Batch 3 partial close. Built the adversarial fixture library (`src/__fixtures__/`, nine modules, per-fixture imports), wired into `schema-engine.test.ts` (27 inference tests) and a new `src/cli/file-loader.test.ts` (10 CSV-parsing tests). Added `src/core/composition.test.ts` with five multi-step scenarios. Pinned scientific-notation contract (integer/float, lossy-round-trip accepted). Surfaced one concrete finding: mixed CRLF/LF line endings throw a parse error because PapaParse picks the row terminator from the first newline. +42 tests (2296 → 2338). Tier 2 audit (handlers, services, components) still queued.
- **2026-05-03** — Kicked off property-based testing. Added `fast-check@4.7.0`, built a shared dataframe generator (`src/core/property-generators.ts`) with null sprinkling and chain-based arbitraries, and wrote 17 pilot property tests across filter (4), select (4), sort (4), and aggregate (5). All pass, typecheck clean, suite still ≈15 s. One finding: filter idempotence breaks on empty results due to Arquero's `from([])` schema-loss; documented as carve-out. Join properties deferred (two-table generator complexity). +17 tests (2338 → 2355).
- **2026-05-03** — Tier 2 audit + test additions. Inventoried ~150 source files across 8 layers; sampled 20 tests (12/20 behaviour-focused, 4 over-mocked in services layer, 2 borderline, 2 top-tier). Confirmed Failure Mode 2 (mocked-away interesting parts) concentrated in service layer, Failure Mode 3 (composition gaps) with only 1 multi-step E2E. Added DialogStore tests (19 tests, previously 0% store coverage), join E2E scenario (multi-source import → join → derive → export), WindowDialog tests (7 tests, most complex untested dialog). Surfaced latent ID-collision bug: same-millisecond Date.now() causes resolveModelInput to resolve wrong source. +27 tests (2355 → 2382).
- **2026-05-03** — Tier 2 close-out Session 1: dialog coverage. Wrote the `DedupeDialog` test as a template (8 tests), then fanned out four parallel sub-agents with the template as reference. Closed coverage on 19 previously-untested dialogs across four batches: A (Append/Describe/Impute/Spread/Unroll, +34), B (six pattern + regexp dialogs, +42), C (TypeConversion/Generate/ImportText/ImportUrl/Download, +37), D (three meta dialogs: WorkflowImport/DependencyImpact/StepRemoval, +23). Total +144 tests (2382 → 2526). All green, typecheck clean, suite ≈16.6 s. Surfaced one real bug (DependencyImpactDialog plural keys broken for English), one stale BACKLOG entry (DownloadDialog already i18n'd), two a11y improvements, and several i18n drift findings. Sessions 2 (stores + remaining property tests) and 3 (architectural mocking lift) still queued.
- **2026-05-03** — Fixed `DependencyImpactDialog` plural-keys bug surfaced in Session 1. Replaced the manual Slavic-style ternary with `t('dependencyDialog.message', { count })` so i18next picks the locale-correct plural form. Extended `src/test-setup.ts` mock to do English plural resolution (try `_one`/`_other` suffixes when `count` is supplied) so future plural-form mismatches surface in tests. Added two regression tests pinning singular and plural rendering. +2 tests (2526 → 2528). Documented Sessions 2, 3, and 4 plans in this file (Future sessions section) so they can be picked up cold.
- **2026-05-03** — Closed Session 2: per-dialog stores + remaining property tests. Added `dialogs.test.ts` covering all nine signal-bag stores (typeConversion, importUrl, settings, preview, generate, importCsv, importText, workflowImport, reset-registry) — 23 tests. Pinned the user-prefs preservation contract on `settingsState.reset`. Property tests for the remaining transform families: derive (4), window (5), fold/pivot (6), join (7) — using a new `joinCaseArb` two-table generator with configurable key overlap and unique-by-construction right keys. Round-trip property `pivot(fold(t)) ≈ t` holds. SQL null-non-matching is now a property, not just an example. +45 tests (2528 → 2573). Suite ≈16.75 s. Sessions 3 (architectural mocking lift) and 4 (wrap-up) still queued.
- **2026-05-03** — Closed Session 3: architectural mocking lift. Two parallel Explore agents mapped the seams in `WorkflowImportService.test.ts` and `lazy-loading-data-integrity.test.ts`; both verdicts were "refactor for real" because `StepService`/`DependencyService` are static, accept `ComputeContext` as a parameter, and have no hidden singletons. Removed `vi.mock('./StepService')` from both files and `vi.mock('./DependencyService')` from the lazy-loading file. Reworked four assertions in `WorkflowImportService.test.ts` to inspect resulting `model.steps`/`model.data`/`model.schema` instead of `mock.calls`. Lazy-loading file's 9 tests passed unchanged — the `DependencyService` stubs were "useful by accident" (returning defaults that match real behaviour for fixtures with no cross-model dependencies). Two findings: invalid `'number'` type in a multi-source workflow fixture was masked by the mock (real engine throws `Unknown target type: number`; fixed fixture to `'float'`); real `ColumnSchema` carries `format`/`originalPosition` beyond `{name, type}` (now using `expect.objectContaining`). ±0 tests (one renamed). Suite still ≈18 s, 2573 passing, typecheck clean. Session 4 (wrap-up) is the only remaining piece.
