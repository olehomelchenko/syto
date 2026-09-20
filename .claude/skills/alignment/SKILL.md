---
name: alignment
description: Review staged or uncommitted code to ensure quality, test coverage, and alignment with project specifications
disable-model-invocation: true
---

# Code Alignment

Review staged or uncommitted code to ensure quality, test coverage, and alignment with project specifications.

## Scope

Determine the review scope using `git diff` (unstaged) and `git diff --staged` (staged). Review all changes in scope. If changes span multiple patterns below, apply all relevant sections.

## General Instructions

### Process

1. **Git**: **NEVER** stage (`git add`) or commit (`git commit`) changes — this is the USER's responsibility. If the reviewed changes span multiple independent concerns (e.g. a feature + an unrelated fix, or a refactor + a new capability), suggest splitting them into separate commits and mention the logical boundaries.

2. **Verification**: After changes, run the gates and leave them green:

   ```bash
   npm run typecheck && npm test && npm run lint:core && npm run lint:house && npm run lint:todo && npm run lint:docs && npm run i18n:check
   ```

   Each one refuses a defect no reading catches: `lint:core` typechecks the portable slice with the DOM removed, `lint:house` refuses `eval` and a preact import in `src/core/`, `lint:todo` refuses an undated marker, `lint:docs` refuses a source path a document names that is not in the tree. If a gate fails, fix the issue if straightforward; ask the user if non-trivial or ambiguous.

3. **Judgment**: If unsure or multiple approaches exist, ask the user before proceeding. When guidelines conflict, prefer in this order: SOUL.md philosophy > FUTURE-PROOFING.md compatibility > DEVELOPMENT-PATTERNS.md conventions > local cleanup. These instructions are not strictly prohibitive — if a guideline has valid reason to be bypassed, mention it in the summary.

### Code Quality

4. **Code Cleanup**: Remove leftover code, unnecessary defensive programming, and simplify over-engineered solutions from iterative development. Examples: dead code from previous iterations, try/catch around internal calls that can't throw, abstraction layers wrapping a single implementation. Proceed with caution; ask for clarification if unsure.

5. **Styles and UI**: When implementing or altering CSS or layout, follow or generalize to existing patterns rather than writing them from scratch. Do not fix whitespace or formatting issues (trailing blank lines, extra newlines) — the project uses Prettier for that.

6. **Code Comments**: Comments should not duplicate what the code already expresses. Remove parroting comments (e.g., `// increment counter` above `counter++`). Instead, ensure comments capture non-obvious design decisions, constraints, "why" reasoning, and gotchas that would be hidden from reading the code alone. Flag missing comments where a reader would reasonably ask "why is this done this way?"

7. **Workarounds**: Flag code that works around a problem rather than solving it (e.g., `// HACK`, `// WORKAROUND`, silent catch-and-ignore, feature detection for internal bugs). If a workaround is justified (e.g., upstream bug, browser quirk, time constraint), ensure it has a comment explaining why and a reference to track resolution. If unjustified, replace it with a proper fix.

8. **Pre-existing & out-of-scope issues**: Leave a breadcrumb in the code for anything you notice but don't fix. **There is no such thing as "not my job" here** (`AGENTS.md` → AI Developer Protocol): a defect that predates the diff is still yours to record, because one maintainer means nobody else will find it and nothing will remember it. Reviewing a diff is when the surrounding code is open, which makes this the moment the recording costs least. This includes:
   - **Pre-existing patterns** in surrounding code (duplicated logic the new code follows, workarounds it builds on, missing abstractions it exposes).
   - **Observations arising from the current change** that you decide are out of scope (redundant logic the refactor exposes, naming drift, mildly leaky abstractions, benign-but-suboptimal patterns).

   Mark these with a `// TODO(YYYY-MM-DD):` comment at the relevant site, explaining _what_ could be improved and _why_. The date is today's, and `npm run lint:todo` refuses an undated marker — the census cannot triage a deferral it cannot age. If the observation is important enough to mention in the summary, it's important enough to deserve a TODO at the code location too — otherwise the reader reviewing that code later has no way to find the context. Keep the TODO concise (1–3 lines) and include a pointer to the adjacent owner/contract when relevant (e.g. "see StepService.ts line ~246"). This leaves a trail for future work without scope-creeping the current review.

9. **PWA / Offline**: If changes add, remove, or change external resource URLs (CDN scripts, fonts, APIs), verify they are covered by a `runtimeCaching` rule in `vite.config.ts`. If a previously bundled asset moves to a CDN, this is a potential offline regression.

10. **Internationalization (i18n)**: All user-facing strings must use i18n. Flag any new hardcoded English strings in UI components (use `useTranslation()` hook), handlers, or services (use `i18n.t()` with namespace option). New keys must be added to both `src/i18n/locales/en/` and `src/i18n/locales/uk/` JSON files. Run `npm run i18n:check` to verify key parity across locales. See [DEVELOPMENT-PATTERNS.md §9](docs/DEVELOPMENT-PATTERNS.md) for patterns.

