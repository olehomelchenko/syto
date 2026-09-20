# Syto Project

> **Purpose**: Onboarding document for AI agents working on Syto

---

## Project Overview

**Syto** is a browser-based data wrangling tool for cleaning and transforming tabular data. Think "Power Query in the browser" or "OpenRefine but simpler."

### Key Characteristics

- Runs entirely in browser (no backend)
- Visual pipeline builder with declarative JSON specification
- Target users: students, analysts, non-programmers
- No installation required, works on static hosting

### Technical Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Build         | Vite, TypeScript, Vitest              |
| UI            | Preact, Signals, CSS Modules          |
| Data          | Arquero (transforms), PapaParse (CSV) |
| Expressions   | jsep (parsing), custom interpreter    |
| Visualization | Vega-Lite                             |
| Storage       | IndexedDB, localStorage, URL hash     |

---

## Security Requirements (Critical)

These constraints are non-negotiable:

1. **No `eval()` or `Function()`**: Never execute user input as raw JavaScript
2. **AST Whitelist**: All expression nodes and functions must be explicitly allowed
3. **Sandbox**: Expressions cannot access global objects (`window`, `document`)

See `src/core/ast-validator.ts` for the whitelist implementation.

---

## Codebase Orientation

### Directory Structure

```
src/
├── core/           # Portable data engine (transforms, expressions, schema)
│                   # No browser APIs, no Preact — usable in Node.js
├── i18n/
│   ├── core.ts     # Portable i18n registry (i18next only)
│   ├── index.ts    # App i18n (adds Preact bindings + language detection)
│   └── locales/    # Translation files (en, uk)
├── app/
│   ├── components/ # Preact UI components with CSS Modules
│   ├── stores/     # Signal-based state (AppStore, DialogStore)
│   ├── services/   # Business logic (import, export, persistence)
│   ├── handlers/   # Event handlers and UI logic
│   ├── infrastructure/ # Browser-specific adapters (IndexedDB, localStorage, URL)
│   └── types.ts    # TypeScript definitions
├── content/        # Markdown content (about, help)
styles/             # Global CSS (variables, base, layout)
docs/               # Documentation
```

### Key Entry Points

- `src/main.tsx` — Application bootstrap (renders `App`, calls `initApp()`)
- `src/app/orchestration/AppOrchestrator.ts` — App initialization: callback wiring, data loading, URL restore
- `src/core/transforms.ts` — Transform implementations
- `src/core/schema-engine.ts` — Type inference and propagation

For detailed codebase map, see [SPECIFICATION.md](docs/SPECIFICATION.md) §3.

---

## Development

### Common Scripts

```bash
npm run dev       # Start dev server (vite, port 5173 when free)
npm run build     # Type-check and build
npm run build:cli # Build CLI (esbuild → dist-cli/cli.mjs)
npm test          # Run Vitest
npm run typecheck # tsc --noEmit over the whole tree
npm run format    # Prettier
```

**The gates.** Each refuses a defect no reading catches. All of them run in
CI (`.github/workflows/ci.yml`) and at `/wrap-up` step 4. What each one is
for, what seeded its threshold, and what it cannot prove: [HARNESS.md](docs/HARNESS.md).

```bash
npm run lint:core   # the portable slice typechecked with the DOM removed
npm run lint:house  # the absolute bans: no eval, no preact in src/core/
npm run lint:todo   # the marker census: count, age, and the undated failure
npm run lint:docs   # every source path a document names resolves in the tree
npm run lint:dup    # duplication, ratcheted at the measured percentage
npm run lint:unused # dead files, exports and dependencies, at a seeded ceiling
npm run i18n:check  # translation key parity across locales
```

### AI Developer Protocol

- **No such thing as "not my job"**: This project has one maintainer. A bug, a stale document, a broken example or a wrong claim that was already there when you arrived is still yours — nobody else will find it, and nobody will remember it unless you write it down. So write it down, always, in the one place it belongs: a dated `// TODO(YYYY-MM-DD):` at the code site when it lives at one site, an entry in [BACKLOG.md](docs/BACKLOG.md) when it is ranked work, a correction to the document when the document is what is wrong. Never two homes for one fact, and never only in the chat — a finding stated in conversation and nowhere else is a finding you have thrown away. Fixing it in passing is better than recording it, when the fix is small and the change is yours to make. Recording it is the floor, and skipping it is not an option the session has.
- **No Staging or Committing on your own initiative**: Don't run `git add`, `git commit`, or `git push` unprompted. If the user explicitly invites you to commit (e.g. "go ahead and commit this"), you may stage and commit on their behalf — that's still the user driving, just delegated. Default remains: hands off git, the user runs it.
- **Verification**: After changes, run `npm run typecheck` or `npm test` to catch errors. Before calling behavior correct, run it — `/verify` drives the app headless and the CLI for real. A green suite is evidence about types, not about what happens.
- **Spec Before Code**: For non-trivial features, draft a brief spec (goals, constraints, edge cases, testing strategy) collaboratively with the user before writing implementation code.
- **Ask for Context**: Before working on unfamiliar code areas or library-specific logic, ask the user which files, docs, or examples to read — don't assume from file names alone.
- **Flag Entropy**: If you notice growing complexity, duplication, or structural drift during a task, proactively suggest refactoring — don't wait to be asked.
- **Explain Stack Choices**: When introducing stack-specific patterns, configs, or dependencies, explain what problem they solve in plain terms — not just what they do.

