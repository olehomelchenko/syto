# Harness — the loop around agent work

Built 2026-09-21, adapted from the harness in the sibling repository Arkush. This
document describes the hooks, checks, skills and review loops that surround agent
work here. It defines nothing about the app: behavior lives in
[SPECIFICATION.md](SPECIFICATION.md), data shapes in
[DATA-SPECIFICATION.md](DATA-SPECIFICATION.md), conventions in
[../AGENTS.md](../AGENTS.md).

## Why the harness exists

A written rule is advisory. `AGENTS.md` loads once at the start of a session, and
nothing else checks that a session still obeys it forty tool calls later.

This repository had the evidence for that before it had the harness. The
2026-07-26 practice audit ([PRACTICE-AUDIT.md](PRACTICE-AUDIT.md)) found:

- **2,576 tests that nothing ran automatically.** `pre-commit` typechecked and
  formatted; there was no `pre-push` and no continuous integration.
- **A working check wired to nothing.** `cli.tsconfig.json` had sat at the
  repository root since March, reporting 11 real errors, in no npm script and no
  job.
- **27 of 62 sampled documentation claims wrong**, five of them commands that
  fail when typed, eight concentrated in the two documents nobody re-reads.
- **`SOUL.md` claiming core purity is "by design, not accident"** while the
  charts engine sat inside `src/core/` carrying ten `HTMLElement` signatures. It
  is now [`src/app/services/charts.ts`](../src/app/services/charts.ts).

Each of those is a rule that was stated and never checked. **The parts of the
conventions that admit no judgment are now checks that run.** The parts that need
judgment stay prose, and `/alignment` is where a diff gets read against them.

## Hooks

A hook is a script Claude Code runs at a fixed point in a session. A `PreToolUse`
hook runs before a tool call and can refuse it. A `PostToolUse` hook runs after
one and reports back into the conversation. A `Stop` hook runs when a turn tries
to end and can hold the turn open.

**A hook reaches the agent two ways, and the rule it carries picks which.**
Exit 2 with a message on standard error is the **refusal**. Exit 0 with an
`additionalContext` field on standard output is the **advisory**. A rule that
admits no judgment refuses. A rule that asks for one advises, because an error
raised on a judgment call teaches the agent to skip past it.

Registered in `.claude/settings.json`:

| Hook                               | Event                     | Does                                                                     |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `.claude/hooks/house-rules.sh`     | `PostToolUse` Edit\|Write | Refuses an edit that breaks an absolute ban. Exit 2.                     |
| `.claude/hooks/markers.sh`         | `PostToolUse` Edit\|Write | Reports the markers the edited file carries, once per file per session.  |
| `.claude/hooks/turn-end-checks.sh` | `Stop`                    | Runs typecheck and the suite, and holds the turn open when either fails. |

Every hook reads its payload with `jq` and exits silently when `jq` is absent, so
a machine without it runs with the project hooks off.

**Every refusing hook has a script twin, and the script owns the check.** A hook
is Claude Code's; the script is everyone's. `house-rules.sh` hands the edited file
to `scripts/house-rules.mjs`, which CI runs over the tree as `npm run lint:house`.
`markers.sh` calls `scripts/markers.mjs --file` where CI runs `npm run lint:todo`.
The hook adds only the moment — at the edit, where the fix costs no round trip —
and the file that moment holds. **The smell is checkable in a diff:** a new
`.claude/hooks/*.sh` carrying a pattern of its own that no script under `scripts/`
also carries. An earlier draft of the marker hook in the sibling repository
shipped a second marker grammar in awk, and the two copies disagreed about what a
marker was before either had a caller.

**The turn-end gate runs once per source state, not once per turn.** An editing
session leaves `src/` dirty for its whole length, so a per-turn gate would charge
the full suite at every turn end. The script signs the source state and records
the signature of the last green run in `.git/syto-turn-gate`. A turn that changed
no source skips the suite in milliseconds while the tree stays dirty. A clean
`src/` skips it too, so a question-only turn never pays. A blocked stop sets
`stop_hook_active`, which the script checks first, so the gate never blocks twice
on one turn.

**Known gap in the signature:** it covers tracked content and the list of
untracked paths. Editing an untracked file under `src/` without adding it does
not move the signature.

## The verify gate

Each moment is placed by what it costs and what it catches.

