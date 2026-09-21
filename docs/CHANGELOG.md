# Syto — Changelog

Historical record of completed features and improvements, organized chronologically.

---

## September 2026

### v0.5.0

- **`let` bindings in expressions** — Name an intermediate value once and reuse it inside the same expression, instead of repeating a subexpression. Available in Filter, Derive and Conditional; reference at `src/content/functions/let-bindings.md`.
- **Bracketed column names are parsed properly** — `[Column Name]` now goes through a native jsep plugin rather than a pre-pass, so names carrying spaces, slashes and hyphens (`[Country/Region]`, `[Sub-Category]`) parse the same way everywhere.
- **Click an EDA bar to act on it** — Categorical bars in the EDA panel open the cell toolbar, so a category goes straight to a filter.
- **Preview errors are shown** — Aggregate, Describe and Pivot report a failed preview in the dialog instead of leaving it blank.
- **Large-file warning** — A file over 100 MB now warns before the import dialog opens, rather than after the browser has struggled with it.
- **`Delete` removes the step you are viewing** — It always removed the last step, whatever was on screen. The keyboard reference said so too and has been corrected in both locales.
- **Joins and group-by pin their null semantics** — All-null aggregate output normalises to null (SOUL §7), and a join against a schema-less right table returns a well-defined empty result instead of throwing. Phase 1 ReDoS protection added to user-supplied patterns.
- **Collision guards for aggregate-style transforms** — split, spread and unroll name temp columns through `pickUniqueName`, so a column called `value` in the source no longer collides with one the transform makes.
- **Ukrainian coverage** — EDA chart tooltips, column-editor validation and the sidebar step count are now translated.
- **Faster import** — Dropped a defensive deep clone of source data on every import.
- **Internal** — The test suite grew to 2,576 tests across 151 files, with property-based coverage and an adversarial fixture library. An agent harness landed: refusing and advisory hooks, seven `lint:*` gates, continuous integration, and the `/wrap-up` and `/verify` skills (`docs/HARNESS.md`). `charts.ts`, `vega-themes.ts` and `expression-language.ts` moved out of `src/core/`, which is now provably portable — `npm run lint:core` typechecks it with the DOM removed.

---

## April 2026

### v0.4.1

- **Dialog state refactor** — Migrated all 31 transform dialogs from the global `DialogStore` state pattern to a local `useDialogState` hook. Per-dialog boilerplate dropped from ~13 files to ~9; `DialogCoordinator` and `DialogStore` shrunk significantly. No user-facing behavior change.
- **Transform callback indirection removed** — `executeTransform()` utility replaces the `setXxxCallbacks()` → `createExecutionCallbacks()` chain. "Go to definition" now lands on the implementation, not a stored callback reference.
- **Docs consolidation** — `DIALOG-MIGRATION.md` removed; its still-useful pattern guidance folded into `DEVELOPMENT-PATTERNS.md` §1.

### v0.4.0

- **Pipeline step caching** — Caches intermediate step results so editing a late step replays only from the change point, not the entire pipeline.
- **Quality bar on column headers** — Thin colored bars on column headers showing error and missing value percentages at a glance.
- **Context-aware expression autocomplete** — Autocomplete suggestions now adapt to expression context (e.g. column names after operators, functions after open paren).
- **Auto-match join keys** — Join dialog automatically matches key pairs when both tables share identical column names.
- **Bivariate chart suggestions & smart EDA defaults** — EDA panel suggests bivariate charts (scatter, grouped bar) and picks sensible axis/encoding defaults based on column types.
- **Manual PWA update prompt** — New version prompt lets users choose when to update, instead of auto-refreshing the page.
- **IndexedDB v1 backup** — Backs up v1 IndexedDB data before destructive v2 migration, so users can recover if something goes wrong.
- **Lazy-loading IndexedDB v2 schema** — Row data stored in separate `source-data`/`model-data` stores, loaded on demand per source/model. App startup loads only metadata. Automatic v1→v2 migration on first open.
- **DuckDB-WASM experimental engine** — Optional SQL-based computation engine for EDA stats and transforms, selectable in Settings. Loads from jsDelivr CDN on demand, falls back gracefully to the JS engine on failure.
- **Clickable missing/error counts** — Missing and error counts in the EDA panel are now clickable, applying filter actions directly.
- **Numeric/categorical treatment toggle** — EDA panel gains a toggle to view numeric columns as categorical (top values + frequency bars).
- **Landing page rework** — Restyled main landing page with about page content.
- **Empty strings as null** — Empty and whitespace-only strings are now treated as null instead of conversion error during numeric parsing.
- **Cell toolbar replace fix** — Fixed replace targeting the wrong column when triggered from error/null mode.
- **EDA boxplot pre-aggregation** — Pre-aggregates boxplot statistics to avoid Vega-Lite sorting the full dataset.
- **DuckDB race condition fixes** — Eliminated EDA panel flicker caused by dual sync/async computation paths; added execution queue to serialize DuckDB queries.