11. **Module placement**: `src/core/` is portable — it runs in Node under the CLI with no DOM, no Preact, and no editor or rendering library. `npm run lint:core` proves the type half. The half it cannot prove is placement: a module whose only importers are under `src/app/` belongs in `src/app/`, whatever its types say. `expression-language.ts` sat in core for months passing every check, because CodeMirror's DOM dependency hides behind `skipLibCheck`. Flag a new module in `src/core/` that no core module and no CLI path imports, and flag a core module the diff gives its first app-only dependency.

### Output

12. **Summary**: After performing the instructions, respond with a summary of changes: choices made due to these instructions, choices where multiple approaches existed, and any non-obvious architectural choices or assumptions the user should know about but might not notice from the diff alone. If the summary mentions an observation that you chose not to fix (per rule #8), confirm that a `// TODO:` breadcrumb was placed at the relevant code site so the context is recoverable later.

---

## Pattern A: New Functionality

### Testing

- Write unit tests for new core logic
- Add UX tests for new UI components or interactions
- Ensure tests pass before proceeding

### Documentation

Update relevant internal docs if the feature is significant:

- **[SPECIFICATION.md](docs/SPECIFICATION.md)**: Architecture or feature additions
- **[DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)**: New data structures or transform schemas
- **[UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)**: New UI patterns or components
- **[UI-VOCAB.md](docs/UI-VOCAB.md)**: If new controls or interaction patterns are introduced
- **[MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)**: If feature affects dependency graph or multi-model operations
- **[BACKLOG.md](docs/BACKLOG.md)**: Mark completed items

If adding expression functions:

- Update JSDoc comments in `src/core/ast-interpreter.ts` with full metadata
- Run `npm run docs:generate` to update user-facing function docs
- Verify with `npm test -- function-docs-validation.test.ts`

For documentation guidance, see **[CLAUDE.md](CLAUDE.md)** — the Documentation Index and Quick Reference table.

The list is not exclusive - if you think another document needs update, proceed with it.

### User-Facing Content

All user-visible copy — labels, tooltips, error messages, notifications, narrative docs — must follow **[CONTENT-GUIDELINES.md](docs/CONTENT-GUIDELINES.md)**: sentence case, active voice, no "please", no exclamation marks in errors, no editorial meta-talk. Review new or changed strings against it.

If the feature changes user-visible behavior or adds new capabilities, check each of these for drift — do not assume "docs will get updated later," it doesn't. Update English and Ukrainian together. In Ukrainian prose, use **Сито** not "Syto" (see [CONTENT-GUIDELINES.md §2.3](docs/CONTENT-GUIDELINES.md)).

- **`src/content/getting-started.md`** (+ `src/content/uk/getting-started.md`): The narrative onboarding doc — first page new users read. Re-read it whenever the change touches any of:
  - Ribbon tab names, groups, or the three-tab split (currently **Rows / Columns / Table**)
  - Import sources (drag-drop, URL, paste, sample datasets, synthetic data)
  - Transforms, EDA panel capabilities, or features described in the "typical workflow" section
  - Workflow export / CLI / DuckDB references, or the tips list
  - Links to other docs pages (sidebar slugs like `/docs/shortcuts/` — broken links here are the most common failure mode)
- **`src/content/shortcuts.md`** (+ `src/content/uk/shortcuts.md`): Hand-maintained, no registry backs it. If the diff touches **any** of these sources, re-audit:
  - `src/app/handlers/core/keyboard-handlers.ts` (global shortcuts: Ctrl/Cmd+S, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Delete, Arrow nav)
  - `src/app/orchestration/EventRouter.ts` (Escape, Enter routing)
  - `src/app/components/DataTable.tsx` (table keyboard nav, Shift+Arrow range)
  - Dialog-level keyboard handling added via `useFocusTrap` or new component-local handlers
- **`src/content/about.md`** (+ UK): Update feature descriptions or counts if the about page references them.
- **No editorial meta-talk** in any of these files — see [CONTENT-GUIDELINES.md §1](docs/CONTENT-GUIDELINES.md).
- **`src/content/functions/*.md`**: Auto-generated via `npm run docs:generate` — never edit directly. If the diff adds or changes an expression function, regenerate.
- **UI copy**: Review labels, tooltips, placeholders, and help text in affected components for accuracy. Ribbon tooltips (`src/i18n/locales/{en,uk}/ui.json` under `ribbon.buttons.*`) are user-facing — write them for users, not for engineers.

### Dependencies

If `package.json` changed:

- Flag each new dependency and explain what it does and why it's needed
- Could it be avoided with a small custom implementation? If so, mention the trade-off
- Prefer dependencies that solve genuinely hard problems (parsing, rendering, crypto) over those that save boilerplate

### Alignment Check

Verify changes align with:

- **[SOUL.md](SOUL.md)**: Project philosophy (must not violate without good reason)
- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)**: Coding conventions and patterns
- **[FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)**: Persistence compatibility if feature touches data formats or storage
- **[UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)**: UI consistency if feature adds or modifies components