| Moment                             | Runs                                        | Why there                                                         |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `.husky/pre-commit`                | `tsc --noEmit`, prettier over staged files  | A commit is a save.                                               |
| `.claude/hooks/turn-end-checks.sh` | typecheck, suite — once per source state    | The agent's own gate, covering states that never get committed.   |
| `.husky/pre-push`                  | typecheck, suite                            | Pushing is what reaches another machine.                          |
| `/wrap-up` step 4                  | every gate, on the arbitrated tree          | The reviewer's edits landed after its own green run.              |
| `.github/workflows/ci.yml`         | every gate, on push to `main`/`dev` and PRs | UTC on Linux, which is where a locale or date bug goes red first. |

**CI is not a duplicate of the pre-push hook.** Local gates run in the
maintainer's timezone, locale and platform.

Husky runs every hook as `sh -e`, so a hook must be tested that way. A pipeline
ending in `grep -c` returns 1 when it counts nothing, which under `-e` aborts the
hook — and for a gate that counts a defect, the abort lands on exactly the input
it should refuse.

## The house rules

`npm run lint:house` runs `scripts/house-rules.mjs` over every tracked source
file, and the hook runs it on one file after each edit. Two rules today, both
stated with no escape hatch elsewhere and both decidable by a pattern:

- **No `eval()` and no `new Function()`** anywhere under `src/`. `AGENTS.md` calls
  this non-negotiable. User expressions are parsed by jsep and walked by
  `src/core/ast-interpreter.ts` against the whitelist in `src/core/ast-validator.ts`.
- **No `preact` import inside `src/core/`.** `SOUL.md` says core runs in Node with
  no UI framework.

The population was zero on both when the gate landed, so both are ratchets from
the first day. Every check strips comments first: a ban's own prose names the
thing it bans, and stripping can only cause a miss, never a false report.

## The core-purity check

`npm run lint:core` runs `tsc -p cli.tsconfig.json` — the portable slice
(`src/core/`, `src/i18n/core.ts`, `src/cli/`) typechecked with `lib: ["ESNext"]`
and `types: ["node"]`, which is to say with the DOM removed. It is the executable
form of `SOUL.md`'s claim that the engine is architecturally portable.

It went green on 2026-09-21 by moving `charts.ts`, `vega-themes.ts` and
`expression-language.ts` out of `src/core/` into `src/app/services/`. All three
had app-only importers; the first two also carried DOM signatures.

**What it cannot prove is placement.** `expression-language.ts` passed this check
for months while importing CodeMirror, because `skipLibCheck: true` hides a
library's own DOM dependency. A module whose only importers are under `src/app/`
belongs in `src/app/` whatever its types say, and that judgment is `/alignment`
check 11.

## The marker census

`npm run lint:todo` runs `scripts/markers.mjs` over `src/` and `styles/`.

`/alignment` writes a dated `// TODO(YYYY-MM-DD):` at the code site for every
finding it does not fix, and `AGENTS.md`'s "no such thing as not my job" rule
obliges every session to do the same. That half worked. Reading them back did
not: the nine markers in this tree on the day the census landed were all recorded
in one week in May 2026 and none had been triaged since.

Two rules, and only one is a threshold.

- **An undated marker fails outright, with no threshold.** The date says when the
  line landed, so `git blame` supplies it and nothing has to be invented. An
  undated marker is the one a census cannot triage.
- **The total stays under a ceiling**, `CEILING` in `scripts/markers.mjs`, seeded
  at 15 against a measured 9 on 2026-09-21.

**Whether a threshold may rise depends on how its population grows.** A gate whose
count grows only through worse code is a **ratchet**: it moves down, and raising
it is the friction the check exists to create. `jscpd` and `lint:core` are
ratchets. A gate whose count also grows through **correct** work carries
**headroom**, because a ceiling seeded on its own measurement fails the build for
doing the right thing. The marker ceiling is that, and so is the knip ceiling.

**The ceiling refuses forgetting, never recording.** A gate that made a session
choose between writing down a finding and a green build would teach it to stay
quiet, which is the exact failure the census exists to prevent. A ceiling reached
is a signal to discharge markers or to raise it deliberately.

**Age is reported and never fails.** A trigger keyed to a count — "a third
instance extracts the helper" — that has seen two is waiting correctly, and the
calendar does not change that. The hook serves the touch-keyed triggers instead,
at the edit.