### v0.3.0

- **Interactive error cells** — Error cells now behave like regular cells: clicking selects them, hovering shows the error message in a tooltip. Cell toolbar offers filter (keep/exclude errors) and replace actions. Comparison operators are hidden since errors are not comparable.
- **Replace errors & nulls** — Replace dialog gains "Errors" and "Null" find modes, allowing bulk replacement of conversion errors or missing values in a column without writing expressions.

### v0.2.1

- **README rewrite** — Replaced the old sprawling README with a concise version covering what the tool does, how to run it, and how to contribute. Added screenshot.
- **MIT license** — Added LICENSE file.

### v0.2.0

- **ConversionError filter fix** — ConversionError objects (truthy in JS) no longer pass filter expressions or inflate match/success counts in filter and parse-date previews.
- **Multi-line ExpressionEditor** — Expression inputs in dialogs now support multi-line editing.
- **DeriveDialog empty-field validation** — Added validation for empty expression fields in the Derive dialog.
- **Dialog column pre-population** — Dialogs auto-populate the selected column when opened from column context.
- **Modal input styling fix** — Fixed inputs appearing white in modal dialogs.
- **Sample datasets** — Added bundled sample datasets (airports, Anscombe's quartet, barley, cars, iris, S&P 500, stocks, superstore, unemployment, weather) for local analysis.
- **Focus utility refactor** — Extracted `isInInteractiveContext` to shared `focus-utils.ts`.
- **Removed GitHub deploy workflow** — Cleaned up unused `.github/workflows/deploy.yml`.

### v0.1.0

- **V2 Workflow Cutover** — v1 format deleted, v2 is sole format. Browser import via drag-and-drop detection + `WorkflowImportDialog` + `WorkflowImportService`. Topological sort (`getReachableModels` / `topologicalSortV2`) extracted to shared `workflow-v2.ts`. CLI rejects non-v2 with clear error.
- **CLI & Workflow v2** — Headless workflow execution via `syto run/validate/schema` commands. Portable v2 workflow format with named references, multi-source/model DAGs, parsing hints. Browser export via `ExportService.exportWorkflowV2()`. v1 removed entirely (no users).
- **Model chaining & name uniqueness** — `sourceId` can reference another model (pipeline chaining). Source names globally unique, model names unique per-source, enforced via `NameService`. Auto-dedup on import. `DependencyService.getRootSourceId()` / `getUpstreamDependencies()`. `MULTI_MODEL_REFERENCE_PATHS` extracted to shared constant.
- **Test mock deduplication** — Added `MockFactories` to `test-utils.ts` with shared factories for `StepService`, `notification-handlers`, `preview-engine`, and `validation-engine`. Updated 11 handler test files to use centralized factories via async `vi.mock` with dynamic import, so interface changes require updating one file instead of 11+.
- **i18n hardcoded import messages** — Extracted hardcoded English strings (`'Excel file is empty'`, `'CSV file is empty'`) in `confirmImport()` to i18n keys with Ukrainian translations.
- **Reduced motion support** — Added `prefers-reduced-motion: reduce` media query to `styles/base.css` covering all animations and transitions.
- **TransformDialog.module.css decomposition** — Split the 846-line monolithic CSS file into 11 purpose-specific modules. Updated 47 consumer file imports.
- **Content guidelines audit** — Removed "Please" from ~40 validation messages. Updated `dialog-registry.ts` `buttonText` entries to task-specific verbs. Added action-specific confirm labels to all confirmation dialogs. Replaced remaining hardcoded English strings with i18n calls.
- **Code reduction refactors** — Three completed refactors (~543 LoC net reduction): declarative `SHORTCUT_REGISTRY` replacing 25 handler functions, `inferSchemaFromSample()` deduplicating 5 schema blocks, AppController pass-through elimination (712 → 430 LoC).
- **Transform linter deduplication** — Extracted `validateStepExpressions()` generator from `transform-linter.ts` to share expression validation logic. Net reduction: 101 LoC (377 → 276).
- **Duplicate Column quick action** — One-click "Duplicate" button in the column toolbar that creates a copy of the selected column via a `derive` step. No dialog needed.
- **Summary Statistics (Describe) transform** — One-click `describe` transform that auto-generates summary statistics for selected columns. Analogous to Pandas `df.describe()`.
- **ImportCsvDialog XSS fix & i18n completion** — Replaced `dangerouslySetInnerHTML` with JSX interpolation for `replacingSource` translation (eliminated self-XSS via source names containing HTML).
- **Validate workflows on load** — Added `validateSteps()` to `transform-linter.ts` for validating step objects loaded from IndexedDB. `loadInitialData()` now validates all model steps on startup and shows a persistent warning toast for any issues found.
- **ImportCsvDialog i18n** — Extracted ~25 hardcoded English strings from `ImportCsvDialog.tsx` to the `dialogs` namespace with Ukrainian translations.
- **Consolidate syto-app.ts into AppOrchestrator** — Eliminated the `SytoApp` class and `syto-app.ts`. `AppOrchestrator.initApp()` is now the single initialization entry point.
- **i18n hardcoded string elimination** — Replaced ~120+ remaining hardcoded English strings across ~30 handler/service files with `i18n.t()` calls. Added `npm run i18n:check` CI script.
- **Multi-select enhancements** — Extract selected rows to new model. Shift+Arrow column range selection in DataTable headers.
- **Command Undo/Redo** — Session-based undo/redo for pipeline operations (add, remove, edit step). Per-model history stacks (up to 50 entries). Keyboard shortcuts `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`.

## February 2026

- **MPA architecture & content pages** — Migrated from SPA to multi-page architecture: landing page at `/`, SPA at `/app/`, static content pages at `/about/` and `/docs/*`. Content pages are zero-JS HTML generated from markdown.
- **Dynamic expression docs** — Context-aware inline documentation in Filter and Derive dialogs. As users type expressions, the `ExpressionDocs` component shows function signatures/descriptions for detected functions.
- **Transform handler simplification** — Registry-driven dispatch replaces the 32-case switch statement and 4-layer callback indirection chain.
- **Pre-flight JSON validation** — Advanced JSON Editor with real-time linting validates syntax, transform keys, and expression correctness before application.
- **Expression typo suggestions** — "Did you mean 'X'?" suggestions for misspelled column names and function names using Levenshtein distance matching.
- **Expression input syntax highlighting & autocomplete** — Replaced plain `<input>` elements in Filter, Derive, and Conditional dialogs with CodeMirror 6 ExpressionEditor component.
- **Keyboard accessibility** — Global `:focus-visible` outlines, focus trapping in dialogs, Enter-to-submit in slide panels, arrow key navigation in TypeMenu with ARIA roles.

## January 2026

- **App Layer Refactoring** — Major architectural refactoring of `src/app/` layer. Created orchestration modules, extracted shared engines, migrated handlers to store-based pattern, split oversized components.
- **Advanced JSON Editor with Linting** — Replaced the basic sidebar JSON view with a full-featured CodeMirror-based editor modal.
- **Keyboard shortcuts (partial)** — `Ctrl/Cmd+S` to save workflow, `Delete` to remove last step, arrow keys to navigate steps. Escape handling for dialogs/modals.
- **Replace Data & Restore Backup** — Updated the non-destructive pillar by allowing sources to be refreshed with new data while maintaining a one-level snapshot backup.
- **Spread/Unroll transforms** — Array column operations: spread converts array columns into multiple columns, unroll expands array values into separate rows.
- **Advanced joins (semijoin, antijoin, lookup)** — Three specialized join operations.
- **Sample transform** — Extract random sample of rows with optional seed for reproducible sampling.
- **Dialog registry centralization** — Created `dialog-registry.ts` to eliminate duplicated metadata. Reduced files to update per dialog from ~12 to ~6-9.
- **Unified Append dialog (Concat/Union)** — Replaced separate Concat/Union dialogs with a unified Append experience.

## January 2025

- **Multi-model dependency graph** (Phase 3) — Complete dependency tracking for all multi-model operations with UI indicators for stale models.
- **Impute transform** — Fill missing values with constants via `impute` transform with UI integration.
- **Split expression function** — `split(value, delimiter, index)` for extracting segments from delimited strings.
- **Case-insensitive comparison functions** — `equals_ci`, `contains_ci`, `starts_with_ci`, `ends_with_ci`.
- **Conditional transform** — Multi-condition column creation with sequential `when`/`then` evaluation and `else` clause.
- **Pattern-based column operations** — `selectPattern`, `removePattern`, `renamePattern` with prefix/contains/regex matching.
- **Data Generation** — Synthetic data generation with support for integer/date sequences, random numbers/dates/booleans, and random categories.
- **Expression functions** — Implemented whitelisted functions for string, math, date, type, and regex operations.
- **Word-form boolean operators** — `and`/`or`/`not` as beginner-friendly alternatives to `&&`/`||`/`!`.
