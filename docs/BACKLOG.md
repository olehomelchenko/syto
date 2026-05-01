# Syto — Feature Backlog

This document tracks planned features and enhancements, organized by scope and effort.

The main block contains details about not implemented yet features or fixes; the block "Completed features" below keeps history once they are implemented and removed from the main block.

---

## Transform Gaps

> **See also**: [TRANSFORM-ARCHITECTURE-REVIEW.md](TRANSFORM-ARCHITECTURE-REVIEW.md) for comprehensive analysis of transform architecture, identified gaps, and prioritized improvements based on Power Query M limitations research.

### Flatten JSON Transform

**Status**: Planned
**Effort**: Medium

A new `flatten` transform that expands JSON object keys into separate columns (analogous to `spread` for arrays). Discovers keys from sample data, creates derived columns with configurable prefix. Initially available via JSON editor only.

### Top N per Group

**Status**: Planned
**Effort**: Small-Medium
**Origin**: [Weaverbird comparison](archive/WEAVERBIRD-COMPARISON.md) -- WB's `top` step

A transform that returns the top (or bottom) N rows within each group, ordered by a value column. Example: "top 5 products by sales in each category."

**Why this matters**: One of the most common analytical questions. Currently requires two steps: a `window` transform to compute `rank()` partitioned by group, then a `filter` to keep only rank <= N. Combining these into one operation is a significant UX improvement for a very frequent task.

**Implementation**: Arquero `groupby()` → `derive(rank)` → filter → ungroup → drop rank column. All primitives already exist.

### Fill Date Gaps

**Status**: Planned
**Effort**: Medium
**Origin**: [Weaverbird comparison](archive/WEAVERBIRD-COMPARISON.md) -- WB's `addmissingdates` step

An `addMissingDates` transform that fills gaps in time series data. Given a date column and a granularity (day/week/month), generates missing rows with null values for metric columns.

**Why this matters**: Time series with gaps produce misleading charts (lines jump over missing periods) and break calculations like moving averages. Every analyst working with dates encounters this. There is no reasonable workaround in Syto today -- it would require manually generating a date range externally and joining it in.

**Implementation**: Detect date range bounds from data, generate complete sequence at specified granularity, left-join original data onto the generated sequence. If grouping columns are specified (e.g., per-region time series), cross-join groups × dates first.

### Bulk File Import with Optional Union

**Status**: Planned
**Effort**: Small-Medium
**Origin**: Tidy data analysis — "one type in multiple tables" pattern (Wickham, 2014)

Import multiple files at once via multi-select file picker (`<input multiple>`) or multi-file drag-drop. Each file becomes a separate source (using existing import logic in a loop). After import, offer a one-click "Combine into one?" option that auto-generates a `union` or `concat` step across all imported sources.

**Optional enhancement**: Before combining, auto-derive a `source_file` column on each source so users can trace rows back to their origin file.

**Why this matters**: A common real-world pattern is data split across many files (one per year, per region, per export batch). Currently each file must be imported individually and manually concatenated. Bulk import removes the tedium for the 2–20 file case, which covers most analyst workflows.

**Technical notes**: No new dependencies. Browser APIs (`FileList`, `DataTransferItemList`) natively support multi-file selection. Schema mismatches across files are handled by existing `concat`/`union` column alignment logic.

---

## UI/UX Enhancements

### Empty State Components

**Status**: Planned
**Effort**: Medium

Add designed empty states for scenarios currently showing blank space. See [UX-SPECIFICATION.md](UX-SPECIFICATION.md) §3.8 for the inventory: zero rows after filter, no steps in pipeline, empty EDA panel, no columns selected in dialog.

### WorkflowImportDialog CSS Modules

**Status**: Planned
**Effort**: Small

`WorkflowImportDialog.tsx` uses inline `style={{...}}` instead of CSS Modules. Every other dialog uses CSS Modules. Extract styles to `WorkflowImportDialog.module.css`.

### WorkflowImportService Tests

**Status**: Planned
**Effort**: Small-Medium

No tests for `WorkflowImportService` (source creation, model building, pipeline computation, state updates) or `routeToWorkflowImport` in import-handlers. Core graph utilities are tested; the integration wiring is not.

### DownloadDialog i18n

**Status**: Planned
**Effort**: Small

Hardcoded English strings in `DownloadDialog.tsx`: "Select what you would like to download", "Workflow (JSON)", "Export transformation steps as a JSON workflow", and other button labels. Extract to `dialogs` i18n namespace with Ukrainian translations.

---

## Refactoring

### DialogCoordinator: Migrate initDialogState to Registry

**Status**: Planned
**Effort**: Medium

Move the ~250-line switch statement in `DialogCoordinator.initDialogState()` into per-dialog `initState` entries in `DIALOG_REGISTRY`. Each dialog becomes self-contained; the coordinator shrinks to ~10 lines of delegation. The `callbacks` pattern also becomes unnecessary since registry entries can import their handlers directly.

### DialogCoordinator: Unify Import-CSV Preview

**Status**: Planned
**Effort**: Small-Medium

Five preview getters (`hasPreviewData`, `getPreviewTitle`, `getPreviewStats`, `getPreviewColumns`, `getPreviewRows`) all special-case `import-csv` because it uses a different data shape. Either normalize import-csv to populate the standard `previewState`, or add a `getPreview()` method to `DialogConfig` so each dialog provides its own preview interface.

### Dialog-Handlers / DialogCoordinator Consolidation

