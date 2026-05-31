# Testing Strategy

A reference for humans and coding agents working on this repository. Its purpose is **not** to prescribe what tests must exist, but to give enough principles and diagnostics that an agent can audit what _does_ exist and make informed proposals — or confirm that the current approach is sound.

This document assumes you are Syto or a project of similar shape: a browser-first, no-backend data-wrangling tool with a transformation pipeline at its core, a reactive DAG model, and a UI built on Preact + TypeScript. The principles generalise; the examples lean on that shape.

---

## The meta-principle

**Tests exist to give confidence that changes are safe to ship, at a cost in time you'd otherwise spend on features.** Everything downstream — pyramids, trophies, property-based vs. example-based, coverage targets — is a local optimisation for that trade-off in a specific context.

For a workflow that relies heavily on agentic coding, this reframes to:

> Tests are the mechanism by which a coding agent's changes can be trusted as non-destructive without the human reading every diff.

If the test suite doesn't serve that purpose, adding more tests of the same kind won't help. This document is about identifying _which_ tests do serve that purpose for this codebase.

---

## Two diagnostic questions to ask before adding or evaluating tests

1. **If this test passes, what am I now allowed to believe?**
   If the answer is "the function called the mock I told it to call," the test protects nothing. If the answer is "this transformation preserves row count on any well-formed input," the test protects a real invariant.

2. **If the implementation were rewritten from scratch against the same public contract, would this test survive?**
   If yes, the test is coupled to behaviour. If no, it is coupled to structure — and will fight every refactor rather than enable it. Kent Beck's formulation: _tests should be coupled to the behaviour of code and decoupled from its structure._

A good audit of the existing suite can largely consist of running these two questions across representative tests.

---

## Where bugs actually come from (and therefore where tests should live)

When tests pass but bugs still ship, the gap is almost always one of three kinds. The fixes are different for each, so naming the failure mode matters more than adding volume.

### 1. Inputs the author didn't think of

The dominant failure mode for data tools. Example-based tests can only cover inputs the author imagined; real users produce inputs the author didn't. For a Power-Query-style tool this shows up as: works fine on the sample CSV, breaks on a file with `\r\n` line endings, a BOM, a column that's sometimes numeric and sometimes string, or Unicode combining characters in headers.

The counter-technique is **property-based testing** for the pure transformation core: instead of asserting on specific input/output pairs, assert on _properties that should hold for any valid input_ and let the framework generate adversarial cases. fast-check is the standard tool for TS.

Properties that tend to apply to data transformations:

- **Idempotence** — applying a filter twice should equal applying it once.
- **Identity** — filtering with a predicate that is always true should return the input unchanged.
- **Round-trip** — `parse(serialize(df))` should equal `df` for any serialisable `df`.
- **Row-count invariants** — filter never increases row count; a left-join on a unique key preserves left-side cardinality.
- **Type preservation** — after a transformation, the declared schema should match actual cell types.
- **Composition** — `filter(map(xs, f), p)` should equal `map(filter(xs, x => p(f(x))), f)` when `f` is pure.

Property tests are high-signal but have real costs worth knowing up front:

- Writing good **generators** for domain types (realistic dataframes, valid schemas) is non-trivial. Naïve random generation will miss the structural constraints that make inputs interesting. Budget for this.
- Property tests are a **complement to example tests, not a replacement**. Keep specific regression tests for specific bugs; use properties for the invariants.
- They cost CPU. A property test running 1000 iterations on a slow operation is not free. Scope them to the core logic where the payoff is highest.

### 2. Tests that mock away the thing you actually want to test

If tests heavily mock the dataframe engine, the reactive DAG, or the parsing layer, what's being tested is "my code called the thing I told it to call" — which is tautological. The test fails only if both the code _and_ the mock are wrong, which is not the scenario you're protecting against.

The rule of thumb: **mock at I/O boundaries (file reads, network, clipboard, IndexedDB), not inside the domain.** In a browser-first app with no backend, most logic can run in tests with real implementations (real parsers, real transformations, jsdom/happy-dom for DOM). If a test has to mock the transformation engine to test the UI, that's usually a signal that the UI is too entangled with the engine, not that better mocks are needed.

The deeper design signal: when a module is hard to test without extensive mocking, the usual root cause is that business logic and infrastructure are tangled. The cheapest fix is usually architectural (push I/O to the edges), not better mocks.

### 3. Units pass, compositions break

Individual transformations can be correct while a chain of five of them drifts: types coerce subtly between stages, nulls propagate differently than expected, reactive re-computation fires in the wrong order. A reactive DAG makes this risk concrete.

The counter is a layer of **scenario tests**: load a fixture dataset, apply a realistic multi-step pipeline, assert on the final output and ideally on intermediate invariants. These are slower than unit tests and give vaguer failure signals, but catch a class of bug unit tests cannot.