### Versioning

The project uses **simplified semver during pre-1.0** (`0.x.y`):

| Bump                | When                                       | Example           |
| ------------------- | ------------------------------------------ | ----------------- |
| **Minor** (`0.x.0`) | New features, UI changes, behavior changes | `0.2.0` → `0.3.0` |
| **Patch** (`0.x.y`) | Bug fixes, polish, performance             | `0.2.0` → `0.2.1` |

- **Single source of truth**: `version` in `package.json` — Vite injects it as `__APP_VERSION__` at build time
- **Every deploy gets a version bump** — no unversioned releases
- **Version is displayed in**: Settings dialog, exported workflow JSON (`sytoVersion` field)
- **Git tags**: Each release is tagged `v{version}` (e.g., `v0.2.0`)
- **Workflow `formatVersion`** is independent of the app version — only bump it when the workflow schema changes
- **CHANGELOG**: `docs/CHANGELOG.md` is updated with each version bump
- Use the `/release` skill to walk through the version bump process

### Testing Philosophy

- High coverage on core logic (parsing, transforms, schema)
- Tests co-located in `src/core/*.test.ts`
- UI tests in `src/app/components/*.test.tsx`
- See [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) for diagnostic questions, failure modes, and the audit protocol for evaluating new or existing tests

---

## Project skills

Each skill is a markdown file under `.claude/skills/<name>/SKILL.md`. Claude Code runs one as a slash command; any other agent reads the file and follows it. What each does and why: [HARNESS.md](docs/HARNESS.md) → The skills.

- **`/wrap-up`** — the review pass before anything is committed: the knowledge flush, the clean-context reviewer, then every gate green on the arbitrated tree. Run it when the session is wrapping.
- **`/alignment`** — diff review against this project's rules, fixing directly. `/wrap-up` runs it clean-context.
- **`/verify`** — drive the app headless or run the CLI for real. A green suite is evidence about types, not about behavior.
- **`/doc-update`** — flush what the session learned into the right document.
- **`/release`** — version bump, changelog, tag. Human-invoked only.

`.claude/agents/cold-reader.md` is a subagent brief: it reads one page as that page's reader and reports every point where the reader stops.

---

## Session wrap-up protocol

When the user signals the session is wrapping — asks to commit, says it's done, says it's wrapped — **run `/wrap-up` and follow it before anything is committed**. Its alignment step is the session's one clean-context diff review: a clean-context review of the same diff run earlier in the session is that step run twice. Commit only when invited.

---

## Documentation Index

Every document has one home and one subject. When two disagree, the one nearer the code wins.

### Project vision

- **[SOUL.md](SOUL.md)** — philosophy, core values, design principles. _Read this first._

### Core specifications

- **[SPECIFICATION.md](docs/SPECIFICATION.md)** — technical architecture, codebase map, implementation details
- **[DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)** — data structures, transform format, expression syntax, persistence
- **[UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)** — UI/UX guidelines, component patterns, theming
- **[UI-VOCAB.md](docs/UI-VOCAB.md)** — UI terminology and design vocabulary
- **[FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)** — schema evolution constraints and persistence compatibility

### Development guides

- **[HARNESS.md](docs/HARNESS.md)** — the loop around agent work: the hooks, the gates and what seeded each threshold, the skills, what each agent tool reads, and what is deferred with its trigger. _Read before changing anything under `.claude/`, `AGENTS.md`, or a script a hook calls._
- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)** — how to add transforms, testing patterns, state management conventions
- **[TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)** — testing principles, diagnostic questions, failure modes, audit protocol. _Read before adding or evaluating tests._
- **[I18N-GUIDE.md](docs/I18N-GUIDE.md)** — adding languages, namespaces, plural rules, common patterns
- **[FUNCTION-DOCS-SYSTEM.md](docs/FUNCTION-DOCS-SYSTEM.md)** — the JSDoc → markdown/JSON function documentation pipeline
- **[DEBUGGING.md](docs/DEBUGGING.md)** — CSS Module debugging and DevTools tips
- **[BACKLOG.md](docs/BACKLOG.md)** — active feature backlog
- **[MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)** — dependency graph, staleness tracking, multi-model operations
- **[DATE-STORAGE-ARCHITECTURE.md](docs/DATE-STORAGE-ARCHITECTURE.md)** — date/datetime handling, JavaScript Date pitfalls, developer rules
- **[CONTENT-GUIDELINES.md](docs/CONTENT-GUIDELINES.md)** — product copy: what user-facing text may and may not say