**Status**: Planned
**Effort**: Small-Medium

`dialog-handlers.ts` has a duplicate `hasUnsavedChanges()` and its own `closeDialog()` that parallel `DialogCoordinator`'s versions. Consolidate into a single layer.

---

## Non-Destructive Pillar Strengthening

**Status**: Analysis Complete — No Remaining Gaps
**Reference**: [DECISIONS.md](archive/DECISIONS.md) §4

A comprehensive analysis of Syto's adherence to non-destructive principles was conducted in January 2026. The original analysis identified 4 gaps; all have been resolved:

- **Undo/Redo** — Implemented (March 2026)
- **JSON Danger Zone Validation** — Implemented (February 2026)
- **Shadow Sources** — Decided against. The current hard-block on deleting referenced models is simpler, more transparent, and sufficient.
- **Error Audit Trail** — Decided against. Error counts are already visible in EDA before aggregation. Adding a warnings sideband to the transform pipeline would require significant architectural changes for marginal benefit.

---

## SEO Landing Pages

**Status**: Infrastructure complete, content pending
**Effort**: Small per page (content only — infrastructure is in place)
**Reference**: [MONETIZATION-STRATEGY.md](future/MONETIZATION-STRATEGY.md) — Organic Growth section

Create focused landing pages for common data transformation queries (e.g., "pivot CSV online", "remove duplicates", "merge two CSVs"). Each page solves one problem using existing Syto transforms, then funnels users to the full app.

**Infrastructure** (February 2026): The site now uses MPA architecture with a static content page generator (`scripts/build-content-pages.ts`). Adding a new landing page requires only a markdown file in `src/content/` and a page entry in `scripts/content-pages-config.ts`. See [SPECIFICATION.md §3.5](SPECIFICATION.md) for site structure details.

**Priority candidates:** pivot/unpivot, deduplicate, split column, filter rows, join/merge CSVs, JSON-to-CSV, rename columns, aggregate/group-by.

**i18n considerations for landing pages:**

Landing pages are zero-JS static HTML — the app's runtime i18next system cannot serve them. Multilingual landing pages require a **separate build-time i18n pipeline**:

- **URL structure**: Decide early on `/{locale}/...` path prefix (e.g., `/uk/pivot-csv-online/`). This shapes routing, Vite MPA config, and all internal links — hard to retrofit later.
- **Content approach**: Separate markdown files per locale (`src/content/en/`, `src/content/uk/`). Long-form marketing copy doesn't fit i18next's key-value model.
- **Shared UI chrome**: Build script can read from existing `locales/*/common.json` for nav/footer/CTA button labels that appear on both landing pages and in the app, avoiding duplication.
- **`hreflang` tags**: Every page needs `<link rel="alternate" hreflang="..." href="...">` cross-references so Google serves the right locale.
- **`<html lang="...">`**: Set per-page at build time, not toggled by JS.
- **Sitemap**: Multilingual sitemaps need `xhtml:link` alternates per URL — generate from the build script.
- **No automatic locale redirects**: Google prefers serving a default language and letting `hreflang` handle discovery. Avoid `Accept-Language` redirects on landing pages.
- **Maintenance cost**: Each landing page must be written/maintained in all supported languages. Manageable for 2 locales; scales poorly beyond ~3 without a translation workflow.

---

## Not Planned (Out of Scope)

These have been considered and explicitly excluded:

- **Custom user-defined functions**: Adds complexity, security concerns
- **Cell-by-cell editing**: This is a transformation tool, not a spreadsheet
- **SQL query mode**: Expressions cover this; SQL adds learning curve
- **Plugin/extension system**: Premature; focus on core features first
- **Real-time collaboration**: Requires server infrastructure, conflicts with local-only principle
- **Native app** (Electron/DuckDB): Documented in [NATIVE-APP-SPEC.md](future/NATIVE-APP-SPEC.md) as potential future direction, not current roadmap

---

## Priority Summary

### Remaining Priorities

1. Example workflows for onboarding & website video ([EXAMPLE-WORKFLOWS.md](future/EXAMPLE-WORKFLOWS.md))
2. SEO landing pages (infrastructure done, content needed)
3. Top N per Group transform (small-medium effort, very common analytical need)
4. Bulk File Import with optional union (small-medium effort, common real-world pattern)
5. Flatten JSON transform
6. Fill Date Gaps transform (medium effort, important for time series)
7. Empty State Components (medium effort, UX polish)

### Future Ideas (not on active backlog)

Ideas worth revisiting if the app gains traction — not currently prioritized:

- **Custom Icon Library** (Medium-Large) — Migrate from Iconify CDN to custom hand-drawn SVGs. Value is brand consistency and offline support. Revisit when branding becomes a priority.
- **Performance Profiling & Web Workers** (Investigation + Medium) — Systematic benchmarking and Web Workers for heavy Arquero transforms. Current soft limit ~100K rows. Revisit when users report real performance issues.
- **Workflow Format Stability** (Documentation + validation) — Formalize the transform JSON format for cross-version and cross-backend compatibility. Revisit when there's a user base depending on saved workflows or a second execution backend.
- **Template Landing Page for i18n** (Small) — Replace ~15 positional string replacements in UK landing page with `{{placeholder}}` tokens. Worth doing before adding a 3rd language.

---

## Completed Features

See [CHANGELOG.md](CHANGELOG.md) for the full historical record of completed features and improvements.

---

**Last updated**: March 2026
