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
| Batch 2 — contract decisions + ReDoS                                         | ⏸ queued      |
| Batch 3 — adversarial fixtures + multi-step composition                      | ⏸ queued      |
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

Needs a call from a human on the intended contract before tests can be written.

- [ ] **Null in join keys.** SQL semantics: `NULL ≠ NULL` → no match. Current Syto behaviour: unknown, untested. Decide and pin with tests for semijoin/antijoin/lookup.
- [ ] **Null in group-by column.** Tested in Batch 1 that nulls form their own group. Decide if that's the intended contract (vs. dropped, vs. error). Probably keep, but document.
- [ ] **ReDoS in `ast-validator.ts`.** The validator checks regex _syntax_ but not complexity. Patterns like `(a+)+b` or `(.*)*` pass validation and can freeze a tab at runtime. **Code change, not just a test.** Options: blocklist of known catastrophic patterns, complexity heuristic, RE2-backed engine. Then add tests for rejected and accepted patterns.
- [ ] **Aggregate-over-all-null for `mean` / `min` / `max`.** Extension of the Batch 1 surprise; decide uniformly.

---

## Batch 3 — Adversarial fixtures + composition

Bigger scope; queue these after Batches 1-2 are clean.

- [ ] **Adversarial-input fixture library.** `src/__fixtures__/` with: BOM, `\r\n`, Unicode combining characters in headers and cells, ragged rows, timezone-laden timestamps, scientific notation, extreme numerics (`MAX_SAFE_INTEGER`, subnormals, `-0`), mixed-type columns. Wire into `schema-engine.test.ts` and import tests.
- [ ] **Multi-step composition scenarios.** Currently one e2e test. Add 3–5 realistic pipelines covering:
  - Type drift across 4–5 stages (parse date → filter → derive → aggregate by month)
  - Join in a pipeline (lookup → filter → aggregate)
  - Window in a pipeline (window rank → filter rank ≤ 3 → aggregate)
  - Null propagation through a chain
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
