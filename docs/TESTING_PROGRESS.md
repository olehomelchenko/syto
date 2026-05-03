# Testing Progress

Companion to [TESTING_STRATEGY.md](./TESTING_STRATEGY.md). That document describes what _good_ looks like; this one tracks the state of the work against it.

Update this doc as batches land, findings are resolved, or priorities shift. Date entries so it's easy to see what's stale.

---

## Status at a glance

| Area                                                                         | State      |
| ---------------------------------------------------------------------------- | ---------- |
| Tier 1 audit (transform core, expression language, schema, integration, e2e) | ✅ done    |
| Tier 2 audit (handlers, services, components)                                | 🟡 partial |
| Batch 1 — deterministic edge cases                                           | ✅ done    |
| Batch 2 — contract decisions + ReDoS                                         | ✅ done    |
| Batch 3 — adversarial fixtures + multi-step composition                      | 🟡 partial |
| Property-based testing (fast-check)                                          | 🟡 partial |

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

- [ ] **Reduce mocking in WorkflowImportService and lazy-loading tests.** Both mock internal domain services (StepService, DependencyService) rather than testing against real implementations. Architectural lift required.
- [ ] **Untested dialogs.** 14 dialog components still have no tests (DedupeDialog, DescribeDialog, AppendDialog, etc.). Most follow the same `useDialogState` + preview pattern as tested dialogs — adding coverage is mechanical.
- [ ] **Untested stores.** 9 per-dialog state files remain untested. Low-ROI individually but collectively a gap.
- [x] **WindowDialog tests.** Added 2026-05-03. +7 tests. Complex dialog with novel logic (function config, conditional UI, auto-naming, editing).

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

### Still queued

- [ ] **Join properties.** Requires two-table generation and `TransformContext` setup — more complex generators. Deferred.
- [ ] **Property-based testing on additional transforms** (derive, fold, pivot, window, etc.). Pilot only covers the four primary transform families.

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
