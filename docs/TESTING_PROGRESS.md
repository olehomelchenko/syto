# Testing Progress

Companion to [TESTING_STRATEGY.md](./TESTING_STRATEGY.md). That document describes what _good_ looks like; this one is the postmortem on the 2026 overhaul that got us there.

**The overhaul closed 2026-05-03. Final state: 2573 tests, suite ≈18 s, typecheck clean.** Per-batch and per-session detail lives in `git log`; this doc holds the load-bearing testing policy that future contributors should know about.

---

## What shipped

Three batches and four close-out sessions over April–May 2026:

- **Batch 1** — Deterministic edge cases on transforms (degenerate inputs, idempotence witnesses). Surfaced and fixed an empty-model join crash across all five join modes.
- **Batch 2** — Contract decisions + security. Pinned null-in-join-keys (SQL-correct), null-in-group-by (forms own group), `undefined → null` normalisation at engine boundaries, all-null aggregates → `null` for sum/mean/min/max/median per SOUL §7. Phase 1 ReDoS protection via `safe-regex2` in `ast-validator`.
- **Batch 3** — Adversarial fixture library (BOM/CRLF/extreme numerics/scientific notation/timezones/Unicode/mixed-type), multi-step composition tests, scientific-notation contract.
- **Property-based testing** — `fast-check@4.7.0` with a shared dataframe generator. Properties for filter, select, sort, aggregate, derive, window, fold/pivot, join. Round-trip `pivot(fold(t)) ≈ t` holds; SQL null-non-matching is a property, not just an example.
- **Tier 2 close-out** — Dialog coverage (20 previously-untested dialogs), per-dialog stores, architectural mocking lift on `WorkflowImportService` + lazy-loading tests (real `StepService` / `DependencyService` now run).

## Where the durable artifacts live

- **Null and contract decisions**: [DATA-SPECIFICATION.md §1.5](DATA-SPECIFICATION.md).
- **Test idioms and conventions**: [DEVELOPMENT-PATTERNS.md §3.6](DEVELOPMENT-PATTERNS.md) — `CONTRACT:` / `FINDING:` / `SURPRISE:` prefixes, empty-but-schemad table idiom, `ColumnSchema` shape note, NFC-normalisation gotcha.
- **Adversarial fixtures**: `src/__fixtures__/` with per-fixture imports; see `README.md` in that directory before adding new ones.
- **Property generators**: `src/core/property-generators.ts` — shared arbitraries for numeric tables, joins, etc.
- **Multi-step composition tests**: `src/core/composition.test.ts` is the home for "real pipeline" tests; add there rather than wedging multi-step assertions into per-transform files.
- **Outstanding ergonomic follow-ups**: [BACKLOG.md](BACKLOG.md) "Testing Audit Follow-ups" section.

---

## Explicitly _not_ doing

Per the strategy doc's guidance on low-signal metrics — and to avoid make-work:

- ❌ No line/branch coverage threshold as a CI gate.
- ❌ No mutation testing wired into CI. If we run Stryker it's as a one-off diagnostic, not a pass/fail gate.
- ❌ No snapshot tests for UI components. Assert on behaviour, not markup.
- ❌ No over-mocked handler tests. If a test requires stubbing internal domain modules to run, the module boundary is probably wrong — fix the architecture, not the test.