`npm run lint:todo -- --list` prints every marker with its comment block. The
trigger usually sits on the continuation lines, so a census that printed marker
lines alone could not be triaged from its own output.

**A marker is evidence, never an instruction.** Its premise is a measurement of
the tree at the moment of writing, and nothing points back at it when the tree
moves. Verify the premise before taking the fix, and correct it at the site when
it is wrong.

**A marker and a backlog entry never describe the same fact.** A marker is a
site-local note under the census; a [BACKLOG.md](BACKLOG.md) entry is ranked work.
Where a deferral is both, it is a backlog entry, and the marker carries a pointer.

**`docs/` is deliberately outside the census.** The specifications and the review
documents discuss deferrals in prose dozens of times, so a doc-wide count would be
noise rather than a census.

## The doc-pointer check

`npm run lint:docs` runs `scripts/doc-pointers.mjs`: every source path a document
sets off as code, or points a markdown link at, resolves in the tree. 262
pointers across 59 documents on the day it landed, six of them broken, all six
fixed in the same diff — two modules that had moved to `src/app/infrastructure/`
months earlier, and four test files that had been split into families.

A pointer is an address, not prose. Checking prose by machine does not work;
checking an address does, and a rename that misses a document is the drift this
catches. The practice audit called a check of this shape the cheapest missing
instrument across all three sibling repositories.

**What it skips, each for a reason a reader can check.** A token carrying a glob
or a brace is notation for a set, so `src/core/transforms-*.test.ts` and
`src/i18n/locales/{en,uk}/ui.json` are precise rather than wrong. A trailing line
reference is stripped. `app/` and `tools/` are not checked as prefixes: both exist
at the repository root as HTML entry directories **and** as shorthand for
`src/app/`, so a token starting with either is ambiguous rather than broken.
`docs/PRACTICE-AUDIT.md` is excluded by name — it is a frozen audit that quotes
broken pointers as its evidence, and correcting them would erase what it reports.

**It is one-directional on purpose.** It fails on a path that names nothing. It
says nothing about a module no document mentions, which is a judgment about what
deserves documenting.

## The duplication and dead-code checks

`jscpd` reports copy-pasted blocks. `knip` reports exports, files and dependencies
that nothing imports. Both are **exact-pinned** devDependencies, against the
surrounding caret style, for one reason: a threshold over a floating version moves
without a code change, which makes the number mean nothing.

- `npm run lint:dup` reads `.jscpd.json` — path `src`, formats `typescript`,
  `tsx` and `css`, threshold **6.49** percent of duplicated lines, the first
  hundredth above the 6.48 percent measured on 2026-09-21. The printed figure is
  rounded, so a threshold is read off a run rather than copied from the console.
  **The format list is what makes the number mean something**: the whole of `src`
  measures 6.91 percent, and the difference is test fixtures — 16 text files at 40
  percent duplication, which is what a fixture is.
- `npm run lint:unused` runs `knip --max-issues 281`, seeded on its own
  measurement: 9 unused files, 215 unused exports, 57 unused exported types.

**`knip.json` earns its own paragraph, because the config is most of the signal.**
Run with no config, knip reported 20 unused files — ten of them the live
`src/tools/json-to-csv/` pages, which are a real multi-page entry — and the two
genuinely dead files sat buried under the noise where nobody read them. The
config names the real TypeScript entry points (`src/main.tsx`,
`src/tools/json-to-csv/main.tsx`, the scripts, the tests) rather than the HTML
files that load them, because knip does not follow a `<script src>`. `src/cli.ts`
is deliberately absent: knip infers it from the `bin` field, and listing it again
drew a redundancy hint.

**The 281 is high and it is honest.** Most of it is nine barrel `index.ts` files
that nothing imports, plus their re-exports. That is a real cleanup, recorded here
rather than hidden by a config exclusion. Every deletion lowers the number in the
same diff.

**Neither gate reads `styles/` or `scripts/`.** Duplicated CSS outside `src/` and a
copy-pasted harness script are caught by review alone. Widening either scope needs
its own threshold seeded from a run.

## The skills

Each skill is a markdown file under `.claude/skills/<name>/SKILL.md`. Claude Code
runs one as a slash command; any other agent reads the file and follows it.