---

## Picking the right test level

There's a long-running debate between the "testing pyramid" (mostly unit, few integration, fewer E2E) and the "testing trophy" (mostly integration, fewer unit, fewer E2E, plus static). Both are observations about specific contexts dressed up as universal rules. The honest version:

- **Pure logic with clear inputs and outputs** (transformation functions, parsers, type coercion, schema inference) → unit tests and property tests. Fast, precise failure signals, survives refactors if written against behaviour.
- **Stateful composition and user-facing behaviour** (reactive DAG, UI components, pipeline execution) → integration tests. Render the real thing, interact with it the way a user would, assert on outcomes. Testing Library's principle — _the more your tests resemble how the software is used, the more confidence they provide_ — applies here.
- **Full user journeys across the app** (open file → build pipeline → export result) → a small number of end-to-end tests, reserved for the handful of flows whose breakage would be catastrophic. E2E tests are slow, flaky, and give vague failure signals; keep them few and focused.
- **Static checks** (TypeScript, ESLint, schema validation at boundaries) → the cheapest tier. Bugs caught here cost nothing at runtime. Strict TS config is doing real testing work.

There is no correct ratio. The right question is not "do we have enough unit tests?" but "for each layer, are the tests there written against behaviour and do they catch the kind of bug that layer produces?"

---

## Anti-patterns worth naming

These are the test smells most likely to appear in a codebase that has tests but still ships bugs. Names are from _xUnit Test Patterns_ (Meszaros) where applicable; the catalogue at <http://xunitpatterns.com> is a good reference.

- **Tautological test** — asserts only that the code did what the code does (e.g. "calls setState with the value we passed to setState"). Passes forever, protects nothing.
- **Implementation-coupled test** — named and structured around internals (`test_calls_helper_X_then_Y`) rather than behaviour (`test_sorts_rows_ascending_by_column`). Breaks on refactor even when behaviour is preserved.
- **Over-mocked test** — so much is mocked that the test can only fail if the mocks themselves are inconsistent. The test is effectively running against a different program than production.
- **Shared mutable fixture** — tests that pass in isolation but fail depending on order, or vice versa. Usually indicates a global, module-level cache, or dirty setup/teardown.
- **Obscure test** — you can't tell from reading the test what scenario it represents or why that scenario matters. Usually a sign the test was added for coverage, not for a specific concern.
- **Slow suite** — if the full suite doesn't run comfortably in a pre-commit hook or on save, it will stop being run. Tests that aren't run aren't tests. A rough heuristic from practitioners: the unit-level suite should run in under ~15 seconds for it to stay in the active development loop.
- **Flaky test** — passes or fails non-deterministically. Every flaky test erodes trust in the whole suite; the team eventually learns to re-run CI rather than investigate. Either fix the flake (real race condition, real time dependency, real network dependency) or delete the test.
- **Snapshot test (UI)** — asserts on serialised markup rather than behaviour. Breaks on every benign markup change and protects nothing a user would notice. This repo does not use them: assert on what the user observes, not on the DOM shape.

---

## Metrics: what to measure and what to ignore

- **Line/branch coverage** — a lagging indicator at best, actively misleading at worst. A 90%-covered codebase with assertion-free tests is worse than a 60%-covered one with behaviour-focused tests. Useful only to spot _completely untested_ modules; useless as a quality target. Do not set coverage thresholds as pass/fail gates.
- **Mutation score** (via Stryker or similar) — a better signal, because it measures whether tests would actually _catch_ a bug, not just whether lines executed. But: slow, produces equivalent-mutant false alarms, and chasing score to 100% is a waste. Best used as an **occasional diagnostic** on the most critical modules: run it, read the surviving mutants, notice the _pattern_ of what survives (boundary conditions? null handling? error paths?), improve those tests. Not a CI gate.
- **Bug escape rate** — of the bugs found in the last N weeks, how many had a test that should have caught them and didn't? This is the honest metric, but it requires discipline to log.
- **Time to confidence after a change** — how long between "agent finished a change" and "human trusts the change enough to merge"? If tests are doing their job, this should be short.

---

## A practical audit a coding agent can run on this repository

This section is written for an agent that has access to the codebase. The goal is not to produce a score but to produce a _characterisation_ of the current suite, so a human can decide what to prioritise.

### Step 1 — Inventory

- List the test files and group them: pure-function unit tests, component tests, integration/scenario tests, end-to-end tests.
- Note which layers of the architecture (parsers, transformation core, reactive DAG, UI components, persistence) have what kind of coverage.
- Report any layer that has zero tests _and_ any layer that has tests but no integration-level coverage across it.

### Step 2 — Sample for the diagnostic questions

Pick ~10 tests that look representative (not cherry-picked to be good or bad). For each, answer:

