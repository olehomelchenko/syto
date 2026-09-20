# Practice Audit — Syto

Written 2026-07-26 against `dev` @ `0af4361`.

One of three parallel audits. Syto, [Astrolabe](https://github.com/olehomelchenko/astrolabe),
and Arkush were each audited against an identical rubric on the same day, so that practice could
be levelled across the three rather than ranked. This file holds the Syto half: what this repo
does better than its siblings and should export, what it should import from them, and what none
of the three has yet.

**Method.** A clean-context auditor with no session history, required to cite file and line for
every claim, and to execute the command-line interface rather than reason about it. Tool
baseline: `npm run typecheck` → clean. `npm test` → **151 files / 2576 tests passed, 14.47 s**.
`npx madge` → 511 files, 5 cycles. `npx jscpd --min-tokens 50` → 495 clones, 6.70% duplicated.
`npx knip` → ran with no config, so its output needed manual triage.

Exact figures below are a frozen snapshot, not live numbers. This document follows the
[ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) format: each finding carries a friction type, a
fix, and a status.

---

## Verdict

**The thesis holds, and it holds better than this project's own documents claim.**

[SOUL.md](../SOUL.md) bets everything on the workflow specification being real — "the visual
builder produces this spec. The CLI executes it." That bet pays. The auditor executed a
three-model, two-source, join-and-aggregate workflow through `npx tsx src/cli.ts` and got the
right answer. All five documented exit codes verify. Stdin auto-bind works. The
command-line interface reaches exactly 72 modules and **zero** app modules.

**88 percent of `src/core/` is provably portable**, and the whole reachable graph typechecks with
DOM removed:

```
npx tsc --noEmit --lib ESNext --types node --strict --skipLibCheck src/cli.ts …
→ 0 errors
```

| Slice of `src/core/`                                         | Files | Lines     | Share     |
| ------------------------------------------------------------ | ----- | --------- | --------- |
| Reachable from the CLI — proven portable, runs in Node today | 50    | 6,587     | 74.5%     |
| Pure, but only consumed by the app                           | 5     | 865       | 9.8%      |
| Test-only, lazy, or type-only                                | 3     | 351       | 4.0%      |
| **Genuinely not portable**                                   | **2** | **1,043** | **11.8%** |

The engine is sound: 34 transform handlers on one signature in one registry with zero divergers,
eight property-based suites over a purpose-built generator module, an adversarial fixture library
including right-to-left override characters, **zero snapshot tests**, and null semantics pinned in
code with SOUL citations and named test files.

And the repository is cold in the cheap way. `dev` fast-forwards onto `main` with **zero
conflicts** — 59 commits ahead, `main` zero ahead. Both agent worktrees are prunable with nothing
unique in them. No merge debt, no half-finished refactor, no broken build.

**What is wrong is concentrated and mostly small.** Two defects reach users. Two instruments
exist in this repository and are wired to nothing. And 27 of 62 sampled documentation claims are
wrong, five of them being commands that fail when executed.

---

## 1. What this repo should export

These are assets the siblings lack. Each is worth copying out, and losing this repository would
lose them.

| Asset                                                                           | Why it is worth exporting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[TESTING_STRATEGY.md](TESTING_STRATEGY.md)**                                  | The best document in any of the three repositories. A defensible meta-principle, two reusable diagnostic questions, three named failure modes with distinct counter-techniques, eight anti-patterns with provenance, which metrics to ignore and why, and a five-step audit protocol an agent can execute. Both siblings inherited the one-line version ("test the core, trust the shell") and none of the reasoning. **Export it with an enforcement mechanism, not as prose** — see finding F6.                             |
| **[CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md)**                              | Concrete and enforceable, and verified followed: **zero violations across all 44 `dialogs:titles.*` keys.** Two clauses are unusually valuable — §1's ban on editorial meta-talk in user copy, and §2.3's rule that the product name transliterates in Ukrainian prose while staying Latin in URLs, commands, and package names. Arkush's own prior-art ledger already promised to adopt this verbatim and never did.                                                                                                         |
| **[FUTURE-PROOFING.md](FUTURE-PROOFING.md)** — the frame only                   | The safe / not-safe / requires-migration classification of every kind of schema change, plus a per-feature checklist. Any tool with persisted user documents needs this and neither sibling has it. **Do not export the content** — see finding F9.                                                                                                                                                                                                                                                                           |
| **[UI-VOCAB.md](UI-VOCAB.md)** §8–§9                                            | "How to prompt Claude for UI work" (seven dimensions plus a vague-versus-precise worked example) and "Clarifying questions Claude should ask" (eight rows with embedded thresholds). A shared vocabulary plus an interrogation protocol is what stops an agent inventing a fourth dialog geometry. §1–§7 are Syto-specific by nature.                                                                                                                                                                                         |
| **`cli.tsconfig.json`**                                                         | The cheapest possible portable-core fitness function: 24 lines, `lib: ["ESNext"]`, `types: ["node"]`, portable slice only. No new tooling, no new dependency, one `tsc` invocation. Both siblings should have one the moment either claims a layer is portable. Ours is orphaned — see finding F1.                                                                                                                                                                                                                            |
| **[.claude/skills/doc-update/SKILL.md](../.claude/skills/doc-update/SKILL.md)** | The best-designed skill here. A quality bar with a number ("would this save a future session at least 5 minutes of exploration?"), a three-way taxonomy that is genuinely clarifying (navigation map, good · decision rule, good · code walkthrough, bad), an anti-bloat step (_"Documentation that only grows eventually becomes noise"_), a routing table, and a "what NOT to document" section. **Had it been invoked once since the transform-handler refactor, eight of the 27 wrong statements in §4 would not exist.** |
| **[ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md)** — the format               | Five prioritized findings, each tagged with one of three named friction _types_ (per-feature tax = linear cost · cognitive coupling = slows everyone · composition ceiling = binary blocker), each with a Fix and an honest **Status**, plus a "What Works Well" section listing what is hard to retrofit. That format lets a review age gracefully instead of rotting into a wishlist.                                                                                                                                       |
| **[DECISIONS.md](DECISIONS.md)** — the "Revisit if" field                       | Each record carries a date, a research basis, a Decision, an alternatives-rejected table, and a **revisit trigger**. The trigger makes a decision falsifiable rather than permanent, and neither sibling has it. §4 also records two decisions _not_ to build things with the architectural cost that killed each — negative decisions are the ones teams forget and relitigate.                                                                                                                                              |
| **`.agent/` symlinked into `.claude/skills/`**                                  | Seven lines of front-matter pointing at `AGENTS.md`, plus symlinks so one source of truth serves two agent harnesses with zero sync burden. Neither sibling kept this. Ours is underused — `release` is not symlinked.                                                                                                                                                                                                                                                                                                        |
| **In-code contract pinning that cites SOUL**                                    | `handlers/aggregate.ts:17-19`: _"CONTRACT (SOUL §7): nulls in a groupby column form their own group, following SQL standard and Arquero's default… Pinned in transforms-aggregate.test.ts."_ A philosophy citation, the external convention it follows, and the enforcing test — in three lines at the site. It makes SOUL load-bearing instead of decorative.                                                                                                                                                                |
| **`src/__fixtures__/` as a first-class directory**                              | Including `combining-marks.ts` with a right-to-left override helper. `TESTING_STRATEGY.md` calls an in-tree ugly-input library one of the highest-return artifacts a data tool can have — and unlike most such advice, it was actually built.                                                                                                                                                                                                                                                                                 |
| **The `// TODO:` breadcrumb rule** (`/alignment` rule 8)                        | Anything noticed but not fixed gets a TODO _at the code site_, not only in a review summary. It works: three findings in this audit were pre-flagged by breadcrumbs the author left — `import-handlers.ts:363`, `handlers/filter.ts:32`, `cli/file-loader.ts:22`.                                                                                                                                                                                                                                                             |
| **The command-line interface as a fitness function**                            | 594 lines, 1.13 test ratio, and it works. It is also the **only proof any of the three repositories has that a portable core is real.** That dual role — product plus architectural fitness function — is the transferable idea.                                                                                                                                                                                                                                                                                              |

## 2. What this repo should import

### From Astrolabe

**A behavioral spec directory.** This repository has 44 KB of `DATA-SPECIFICATION.md` plus 48 KB
of `UX-SPECIFICATION.md`, which is _description_, not executable specification. The gap it closes,
precisely: `DATA-SPECIFICATION.md:351` asserts _"Each step in a pipeline is a single-key object.
Only one transform type per step"_ — a behavioral invariant that nothing enforces. See finding F4.

**An architecture playbook.** `ARCHITECTURE-REVIEW.md` is a point-in-time review. There is no
standing document saying where a new module _goes_. The gap it closes: `src/core/charts.ts` and
`src/core/expression-language.ts` are in `core/` while being imported only by app components. One
playbook rule prevents both — if only `app/` imports it and it touches the DOM, it lives in `app/`.

**eslint.** `tsc --strict` with `noUnusedLocals` and `noUnusedParameters` catches a lot. The class
eslint catches that `tsc` does not is truthiness and control-flow bugs — which is exactly finding
F5's `if (transform[key])`, a `no-unnecessary-condition` finding. Also unreachable today: the dead
`ribbonTab === 'data'` branch at `ModelService.ts:159`, when the three tabs are `rows`, `columns`,
and `table`.

**A knip config.** knip runs here and is unusable raw: 10 of its 18 "unused files" are
`src/tools/json-to-csv/*`, a live multi-page entry registered at `vite.config.ts:152` and linked
from `index.html:58`. So the two genuinely dead files and the genuinely redundant
`FullTransformStep` sit buried under roughly 200 false positives, nobody reads the output, and the
dead code stays. A six-line `knip.json` declaring the three HTML entries makes the signal usable.

**A build-output gate.** Astrolabe's `scripts/check-light-entries.mjs` is 47 lines that grep
emitted HTML for heavy vendor chunks and **fail closed** if the chunk names change. It asserts on
build output, not source. Directly relevant here: `DEVELOPMENT-PATTERNS.md:1491` claims the DuckDB
WASM is isolated in its own chunk, and `find dist -name '*.wasm'` returns nothing (finding F10).

**A `/council` skill routing to external canon.** `DECISIONS.md` shows the practice exists when
prompted ("8 production systems"; "IBM Carbon, Open Props, Shoelace, Radix/Ark UI, Tailwind") but
it is ad hoc, so it fires on big decisions and not on daily ones. The concrete miss is finding F2:
five divergent CSV parse configurations, where every mature CSV tool has a documented answer for
both empty and duplicate headers — including PapaParse's own renaming, which our CLI gets for free
and the browser throws away.

**Tests in the pre-commit hook**, and dark mode is **not** wanted here — `docs/style-guide.md`
states light-only as a design-system decision, correctly implemented and consistent. Do not import
it.

### From Arkush

**A headless verification runbook.** The strongest single import available. Four findings in this
audit required _running_ the code and are invisible to reading, typechecking, and 2,576 passing
tests: the `--output <dir>` crash, both broken format-spec examples, the silently-ignored
`--input` flag, and the browser-versus-CLI column divergence. `npm run typecheck` is clean, every
test passes, and all four are broken.

**A structural-review skill with deletion rules.** Everything it would find here is provable
today, which is the argument for it: `FullTransformStep` adds zero keys over `TransformStep`
(finding F7); 35 transform-key strings exist in three copies; `deriveNextSchema` is 672 lines in
one method (finding F3); `src/app/decorators.ts` and `src/app/utils/dev-helpers.ts` have zero
importers; 43 Title-Case `title:` strings in `dialog-registry.ts` duplicate `dialogs:titles.*`;
`Select/RemovePatternDialog` share 62 lines and `Derive/FilterDialog` share 57; the GoatCounter
loader is copy-pasted verbatim into three HTML files; `dialog-registry.ts:847-861` hand-writes a
kebab-to-camel map for 13 names that is derivable mechanically.

Import the report _format_ specifically, because it is where the bias lives: every finding states
its net line delta, "Remove" is a mandatory section that may be empty but whose emptiness must be
argued, an abstraction needs two existing call sites today, and **a refactor that adds a better way
without deleting the old way is a finding, not progress.**

**A clean-context reviewer at session wrap-up.** The gap it closes: `FUTURE-PROOFING.md` still
documents `if (transform.resample)` inline inside `applyTransform()` — the architecture the
transform-handler refactor replaced. The session that introduced `TRANSFORM_HANDLERS` had every
reason to believe the docs were fine, because it had spent the session inside the new pattern. A
reviewer entering cold would have flagged it in one minute. **Eight of the 27 wrong statements
live in exactly two documents** — the ones nobody re-reads.

**A portable-core check in `/alignment`.** Our 215 lines cover git hygiene, cleanup, comments,
workarounds, breadcrumbs, offline caching (rule 9), i18n parity (rule 10), dependencies, and
per-pattern doc updates — and never core purity. That is why `charts.ts` accumulated 755 lines and
11 DOM references inside a directory whose stated contract forbids them, while
[SOUL.md](../SOUL.md):139 still says _"This is by design, not accident."_

**Check routing and a check lifecycle.** Routing runs always-on checks in full plus every
conditional section the diff triggers, naming skipped sections in the summary so the skip decision
is auditable. The lifecycle retires checks downward — judgment check → grep-able check → lint rule
→ deleted — with whoever adds a check naming one that can now retire. The gap it closes here:
`cli.tsconfig.json` is a check that exists, works, and reports 11 real errors, and was never
registered, never run, and never retired. A lifecycle forces the choice — wire it up or delete it.

**A documentation register.** `CONTENT-GUIDELINES.md` governs _product_ copy well. Nothing governs
_internal_ prose. `DEVELOPMENT-PATTERNS.md` is 84 KB. `DATA-SPECIFICATION.md` has duplicated
section numbers (§4.1 twice, §3.2 twice) and a missing §6, while [CLAUDE.md](../CLAUDE.md):50-68
routes agents to "§4.1" — which cannot be resolved. `AGENTS.md` and `CLAUDE.md` duplicate roughly
40 percent of their content under a manual-sync instruction, which is the thing
[SOUL.md](../SOUL.md):121 rules out by name.

**A glossary as vocabulary of record.** `UI-VOCAB.md` is a UI glossary. There is no _domain_
glossary. The gap: the workflow format says `source`, the app's `Model` interface says `sourceId`,
`MULTI-MODEL-ARCHITECTURE.md` says `sourceId` while `WORKFLOW-FORMAT-V2.md` says `source`. And
`TransformStep` versus `FullTransformStep` are two names for one provably identical thing.

**A prior-art ledger with a verification date.** `WEAVERBIRD-COMPARISON.md` is prior-art
comparison carrying three wrong statements in 428 words — the highest error density of any
document here. A ledger with a "verified against code on `<date>`" field decays visibly instead of
silently.

**A sweep metric trigger.** A sweep is due when source lines grow about 25 percent past the last
recorded row, and each sweep writes the next baseline so the trigger re-arms. There is no metrics
file here and no sweep has ever run. What a periodic sweep would surface in one line: 20 unpushed
commits, `dist-cli/cli.mjs` four months stale, `dist/` three months stale, two prunable worktrees,
four stale branches, and `ARCHITECTURE-REVIEW.md` still claiming "116 test files" against 151 and
"April 2025" against a 2026-04-05 first commit.

**The agent-reader test**, from Arkush's `/doc-update`: _"would an agent trust this instead of
reading the code? If yes and it survives refactors, it is the point of the document. If yes and it
goes false, it is worse than nothing — a confident wrong answer costs more than a slow correct
one."_ [README.md](../README.md):74 says Claude Code does most of the heavy lifting here, so wrong
docs are wrong inputs.

## 3. What none of the three repos has

These are absences shared by all three. Nobody can copy them from a sibling.

1. **Tests in continuous integration.** All three rely on a pre-commit hook. Ours does not even
   run the tests, and `.github/` exists and is empty.
2. **A cross-engine equivalence test.** Every repo has two implementations of one behavior and no
   test asserting they agree. Here there are **three** instances: browser versus CLI CSV parsing
   (finding F2), the JavaScript versus DuckDB EDA engines (finding F8), and `DUCKDB_TRANSLATORS`
   covering 5 of 35 transforms as a third execution path.
3. **A doc-symbol resolution test.** A test asserting every backtick-quoted symbol in `docs/`
   resolves somewhere in `src/`. Astrolabe's auditor wrote it ad-hoc in one shell command and it
   found every name-drift defect in under a second. It would catch seven of the findings in §4
   here. **The cheapest missing instrument across all three repositories.**
4. **A generate-or-assert rule for transcribed lists.** Each repo has exactly one instance of the
   pattern and none generalizes it. Ours is the function-docs loop — and it has three holes
   (finding F11).
5. **Anything running on a cadence.** Three repositories, one whole-codebase review each at most,
   all early. Every instrument in all three is on-demand, and on-demand means "when someone
   remembers."
6. **A mechanism for sharing practice between the repositories.** `/alignment` exists in three
   divergent copies and improvement happens only in whichever repository is warm. Nothing has ever
   flowed backward — this repository still runs the three skills it had in December. Our `.agent/`
   symlink trick shows the mechanism already exists in miniature.

---

## 4. Findings

Each carries a friction type, a fix, and a status, per the `ARCHITECTURE-REVIEW.md` format.

### F1 — The portable-core check exists in this repository and is wired to nothing

**Type:** composition ceiling.

`cli.tsconfig.json` sits at the repository root. 24 lines. First committed 2026-03-21. It sets
`"lib": ["ESNext"]` and `"types": ["node"]` and includes exactly the portable slice. It appears in
**no npm script, no husky hook, and no continuous-integration job** — `grep -rn "cli.tsconfig"
package.json scripts/ vite.config.ts` returns nothing. `npm run typecheck` uses the root config,
whose `lib` includes DOM, so it can never see the problem.

Run it today:

```
$ npx tsc --noEmit -p cli.tsconfig.json
src/core/charts.ts(73,25): error TS2304: Cannot find name 'HTMLElement'.
… 10 more, all in charts.ts …
→ 11 errors, all in one file
```

The two violations in full. `src/core/charts.ts:1` imports `vega-embed` (a runtime value import of
a DOM-rendering library) plus 10 `HTMLElement` container signatures and one `MouseEvent`.
`src/core/expression-language.ts:6-7` imports `@codemirror/language` and `@codemirror/autocomplete`
as runtime values. `expression-language.ts` slips past the check only because `skipLibCheck: true`
hides CodeMirror's internal DOM dependencies.

**The impurity is latent, not breaking.** Both modules load in Node — `vega-embed` and
`@codemirror/*` are import-safe and only touch the DOM when called. The real cost is bundle weight
(any future `@syto/core` package drags in `vega-embed` at 662 KB plus CodeMirror at 356 KB) and the
erosion of a stated boundary that nothing defends.

**Fix.** Add `"check:core": "tsc --noEmit -p cli.tsconfig.json"` to `package.json`, then move
`core/charts.ts` and `core/expression-language.ts` to `src/app/` (`charts.ts` is imported only by
`EdaPanel.tsx`, `eda/EdaBivariateModal.tsx`, `eda/EdaBivariateStrip.tsx`, and `eda/chart-labels.ts`;
`expression-language.ts` only by `ExpressionEditor.tsx`). Five call sites. Also move
`core/vega-themes.ts`, which imports `Config` from `vega-lite` as a value rather than a type. After
the move the check goes green and the boundary is enforced rather than aspirational.

`ARCHITECTURE-REVIEW.md` already pre-registered this: _"If the CLI is a real product, make `core/`
a separate package. If not, don't pretend the boundary is clean. The current half-measure means
maintaining the discipline without the benefit."_ That is right — and the measurement shows the
discipline held far better than feared. Two files stand between the half-measure and the real thing.

**Status:** Done 2026-09-21. `npm run lint:core` runs the config, in CI and in `/alignment`.
`charts.ts`, `vega-themes.ts` and `expression-language.ts` moved to `src/app/services/`; five call
sites updated; the check goes green.

### F2 — Browser and CLI disagree on CSV import, and the browser loses a column

**Type:** composition ceiling. **This one reaches users.**

Five `Papa.parse` configurations for one job:

| #   | Site                                                               | Configuration                                                                |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | `handlers/import/import-handlers.ts:368`                           | `preview: uxSettings.preview.rowLimit`, no delimiter, **no `dynamicTyping`** |
| 2   | `handlers/import/import-handlers.ts:806` (the real browser import) | `delimiter`, `dynamicTyping: true`                                           |
| 3   | `handlers/import/import-handlers.ts:905`                           | **hardcoded `preview: 5`**, no `dynamicTyping`                               |
| 4   | `services/WorkflowImportService.ts:50`                             | `header: true`, `dynamicTyping: true`                                        |
| 5   | `cli/file-loader.ts:29` (the CLI)                                  | `header: headerMode !== 'auto-generate'`, `dynamicTyping: true`              |

Measured on identical input files:

| Input                       | CLI (`syto schema`)                                          | Browser (`mapRawDataToRows`)                                                     |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `a,,b` header               | columns `a`, `""`, `b`                                       | columns `a`, **`Column 2`**, `b`                                                 |
| `a,a,b` header              | `a`, **`a_1`**, `b` + "Duplicate headers found and renamed." | `a`, `b` — **the second `a` silently overwrites the first and a column is lost** |
| `headerMode: auto-generate` | `column_1, column_2, …`                                      | `Column 1, Column 2, …`                                                          |

[SOUL.md](../SOUL.md):24 says _"the same spec can be executed by different backends."_ For a
workflow whose source CSV has a duplicate or empty header, the browser and the CLI produce
**different column sets** from the same specification and the same file. The browser case is also
plain data loss with no user-visible signal — `mapRawDataToRows` (`import-handlers.ts:108-114`)
does `obj[col] = row[i]` in a loop.

`src/core/transforms/unique-names.ts` exists precisely to prevent silent column clobbering and is
called by seven transform handlers (`reshape.ts:26,92,144,165`, `aggregate.ts:14`) — but **not at
the import boundary, where the collision originates.**

**Fix.** One shared `parseCsvFile()` in `src/core/`, used by all five call sites, calling
`unique-names.ts` at the boundary. Add a test comparing the browser and CLI column sets on both
adversarial headers. A breadcrumb at `import-handlers.ts:363-366` already flags the three in-file
sites; the parity break is the part no document flags.

**Status:** Not started. Fix before the next deploy.

### F3 — `deriveNextSchema` is a 672-line hand-maintained mirror of a registry

**Type:** per-feature tax.

`src/core/schema-engine.ts:408–1079` is one method containing a hand-written `if (transform.X)`
chain over 24 transform keys. The execution side of the identical domain is a clean registry:
`TRANSFORM_HANDLERS` (`src/core/transforms/handlers/index.ts:30-84`, 34 entries), one file per
category, uniform `(table, transform, schema, context) => any` signature, plus 35 matching
describers in a parallel registry. **Two shapes for one concept.**

Adding a transform is one clean registry entry on the execution side and a hand-edit inside a
672-line method on the schema side. `DEVELOPMENT-PATTERNS.md:41` compresses the schema half into a
single checklist row that hides that cost.

The safety net under it is `src/core/transform-result.ts` — `TransformResult.create:27` compares
`table.columnNames()` against the derived schema and falls back on mismatch. It has **one test
reference.**

**Fix.** Move `TransformStep` and `KNOWN_TRANSFORM_KEYS` into `transforms/types.ts` (they are the
cause of the import cycle that forces the duplication in F7), then convert the chain to a
schema-propagation entry per handler, alongside the execution entry.

**Status:** Not started. The largest structural item here, and the one to consult on before
starting.

### F4 — Nothing enforces the single-key-step invariant, and an empty filter passes all rows

**Type:** cognitive coupling.

`DATA-SPECIFICATION.md:351` asserts _"Each step in a pipeline is a single-key object. Only one
transform type per step."_ Nothing enforces it. Two latent defects in the dispatcher, both
demonstrated live:

```
applyTransform(t, {filter: ''}, ['a'], null)
  → "Transform key "filter" not recognized. Skipping this transform.
     This may be from a newer version of Syto."   rows: 2 (unfiltered)

applyTransform(t, {select:['a'], filter:'a > 1'}, ['a'], null)
  → rows: 2, cols: ['a']   (select won by declaration order; filter silently dropped)
```

Cause: `src/core/transforms/apply-transform.ts:28` tests `if (transform[key])` — truthiness, not
key presence. An empty filter expression silently passes every row **and emits a misleading
version-skew warning.**

Separately, `syto validate` cannot see what breaks `syto run`. `validateV2Workflow`
(`src/core/workflow-v2.ts:97-193`) checks structure, references, cycles, and known keys, and never
payload shapes. The proof is in §5 items 1 and 2 — the format specification's own worked example
passes validate and fails run, twice.

**Fix.** Use `Object.prototype.hasOwnProperty` rather than truthiness, and reject multi-key steps
explicitly. Add payload-shape validation to `validateV2Workflow`. There is no JSON Schema for the
workflow format anywhere in `src/schemas/` despite [SOUL.md](../SOUL.md):119 naming a workflow's
schema as a case where one surface must derive from the other.

**Status:** Not started.

### F5 — Five import cycles, two of them real, both inside portable core

**Type:** cognitive coupling.

```
npx madge --circular --extensions ts,tsx src
✖ Found 5 circular dependencies!
1) core/type-converter.ts > core/ast-interpreter.ts > core/functions/index.ts > core/functions/type-functions.ts
2) core/type-converter.ts > core/ast-interpreter.ts
3) app/stores/DialogStore.ts > app/handlers/dialog/column-editor-handlers.ts
4) app/stores/DialogStore.ts > app/handlers/transform/join-handlers.ts
5) app/components/JoinDialog.tsx > app/components/join/index.ts > app/components/join/JoinTypeSelector.tsx
```

Cycles 1 and 2 are real runtime cycles inside CLI-reachable core: `type-converter.ts:8` imports
`parseToDate` from `ast-interpreter`, and `ast-interpreter.ts:3` imports `isConversionError` from
`type-converter`. Safe today because both symbols are called only inside function bodies. Latent:
any future top-level `const X = isConversionError(...)` in `ast-interpreter.ts` becomes
`undefined`.

Cycles 3, 4, and 5 are type-only and vanish at runtime — back-compat type re-exports at
`DialogStore.ts:28-29` and an `import type` at `JoinTypeSelector.tsx:4`. knip already flags those
three re-exported types as unused.

**Fix.** Extract the two shared predicates into a leaf module for cycles 1 and 2. Delete the three
type re-exports.

**Status:** Not started.

### F6 — 2,576 tests, and nothing runs them automatically

**Type:** composition ceiling.

`.husky/pre-commit` is `npx tsc --noEmit && npx lint-staged`. **No tests.** `.github/` exists and
contains zero files — no continuous integration of any kind. And local `dev` sits **20 commits
ahead of `origin/dev`** (origin last moved 2026-04-24, local `dev` 2026-05-31), so the entire
testing overhaul exists on one laptop and has never been validated anywhere else.

[TESTING_STRATEGY.md](TESTING_STRATEGY.md):96 names both the threshold and the consequence: _"if
the full suite doesn't run comfortably in a pre-commit hook or on save, it will stop being run.
Tests that aren't run aren't tests… the unit-level suite should run in under ~15 seconds."_ The
suite runs in **14.47 seconds**. The hook skips it.

Related, and a violation of the same document's own rules: **roughly 31 of 48 `vi.mock` calls
target internal domain modules**, which `TESTING_STRATEGY.md:66` forbids by name (_"mock at I/O
boundaries… not inside the domain"_). Targets include `services/StepService` (7),
`handlers/preview-engine` (7), `services/DependencyService` (3 — the document names "the reactive
DAG" explicitly), and `handlers/validation-engine` (2). Worst site: `ModelService.test.ts` — 12
`vi.mock` calls and 41 call assertions.

Two mitigating facts. `src/core` is almost mock-free: **not one `vi.mock` appears in any of the 43
core test files.** And the cleanup is already under way — commit `ae19ba1` is _"test(app): drop
internal-domain mocks in WorkflowImportService + lazy-loading tests"_, and `bac302b` extracted
`WorkflowImportService.parseSourceFile` precisely so a handler could be tested without mocking
PapaParse.

**Fix.** Add `npm test` to the pre-commit hook. Push the 20 commits. Add a test workflow. Continue
the mock cleanup at `ModelService.test.ts`.

**Status:** In progress on mocks (about 60 percent). The gates are done as of 2026-09-21 — a
`Stop` hook running typecheck and the suite once per source state, `.husky/pre-push` running both,
and `.github/workflows/ci.yml` running both plus six lint gates
([HARNESS.md](HARNESS.md)). The suite stayed out of `pre-commit` deliberately: a commit-time run
repeats the turn-end run on identical source. **The 20 commits are still unpushed.**

### F7 — `FullTransformStep` is provably redundant, and the key list exists three times

**Type:** per-feature tax.

Mechanically diffed `src/core/transforms/types.ts:34-83` against `src/core/schema-engine.ts:40-140`:

```
TransformStep keys: 35
FullTransformStep keys: 16
overlapping: 16   byte-identical declarations: 16   differing: 0
only in FullTransformStep: []
```

All 16 keys it declares are **byte-identical** to declarations already in `TransformStep`. Its own
doc comment calls it a _"superset"_ — it is a duplicate. About 50 lines deletable, roughly 20
importers to switch. jscpd caught the overlap and knip independently flags it as an unused type
export.

Separately, the 35 transform-key strings exist in **three copies**: `KNOWN_TRANSFORM_KEYS`
(`transforms/types.ts:100-137`), an inline array (`schema-engine.ts:1026-1059`, same set,
different order), and the `TransformStep` interface itself. The inline copy exists because
`schema-engine.ts` cannot import from `transforms/types.ts` — `types.ts:1` imports `TransformStep`
_from_ `schema-engine.ts`. **The duplication is a symptom of the type living in the wrong module**,
which is the same root cause as F3.

**Fix.** Delete `FullTransformStep`. Move `TransformStep` and `KNOWN_TRANSFORM_KEYS` to
`transforms/types.ts` and import them in `schema-engine.ts`.

**Status:** Not started.

### F8 — The DuckDB path is a silent second engine

**Type:** cognitive coupling.

`eda-compute.ts:73` and `:104` swallow every DuckDB failure with `catch { if (DEV) console.warn }`
and fall back — so **in production a broken DuckDB path is indistinguishable from a working one,
and a wrong-but-not-throwing SQL result is returned with no warning at all.** Zero test references
for `DuckDBService.ts`, `DuckDBEdaEngine.ts`, and `eda-compute.ts`.

Two engines compute the same statistics: `core/eda-engine.ts:225` (manual sort plus
`getPercentile` linear interpolation at `:352`, population variance) and
`services/DuckDBEdaEngine.ts:17` (`QUANTILE_CONT`, `STDDEV_POP`), dispatched by
`eda-compute.ts:23`. They should agree. Nothing asserts it.

`duckdb-transforms.ts:130` is a third execution path — `DUCKDB_TRANSLATORS` covers 5 of 35
transforms with no cross-engine equivalence tests.

Compounding: `DuckDBService.ts:29` fetches the WASM from `cdn.jsdelivr.net` at runtime, so the
experimental engine needs internet and a third-party CDN. That contradicts
[SOUL.md](../SOUL.md):135's _"works offline"_ and is documented nowhere user-facing.

**Fix.** An equivalence test over a fixture dataset asserting both engines agree on each statistic.
Surface DuckDB failures to the user rather than swallowing them. Document the CDN dependency, or
self-host the WASM as `DEVELOPMENT-PATTERNS.md` §12 already recommends.

**Status:** Not started.

### F9 — `FUTURE-PROOFING.md` documents an architecture that was refactored out from under it

**Type:** per-feature tax.

Three of the 27 wrong statements in §5 come from this one file: the wrong path for
`KNOWN_TRANSFORM_KEYS` (twice), the pre-refactor `if (transform.resample)` inline pattern, and a
`FUNCTION_SIGNATURES` identifier that does not exist anywhere in `src/`. The document contradicts
`DEVELOPMENT-PATTERNS.md:38-43`, which has the current pattern right.

**The frame is still worth exporting** (see §1). The content needs rewriting against the current
transform-handler architecture.

**Fix.** Run `/doc-update` over it once, cold. Same for `I18N-GUIDE.md`, which carries four wrong
statements including plural-suffix syntax from a superseded i18next major.

**Status:** Not started.

### F10 — Oversized modules doing more than one job

**Type:** cognitive coupling.

| File                                  | Lines | Jobs                                                                                                                                                                   |
| ------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/schema-engine.ts`               | 1,127 | See F3                                                                                                                                                                 |
| `handlers/import/import-handlers.ts`  | 1,004 | 24 exported functions over at least 8 concerns, holding 3 of the 5 CSV configurations from F2                                                                          |
| `app/dialog-registry.ts`              | 901   | Metadata, inline apply-handler logic, a hand-written kebab-to-camel map at `:847-861`, 6 query helpers, and 43 hardcoded English titles duplicating `dialogs:titles.*` |
| `services/StepService.ts`             | 795   | 16 statics: pipeline execution, caching, DuckDB routing, initial-step construction, context assembly                                                                   |
| `components/RibbonToolbar.tsx`        | 751   | 6 popover components, 3 tab panels, and the toolbar                                                                                                                    |
| `core/charts.ts`                      | 755   | 10 chart builders, **zero tests**, and the sole `cli.tsconfig.json` blocker                                                                                            |
| `handlers/transform/join-handlers.ts` | 614   | Join preview, key-pair analysis, mismatch preview, save-as-new-model                                                                                                   |

Duplication is 6.70 percent overall (495 clones), the highest of the three repositories. Top
cross-file production clones: `Select/RemovePatternDialog` share **62 lines** across two hunks and
should be one parameterized component; `Derive/FilterDialog` share **57 lines**, which is the
inline expression-help block `FUNCTION-DOCS-SYSTEM.md` §5 openly admits is _"manually maintained
in each dialog component"_ — a knowing "No Parallel Systems" violation with a generated source
(`src/schemas/functions.json`) sitting right there.

One clone jscpd could not see because it scans only `src/`: the GoatCounter analytics loader is
copy-pasted verbatim across `index.html:28-45`, `app/index.html:29-46`, and
`tools/json-to-csv/index.html:39-56`.

**Fix.** Parameterize the pattern-dialog pair. Render the expression-help block from
`functions.json`. Extract the GoatCounter loader. Split `import-handlers.ts` by concern once F2's
shared parser lands.

**Status:** Not started.

### F11 — Ukrainian function documentation is corrupted, under a promise of being always in sync

**Type:** composition ceiling. **This one reaches users.**

`FUNCTION-DOCS-SYSTEM.md` claims _"**Always in sync** — Docs regenerate on every build."_
`scripts/generate-function-docs.ts` (372 lines) contains **no reference to locales at all** —
`grep -n "uk\|locale"` returns nothing. The nine files under `src/content/uk/functions/` are
hand-maintained, and the drift test `core/function-docs-validation.test.ts` reads only
`src/content/functions/`.

Function-heading counts, English versus Ukrainian:

```
date 16/16 · text 15/15 · math 26/26 · regex 3/3 · json 6/6
conversion 6/4   ← MISMATCH
operators  6/5   ← MISMATCH
```

`src/content/uk/functions/conversion.md` is **corrupted, not merely stale.** It says "4 функції
доступно" where English says 6. `is_error` and `coalesce` are missing entirely, and the `if` entry
has been overwritten with `coalesce`'s content — description (_"Повертає перше не-null значення зі
списку аргументів"_), `coalesce`'s `args` parameter appended to `if`'s three, and `coalesce`'s two
examples pasted into `if`'s example block. `uk/functions/operators.md` separately drops the whole
"Error propagation" section.

**Ukrainian users reading the in-app function reference get wrong semantics for `if` and no
documentation for `is_error` or `coalesce`.** `npm run i18n:check` passes, because it compares JSON
keys and never reads markdown.

Two further holes in the same loop: the drift test never re-runs the generator and diffs, and never
compares `ALLOWED_FUNCTIONS` against `functions.json` — its only volume assertion is
`toBeGreaterThan(30)`. And `aggregate.md` and `let-bindings.md` are documented as generated but are
absent from the test's `requiredFiles` list.

**Fix.** Add locale support to the generator, then add a regenerate-and-assert-no-diff test — about
15 lines, and it makes recurrence impossible. Regenerate `uk/`.

**Status:** Not started. Fix before the next deploy.

### F12 — `SOUL.md` says "no tracking" and three pages load an analytics beacon by default

**Type:** cognitive coupling.

[SOUL.md](../SOUL.md):36 says _"No accounts, no uploads, no tracking."_ [README.md](../README.md):3
says _"no data leaving your machine."_ All three HTML entries — `index.html:28-45`,
`app/index.html:29-46`, `tools/json-to-csv/index.html:39-56` — load GoatCounter from
`//gc.zgo.at/count.js` in production **by default**, gated on an opt-out flag in `localStorage`. A
first-time visitor is counted before they can opt out.

It is page-view analytics, not data content, so _"data never leaves the machine"_ survives.
_"No tracking"_ does not. For a tool positioned at _"educational institutions, corporate
environments with data policies"_ ([SOUL.md](../SOUL.md):36), the gap between the claim and the
beacon is a reputational risk rather than a technical one.

**Fix.** Either make analytics opt-in, or amend the two claims to say what actually happens.

**Status:** Not started. A decision, not a build.

### F13 — Two genuinely dead files

**Type:** per-feature tax.

`src/app/decorators.ts` (22 lines, a `@Transformation` decorator) and `src/app/utils/dev-helpers.ts`
(51 lines) have **zero importers**. Verified after triaging knip's 18 false positives.

**Fix.** Delete both. Add a `knip.json` declaring the three HTML entries so the signal is usable
next time.

**Status:** Not started.

---

## 5. Documentation versus code

**27 wrong statements out of 62 sampled claims** across 51,371 words. Rate: 0.53 per 1,000 words.

**Five are executable examples that fail when run**, which is the most damaging class:

1. `WORKFLOW-FORMAT-V2.md:76` writes `{"filter": {"expr": "amount > 0"}}`. `filter` is a **string**
   (`transforms/handlers/filter.ts:9`). Running the format specification's own example:
   `Error: … Expression must be a non-empty string` (exit 4).
2. `WORKFLOW-FORMAT-V2.md:87` writes `"rollup": {"revenue": "op.sum(d.total)"}`. The real encoding
   is `op.sum('total')` (`transforms/rollup-spec.ts:20-24`). Running it:
   `Error: … Invalid column reference: "d["d.total"]"` (exit 4).
   **Both mistakes pass `syto validate`, which prints "Workflow is valid."**
3. `WORKFLOW-FORMAT-V2.md:204` — `syto run workflow.json --output results/`. For a single-output
   workflow this **crashes**: `Fatal error: EISDIR: illegal operation on a directory`.
   `writeCSV` (`cli/output-writer.ts:14-19`) does an unconditional `writeFileSync`; directory mode
   engages only when `workflow.outputs.length > 1` (`cli/run-command.ts:194`).
4. `README.md:30` — `node dist-cli/cli.mjs run workflow.json --input data.csv`. **`--input` is not
   a flag.** The CLI parses only `--bind`, `--output`/`-o`, `--json`, `--strict` (`src/cli.ts:56-80`)
   and rejects nothing unknown, so it is silently ignored, stdin auto-bind fires on empty stdin,
   and the first command a new user copies from the README fails with a confusing missing-columns
   warning.
5. `WORKFLOW-FORMAT-V2.md:293-298` — a four-row severity table plus _"The `--strict` flag promotes
   all warnings to errors."_ For `validate`, none of it exists: `ValidateOptions`
   (`cli/validate-command.ts:21`) has no `strict` field, every finding goes into one `allErrors`
   array printed as `Error:`, and "extra unexpected column" is never checked. (`run` does have the
   two-tier path — the document attaches it to the wrong command.)

**Seven wrong paths or non-existent identifiers:**

| Location                          | Claim                                               | Reality                                                                               |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `SPECIFICATION.md:133,596`        | `src/core/ast-interpreter.test.ts`                  | Does not exist. Split into `interpreter-functions/-operators/-date-functions.test.ts` |
| `SPECIFICATION.md:156,597`        | `src/core/transforms.test.ts`                       | Does not exist. Split into seven `transforms-*.test.ts`                               |
| `DATE-STORAGE-ARCHITECTURE.md:55` | `convertDatesForStorage()` in `src/core/storage.ts` | No such file. It is `src/app/infrastructure/storage.ts:24`                            |
| `I18N-GUIDE.md:182`               | "Update `src/core/ux-settings.ts`"                  | No such file. It is `src/app/infrastructure/ux-settings.ts`                           |
| `FUTURE-PROOFING.md` ×2           | `KNOWN_TRANSFORM_KEYS` in `src/core/transforms.ts`  | That file is a 10-line re-export barrel. The constant is in `transforms/types.ts:100` |
| `FUTURE-PROOFING.md`              | `FUNCTION_SIGNATURES` in `ast-validator.ts`         | No such identifier. It is `ALLOWED_FUNCTIONS` (`:50`) with arity inline               |
| `FUNCTION-DOCS-SYSTEM.md:150`     | "ALLOWED_FUNCTIONS + FUNCTION_ARITY"                | **`FUNCTION_ARITY` does not exist** anywhere in `src/`                                |

**Eight wrong counts and stale facts:** `I18N-GUIDE.md:23` says 6 namespaces (there are **7**, and
the test harness prints "Loaded 7 translation namespaces" on every run) · `SPECIFICATION.md:114`'s
namespace list omits `transforms`, the one core itself depends on · `WEAVERBIRD-COMPARISON.md:28`
says "71 functions across 9 categories" (**72 across 6**) · `:21` says "Syto's 33 steps" (**35**) ·
`ARCHITECTURE-REVIEW.md:4` says "Written April 2025" (first committed **2026-04-05**) · the same
file says "116 test files" (**151**) · `DEVELOPMENT-PATTERNS.md:797` documents a 200 ms
search-filter debounce that does not exist (the only debounce constant is 150 ms) ·
`I18N-GUIDE.md:132` cites "lines 21-35" for plural rules, which hold `SUPPORTED_LANGUAGES` — the
exact volatile-line-number construct [CLAUDE.md](../CLAUDE.md):79 forbids.

**Four wrong technical descriptions:** `DEVELOPMENT-PATTERNS.md:1491` says the ~3.5 MB DuckDB WASM
is isolated via `manualChunks` — it is not bundled at all (`DuckDBService.ts:29` loads it from
jsDelivr; `find dist -name '*.wasm'` returns nothing; and `DuckDBService.ts` contradicts itself
between its header JSDoc "~3.5 MB" and an inline comment "30-40 MB each") · `FUTURE-PROOFING.md`'s
inline `if (transform.resample)` pattern is pre-refactor · `I18N-GUIDE.md:118-122` documents
Ukrainian plural keys as `rows_0`/`rows_1`/`rows_2` when the codebase uses i18next v25 ICU
categories `_one`/`_few`/`_many` (`grep '"[a-zA-Z.]*_[012]"' src/i18n/locales/uk/*.json` → **zero
matches**, so an agent following this guide creates keys that never resolve) ·
`FUNCTION-DOCS-SYSTEM.md`'s schema example shows a `"generated"` field that does not exist.

**Three claims about drift protection the protection does not cover** — F11, plus:
`.claude/skills/alignment/SKILL.md` (Pattern A → Documentation) says _"Update JSDoc comments in
`src/core/ast-interpreter.ts`"_ for new expression functions. **Wrong file** — functions live in
`src/core/functions/*.ts`, which is where the generator reads from. **Our own review skill sends an
agent to the wrong file.**

**One navigability defect that is not a wrong statement:** `DATA-SPECIFICATION.md` has broken and
duplicated section numbering — §4.1 at line 349, then §3.2 at 406 (out of order, and 3.2 already
used at 316), then §4.5 at 754, then **§4.1 again** at 773, with §6 missing entirely.
[CLAUDE.md](../CLAUDE.md):50-68 routes agents to "§4.1", which cannot be resolved. The same
document's §4.1 `TransformStep` interface also lists **29 of 35** transforms, omitting `import`,
`selectPattern`, `removePattern`, `conditional`, `renamePattern`, and `promoteHeader` — five of
which have shipped ribbon buttons.

### What verified correct

35 of 62 claims held, including several that are hard to keep true:

- **`UX-SPECIFICATION.md` §3.1 is fully accurate** — the three ribbon tabs, every group, every
  action, and every quick-action count (5 text, 10 date, 6 number, 4 convert, 6 window presets),
  cross-checked against `SHORTCUT_REGISTRY` and `MorePopoverContent`. **Zero errors in the most
  volatile UI surface in the repository.**
- All four `DATA-SPECIFICATION.md` §2.3 sample sizes verify exactly: physical 20, logical 20,
  transform propagation 100, auto-detect 50.
- `DEVELOPMENT-PATTERNS.md` §1.1 is current and correct, including both checklists and the exact
  legacy-dialog set.
- `CHANGELOG.md:11`'s "all 31 transform dialogs" — exactly 31 files use `useDialogState`.
- `MULTI-MODEL-ARCHITECTURE.md` verifies fully — the interface, all five named helpers, all three
  named consumer files.
- `FUTURE-PROOFING.md`'s `KNOWN_COLUMN_TYPES`, `normalizeSchema()`, `DB_VERSION`, and
  `backupV1IfNeeded()` all verify.
- `CONTENT-GUIDELINES.md` §2.1 — **0 violations across all 44 `dialogs:titles.*` keys.**
- All five CLI exit codes, stdin auto-bind, `--json`, and multi-output directory mode verified by
  execution. `npm run i18n:check` passes.

**The docs are not rotten. Two of them are stale and nobody re-read them.**

---

## 6. Recommended sequence

Ordered by value per hour.

1. **One shared `parseCsvFile()`** — closes F2's divergence and the data-loss bug together, and
   calls `unique-names.ts` at the boundary where the collision starts.
2. **`npm test` in the pre-commit hook, and push the 20 commits.** One line, then a `git push`.
3. **Wire `cli.tsconfig.json` as `check:core`, then move the two files** — F1. Roughly one hour,
   and it retires an eight-month-old aspirational boundary.
4. **Locale support in `generate-function-docs.ts` plus a regenerate-and-diff assertion**, then
   regenerate `uk/` — F11.
5. **Payload-shape validation in `validateV2Workflow`**, and fix the two broken examples in
   `WORKFLOW-FORMAT-V2.md` and the `--input` line in `README.md` — F4 and §5.
6. **Run `/doc-update` over `FUTURE-PROOFING.md` and `I18N-GUIDE.md`, cold** — F9. Eight of the 27
   wrong statements live in those two files.
7. **Delete `FullTransformStep` and the two dead files; add a `knip.json`** — F7 and F13.
8. **A cross-engine equivalence test for the two EDA implementations**, and surface DuckDB failures
   instead of swallowing them — F8.
9. **Fix the two real core cycles** — F5.
10. **Consult before starting F3** (`deriveNextSchema`). It is the largest item and the one where a
    structural review earns its keep.