| Skill         | For                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `/wrap-up`    | The session review pass — knowledge flush, clean-context reviewer, green tree. Before any commit. |
| `/alignment`  | Diff review against this project's rules, fixing directly. Run clean-context at wrap-up.          |
| `/verify`     | Drive the app headless or run the CLI for real. Behavior, not types.                              |
| `/doc-update` | Flush session knowledge into the right document.                                                  |
| `/release`    | Version bump, changelog, tag. Human-invoked only.                                                 |

`/alignment` and `/release` carry `disable-model-invocation: true` for different
reasons. `/release` writes a tag, so only the human starts it. `/alignment` is
started by `/wrap-up` as a subagent that reads the file, which the flag does not
block.

**`.claude/agents/cold-reader.md`** is a subagent brief: hand it a page, a reader,
a task in that reader's words and a mode, and it reports every point where that
reader stops. Every check above holds a page to the code; this one holds a page to
its reader. `/wrap-up` step 3 sends a new page or a new task section through it.

## What each agent tool reads

| Layer                      | Claude Code                                                   | Any other agent                          |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Root instructions          | `CLAUDE.md`, which is `@AGENTS.md` plus the Claude-only lines | `AGENTS.md`                              |
| Refusing hooks             | `.claude/settings.json`                                       | the script twin, in CI and the git hooks |
| Advisory hooks             | `.claude/settings.json`                                       | none                                     |
| Skills                     | slash commands over `.claude/skills/`                         | reads the skill file on request          |
| The cold reader            | `.claude/agents/cold-reader.md` as a subagent                 | the brief, run as a fresh session        |
| Git hooks, npm scripts, CI | all                                                           | all                                      |

**What stays Claude Code's, and honestly so.** The advisory notice at the edit
pushes text into a conversation, and no cross-tool form of that exists. The
permission allowlist in `.claude/settings.json` is Claude Code configuration.
Neither carries a rule; every rule is in a file any agent can open.

## The repository and agent memory

Claude Code keeps per-project memory files on the maintainer's machine, outside
the repository. Those files reach one machine. A clone reaches every session.

**The repository owns every rule about working on this codebase**, the conventions
for commits and for answers included, because a session anywhere is expected to
follow them. **Agent memory owns what is true of one machine**: which account a
command needs, a deploy target's mechanics, a want that is the maintainer's to
trigger.

## Deferred, each with its trigger

- **A `madge --circular` gate at threshold 0.** The audit measured five import
  cycles, two of them inside portable core, all invisible to typecheck because a
  type-only cycle erases at build. The gate cannot be seeded at zero until those
  are resolved. **Trigger:** the cycle count reaches zero.
- **A cross-engine equivalence test.** Three pairs of implementations claim to
  agree and nothing asserts it: browser versus CLI CSV parsing, the JavaScript
  versus DuckDB EDA engines, and `DUCKDB_TRANSLATORS` as a third execution path
  over 5 of 35 transforms. **Trigger:** the next defect traced to a disagreement
  between two of them.
- **A reuse scout.** A read-only subagent that finds the existing helper before a
  new one lands. The audit named the population it would work on: 35 transform-key
  strings in three copies, two dialog pairs sharing 60 lines, a chart loader
  pasted into three HTML files. **Trigger:** the second helper re-rolled after
  this harness landed.
- **A codebase-metrics trend file, and a sweep that writes a row.** Nothing here
  records the trend between sweeps, so every review re-derives its numbers by
  hand. **Trigger:** the second review that re-measures what the first one
  measured.
- **Widening the duplication gate to `styles/` and `scripts/`.** Both sit outside
  every gate today. **Trigger:** the first copy-pasted harness script.

## Rejected, with the reason kept here

Each of these gets re-proposed, so the reason lives at the rule.

- **A coverage-percentage gate.** [TESTING_STRATEGY.md](TESTING_STRATEGY.md) tests
  the core hardest, trusts the UI shell, and deletes a test that mirrors the
  implementation's arithmetic. A coverage number rewards exactly the tautological
  tests that rule removes.
- **A deny rule on `rm`.** A deny rule carries no exceptions, because deny takes
  precedence over allow. It would block every legitimate delete and still miss the
  case that matters, where the path arrives through a variable. Ask rules are for
  intent; the sandbox is for blast radius.
- **Porting Arkush's whole harness.** Its access matrix, outbound-hosts matrix,
  licence gate, operator-docs checks, release-contract check and deployment
  framings are all sized to a server product with operators and customers. Syto
  ships a static site and a CLI, and a check with no failure mode in this codebase
  is ceremony.
