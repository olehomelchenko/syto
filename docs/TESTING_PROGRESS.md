# Testing Progress

Companion to [TESTING_STRATEGY.md](./TESTING_STRATEGY.md). That document describes what _good_ looks like; this one tracks the state of the work against it.

Update this doc as batches land, findings are resolved, or priorities shift. Date entries so it's easy to see what's stale.

---

## Status at a glance

| Area                                                                         | State         |
| ---------------------------------------------------------------------------- | ------------- |
| Tier 1 audit (transform core, expression language, schema, integration, e2e) | ✅ done       |
| Tier 2 audit (handlers, services, components)                                | ⏸ not started |
| Batch 1 — deterministic edge cases                                           | ✅ done       |
| Batch 2 — contract decisions + ReDoS                                         | ✅ done       |
| Batch 3 — adversarial fixtures + multi-step composition                      | 🟡 partial    |
| Property-based testing (fast-check)                                          | ⏸ not started |

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

- [ ] **Tier 2 audit.** Handlers, services, components — the audit so far assumes these are similarly jagged to the Tier 1 finding pattern. Confirm with a representative sample before broad-brushing.

---

## Property-based testing (future)

Not started. The strategy doc argues strongly for this on the transformation core. Start small once Batches 1–3 are steady:

- [ ] Add `fast-check` dependency.
- [ ] Write a small dataframe generator (schemas + row shapes + null sprinkling).
- [ ] One property per transform family as a pilot:
  - `filter`: row-count invariant (`result.rows ≤ input.rows`); identity on always-true.
  - `select`: column-count invariant; idempotence.
  - `sort`: length preserved; permutation of input.
  - `aggregate`: group count ≤ input row count; sum-over-all rows preserved across group splits.

If the pilot catches real bugs, expand. If not, revisit whether the generator is too narrow before writing more properties.

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