---

## Pattern B: Bug Fixes

### Testing

- Add regression tests that reproduce the bug and verify the fix
- UX tests if the bug affected user interactions

### Documentation

Usually not required unless:

- The bug revealed incorrect documentation
- The fix changes documented behavior
- User-facing content (`src/content/`) described the broken behavior as expected

### Alignment Check

Verify the fix respects:

- **[SOUL.md](SOUL.md)**: Project philosophy
- **[FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)**: Backwards compatibility constraints
- **[DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)**: Data format consistency
- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)**: Coding conventions

---

## Pattern C: Refactoring

### Impact Analysis

Before proceeding with refactoring:

1. **Search for usages**: Use Grep to find all references to modified functions/methods/types across the codebase
2. **Identify call sites**: Document where the refactored code is used (components, services, handlers, tests)
3. **Check exports**: Verify if refactored items are exported and used by other modules
4. **Review dependencies**: Check what the refactored code depends on and what depends on it

### Testing

- **Update existing tests**: Ensure all tests for refactored code still pass and reflect new structure
- **Verify call sites**: Check that all usages of refactored code work correctly
- **Run full test suite**: Execute `npm test` to catch any breaking changes
- **Integration check**: Test user-facing features that rely on refactored code
- **Type safety**: Run `npm run typecheck` to ensure no type errors were introduced

### Documentation

Update affected documentation:

- **[SPECIFICATION.md](docs/SPECIFICATION.md)**: If architecture or module responsibilities changed
- **[DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)**: If data structures or interfaces were altered
- **[UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)**: If UI components or patterns were restructured
- **[UI-VOCAB.md](docs/UI-VOCAB.md)**: If control types or interaction patterns changed
- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)**: If coding patterns or conventions evolved
- Code comments: Update JSDoc or inline comments if function signatures or behavior changed

### Alignment Check

Verify refactoring aligns with:

- **[SOUL.md](SOUL.md)**: Simplicity and clarity principles
- **[DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)**: Consistent with project patterns
- **[FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)**: Maintains backwards compatibility where needed
- **[SPECIFICATION.md](docs/SPECIFICATION.md)**: Follows established architecture

### Common Refactoring Checks

- **Function signatures**: If changed, verify all call sites are updated
- **Type definitions**: Search for TypeScript type usages if interfaces/types changed
- **Imports**: Check that import paths are correct if files were moved
- **State management**: If signals/stores were refactored, verify all consumers
- **Props/interfaces**: If component props changed, check all usages
- **Constants/enums**: If renamed or restructured, find and update all references

---

## Reference Documents

| Document                                                          | Purpose                                         |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| [SOUL.md](SOUL.md)                                                | Project philosophy and core values              |
| [AGENTS.md](AGENTS.md)                                            | AI onboarding and project context               |
| [SPECIFICATION.md](docs/SPECIFICATION.md)                         | Technical architecture                          |
| [DATA-SPECIFICATION.md](docs/DATA-SPECIFICATION.md)               | Data structures and persistence                 |
| [UX-SPECIFICATION.md](docs/UX-SPECIFICATION.md)                   | UI/UX guidelines                                |
| [UI-VOCAB.md](docs/UI-VOCAB.md)                                   | UI terminology, design vocabulary, and patterns |
| [CONTENT-GUIDELINES.md](docs/CONTENT-GUIDELINES.md)               | User-facing copy: tone, case, i18n-friendly     |
| [FUTURE-PROOFING.md](docs/FUTURE-PROOFING.md)                     | Schema evolution constraints                    |
| [DEVELOPMENT-PATTERNS.md](docs/DEVELOPMENT-PATTERNS.md)           | Coding conventions                              |
| [MULTI-MODEL-ARCHITECTURE.md](docs/MULTI-MODEL-ARCHITECTURE.md)   | Dependency graph and multi-model system         |
| [FUNCTION-DOCS-SYSTEM.md](docs/FUNCTION-DOCS-SYSTEM.md)           | Auto-generated function documentation           |
| [I18N-GUIDE.md](docs/I18N-GUIDE.md)                               | Internationalization patterns                   |
| [DATE-STORAGE-ARCHITECTURE.md](docs/DATE-STORAGE-ARCHITECTURE.md) | Date/datetime handling rules                    |
| [DEBUGGING.md](docs/DEBUGGING.md)                                 | CSS Module debugging                            |
| [BACKLOG.md](docs/BACKLOG.md)                                     | Feature backlog                                 |