### Reviews

- **[ARCHITECTURE-REVIEW.md](docs/ARCHITECTURE-REVIEW.md)** — extensibility friction, prioritized findings
- **[PRACTICE-AUDIT.md](docs/PRACTICE-AUDIT.md)** — the 2026-07-26 three-repository practice audit: what to export to Astrolabe and Arkush, what to import from them, 13 findings each with a friction type, a fix and a status. _Two findings reach users and are still open — F2 (CSV column loss between browser and CLI) and F11 (corrupted Ukrainian function documentation), both marked "fix before the next deploy"._ A frozen point-in-time document: its quoted defects are evidence rather than drift.
- **[TRANSFORM-ARCHITECTURE-REVIEW.md](docs/TRANSFORM-ARCHITECTURE-REVIEW.md)** — transform design analysis and roadmap

### Reference

- **[docs/arquero/](docs/arquero/)** — Arquero library documentation (verbs, expressions, operators)
- **[DECISIONS.md](docs/DECISIONS.md)** — architecture decision records
- **[docs/future/](docs/future/)** — roadmap documents (CLI, native app, monetization, example workflows)
- **[CHANGELOG.md](docs/CHANGELOG.md)** — historical record of completed features

### Quick reference

| Topic                  | Where to look                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- |
| Data structures        | [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md) §1-3                      |
| Expression syntax      | [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md) §4                        |
| Expression functions   | [FUNCTION-DOCS-SYSTEM.md](docs/FUNCTION-DOCS-SYSTEM.md)                       |
| How transforms work    | [SPECIFICATION.md](docs/SPECIFICATION.md) §3, §5                              |
| Adding new transforms  | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §1                    |
| Testing patterns       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §3                    |
| Testing strategy       | [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)                               |
| State management       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §2                    |
| UI component patterns  | [UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md) §3                            |
| UI vocabulary & terms  | [UI-VOCAB.md](docs/UI-VOCAB.md)                                               |
| Content & writing      | [CONTENT-GUIDELINES.md](docs/CONTENT-GUIDELINES.md)                           |
| What's safe to change  | [FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)                                 |
| Date handling rules    | [DATE-STORAGE-ARCHITECTURE.md](docs/DATE-STORAGE-ARCHITECTURE.md)             |
| Adding tool pages      | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §10                   |
| Site structure         | [SPECIFICATION.md](docs/SPECIFICATION.md) §3.5                                |
| CSS debugging          | [DEBUGGING.md](docs/DEBUGGING.md)                                             |
| Architecture decisions | [DECISIONS.md](docs/DECISIONS.md)                                             |
| CLI & workflow v2      | [SPECIFICATION.md](docs/SPECIFICATION.md) §3.6                                |
| Multi-model & chaining | [MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)               |
| Versioning & release   | Versioning above, [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §11 |
| DuckDB experimental    | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §12                   |
| Adding a setting       | [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) §2.3                  |
| The harness            | [HARNESS.md](docs/HARNESS.md)                                                 |
| Project philosophy     | [SOUL.md](SOUL.md)                                                            |

---

## Documentation maintenance

**Keep this file stable.** Index, invariants, protocol and conventions — no volatile details (counts, file lists, line numbers) that go stale as the codebase moves. Delegate specifics to the documents above and update those instead.

**This file is the entry point for every agent.** `CLAUDE.md` is Claude Code's pointer to it plus the lines only Claude Code needs. A fact stated in both files is a fact that will diverge; state it here.

**A document states what is, not how it got there.** When a decision changes what a document says, rewrite the statement in place rather than appending the amendment. History lives in [DECISIONS.md](docs/DECISIONS.md) and [CHANGELOG.md](docs/CHANGELOG.md). Two deliberate exceptions: [PRACTICE-AUDIT.md](docs/PRACTICE-AUDIT.md) and anything under [docs/future/](docs/future/), which are point-in-time records whose date is the point.

**A source path a document sets off as code is checked.** `npm run lint:docs` fails on a path that names nothing in the tree, so a rename that misses a document goes red rather than quietly misleading the next reader.