1. If this test passes, what does it entitle us to believe?
2. Would this test survive a from-scratch rewrite against the same public contract?
3. How much of this test is mocks vs. real code under test?

Report the pattern, not individual verdicts. E.g. "7 of 10 are behaviour-focused; 3 assert on internal method calls and would break on refactor."

### Step 3 — Look for the three failure modes

- **Inputs the author didn't think of:** Is there any property-based testing in the codebase? If not, identify 3–5 transformations where properties (idempotence, round-trip, row-count invariants, type preservation) would be natural, and propose them. If yes, characterise coverage — what kinds of properties, on which modules?
- **Mocked-away interesting parts:** For the core transformation layer and the reactive DAG, are tests running against real implementations or stubs? If stubs, is that justified (genuine I/O boundary) or incidental (convenience)?
- **Unit-only, composition uncovered:** Are there integration-level tests that load a realistic input, run a multi-step pipeline, and assert on the final output? If not, propose two or three representative scenarios based on what the app actually does.

### Step 4 — Smells and operational health

- Identify flaky tests (if CI history is available) or tests likely to be flaky (timer-dependent, order-dependent, network-dependent).
- Identify slow tests and report whether suite runtime is in the "run on every save" or "run in CI only" regime.
- Identify implementation-coupled tests that would break on a plausible refactor.
- Identify obviously tautological or over-mocked tests.

### Step 5 — Recommend, don't mandate

Output should be a short report with:

1. **What's working** — named concretely (e.g. "parsing layer has good property coverage").
2. **What's missing or weak** — named concretely, with the failure mode it corresponds to.
3. **Suggested next actions, ranked by expected ROI** — the top 3–5 concrete changes that would most increase confidence per hour of work, with an estimate of effort for each.
4. **What deliberately _not_ to do** — explicit callouts for practices that would feel productive but are low-signal (e.g. "don't set a coverage threshold; don't wire mutation testing into CI").

The agent should be willing to report "the current suite is sound; no major gaps identified" if that's the honest finding. Padding the audit with make-work recommendations is itself an anti-pattern.

---

## When the agent proposes new tests

Whether driven by the audit above or by normal feature work:

- **Prefer properties and scenarios over isolated unit tests** for the transformation core.
- **Prefer rendering-based integration tests over shallow component tests** for the UI.
- **Mock at I/O boundaries only.** If a proposed test requires mocking internal modules, pause and ask whether the module boundary is wrong.
- **Every bug fix gets a test that reproduces the bug first.** This is the single most reliable way to calibrate the suite to actual failure modes rather than imagined ones.
- **Name tests for the behaviour they protect, not the function they exercise.** `sorts_rows_by_numeric_column_in_ascending_order`, not `test_sortRows`.
- **Keep adversarial fixtures in-tree.** A folder of real-world-ugly inputs (BOM, mixed encodings, ragged rows, Unicode edge cases, extreme numeric values, timezone-laden timestamps) is one of the highest-ROI artefacts a data tool can have. Every significant pipeline should either handle them or fail gracefully on them.

---

## Further reading

Pointers for the human, not homework for the agent.

- Martin Fowler, [TestPyramid](https://martinfowler.com/bliki/TestPyramid.html), [UnitTest](https://martinfowler.com/bliki/UnitTest.html), [TestDouble](https://martinfowler.com/bliki/TestDouble.html) — short, re-readable, cut through a lot of noise.
- Kent C. Dodds, [The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) and [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details) — the JS-UI-specific case for integration-heavy testing and against coupling tests to structure. Note the context: these are frontend-specific observations, not universal laws.
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles) — one line that shapes a lot of decisions: _the more your tests resemble the way your software is used, the more confidence they can give you._
- Harrison Goldstein et al., [_Property-Based Testing in Practice_](https://andrewhead.info/assets/pdf/pbt-in-practice.pdf) (ICSE 2024) — empirical study of real PBT users. The honest picture of what works and what's painful.
- Scott Wlaschin, [An Introduction to Property-Based Testing](https://fsharpforfunandprofit.com/posts/property-based-testing/) — the clearest catalogue of property patterns (round-trip, commutative, invariant, test oracle).
- [fast-check documentation](https://fast-check.dev/) — for TS.
- John Hughes, [Don't Write Tests](https://www.youtube.com/watch?v=hXnS_Xjwk2Y) — the QuickCheck origin-story talk. The best single argument for PBT.
- Gerard Meszaros, [xUnit Test Patterns](http://xunitpatterns.com) — reference for smells and patterns. Use the website; the book is repetitive.
- Michael Feathers, _Working Effectively with Legacy Code_ — the "seams" concept: where can you intercept behaviour to test it? Directly useful when retrofitting tests onto existing code.
- Noah Gibbs, [In Defense of Unit Tests](https://www.coffeeonthekeyboard.com/in-defense-of-unit-tests/) — the counter-argument to "mostly integration." Useful corrective.
