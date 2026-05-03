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
npm run dev      # Start dev server
npm run build    # Type-check and build
npm run build:cli # Build CLI (esbuild → dist-cli/cli.mjs)
npm test         # Run Vitest
npm run format   # Prettier
```

### AI Developer Protocol

- **No Staging or Committing on your own initiative**: Don't run `git add`, `git commit`, or `git push` unprompted. If the user explicitly invites you to commit (e.g. "go ahead and commit this"), you may stage and commit on their behalf — that's still the user driving, just delegated. Default remains: hands off git, the user runs it.
- **Verification**: After changes, run `npm run typecheck` or `npm test` to catch errors.
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
- See [TESTING_PROGRESS.md](docs/TESTING_PROGRESS.md) for the current state of coverage work — what's done, queued, and postponed

---

## Key Documentation

| Document                                                | Purpose                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| [SOUL.md](SOUL.md)                                      | Project philosophy and core values                   |
| [SPECIFICATION.md](docs/SPECIFICATION.md)               | Technical architecture and codebase map              |
| [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)     | Data structures, transform format, expression syntax |
| [UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)         | UI/UX guidelines, component patterns, theming        |
| [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md) | Coding conventions, adding transforms, testing       |
| [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)         | Testing principles, diagnostics, audit protocol      |
| [TESTING_PROGRESS.md](docs/TESTING_PROGRESS.md)         | Living log of testing-coverage work                  |
| [FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)           | Schema evolution constraints                         |
