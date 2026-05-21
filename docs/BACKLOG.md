# Syto — Feature Backlog

Planned features and enhancements. See [CHANGELOG.md](CHANGELOG.md) for shipped work.

---

## Transform Gaps

> **See also**: [TRANSFORM-ARCHITECTURE-REVIEW.md](TRANSFORM-ARCHITECTURE-REVIEW.md) for comprehensive analysis of transform architecture, identified gaps, and prioritized improvements based on Power Query M limitations research.

### Flatten JSON Transform

**Effort**: Medium

A new `flatten` transform that expands JSON object keys into separate columns (analogous to `spread` for arrays). Discovers keys from sample data, creates derived columns with configurable prefix. Initially available via JSON editor only.

### Top N per Group

**Effort**: Small-Medium
**Origin**: [Weaverbird comparison](archive/WEAVERBIRD-COMPARISON.md) — WB's `top` step

A transform that returns the top (or bottom) N rows within each group, ordered by a value column. Example: "top 5 products by sales in each category."

**Why this matters**: One of the most common analytical questions. Currently requires two steps: a `window` transform to compute `rank()` partitioned by group, then a `filter` to keep only rank ≤ N. Combining these into one operation is a significant UX improvement for a very frequent task.

**Implementation**: Arquero `groupby()` → `derive(rank)` → filter → ungroup → drop rank column. All primitives already exist.

### Fill Date Gaps

**Effort**: Medium
**Origin**: [Weaverbird comparison](archive/WEAVERBIRD-COMPARISON.md) — WB's `addmissingdates` step

An `addMissingDates` transform that fills gaps in time series data. Given a date column and a granularity (day/week/month), generates missing rows with null values for metric columns.

**Why this matters**: Time series with gaps produce misleading charts (lines jump over missing periods) and break calculations like moving averages. Every analyst working with dates encounters this. There is no reasonable workaround in Syto today — it would require manually generating a date range externally and joining it in.

**Implementation**: Detect date range bounds from data, generate complete sequence at specified granularity, left-join original data onto the generated sequence. If grouping columns are specified (e.g., per-region time series), cross-join groups × dates first.

### Bulk File Import with Optional Union

**Effort**: Small-Medium
**Origin**: Tidy data analysis — "one type in multiple tables" pattern (Wickham, 2014)

Import multiple files at once via multi-select file picker (`<input multiple>`) or multi-file drag-drop. Each file becomes a separate source (using existing import logic in a loop). After import, offer a one-click "Combine into one?" option that auto-generates a `union` or `concat` step across all imported sources.

**Optional enhancement**: Before combining, auto-derive a `source_file` column on each source so users can trace rows back to their origin file.

**Why this matters**: A common real-world pattern is data split across many files (one per year, per region, per export batch). Currently each file must be imported individually and manually concatenated. Bulk import removes the tedium for the 2–20 file case, which covers most analyst workflows.

**Technical notes**: No new dependencies. Browser APIs (`FileList`, `DataTransferItemList`) natively support multi-file selection. Schema mismatches across files are handled by existing `concat`/`union` column alignment logic.

---

## UI/UX Enhancements

### Empty State Components

**Effort**: Medium

Add designed empty states for scenarios currently showing blank space. See [UX-SPECIFICATION.md](UX-SPECIFICATION.md) §3.8 for the inventory: zero rows after filter, no steps in pipeline, empty EDA panel, no columns selected in dialog.

---

## Refactoring

### DialogCoordinator: Unify Import-CSV Preview

**Effort**: Small-Medium

Five preview getters (`hasPreviewData`, `getPreviewTitle`, `getPreviewStats`, `getPreviewColumns`, `getPreviewRows`) all special-case `import-csv` because it uses a different data shape. Either normalize import-csv to populate the standard `previewState`, or add a `getPreview()` method to `DialogConfig` so each dialog provides its own preview interface.

### Dialog-Handlers / DialogCoordinator Consolidation

**Effort**: Small-Medium

`dialog-handlers.ts` has a duplicate `hasUnsavedChanges()` and its own `closeDialog()` that parallel `DialogCoordinator`'s versions. Consolidate into a single layer.

---

## Testing Audit Follow-ups

Small items surfaced while writing tests during the testing overhaul. None are blocking; each is a one-sitting fix. Filed here so they don't get lost.

### Accessibility

- **`GenerateDialog` radios are `display: none`.** Visually replaced by icon labels but only reachable via `name` attribute — not via RTL roles or assistive tech.
- **Pattern-dialog `<select>` has no `aria-labelledby`.** Tests grab it via `screen.getByText('Match type:').nextElementSibling`, which is brittle. An `aria-labelledby` fix would tighten both the tests and the a11y story.

### Dialog drift

- **`ImputeDialog` preview ignores `currentData`.** Its "Strategy preview" panel runs against a hard-coded 8-row sample table with nulls regardless of real data. Misleading when the user is trying to preview against their own data.
- **`DescribeDialog` doesn't use `useTransformPreview`.** It owns a manual `createDebouncedPreview` handle that runs synchronously on a button click. Diverges from the rest of the dialog patterns; align with the preview-engine convention.
- **`ParseDateDialog` format/i18n drift.** `getCommonFormats()` returns 10 presets; `formatKeyMap` only re-labels 4, so 6 presets render with raw token labels. Conversely, i18n keys `parseDate.formats.iso` and `parseDate.formats.unix` are defined but never reached because `getCommonFormats()` doesn't emit `YYYY-MM-DD` or `timestamp` as preset values.
- **`WorkflowImportDialog` mixes parsing + presentation.** PapaParse is invoked from inside the component, so testing the file-input change handler requires mocking PapaParse. Extracting a `parseWorkflowSourceFile()` helper would let the dialog be tested end-to-end without a CSV-parser mock.

### Small cleanups

- **Dead i18n key `errors.validation.invalid.regexPattern`.** `validation-engine.ts` uses `errors.validation.invalid.pattern`. The unused key still sits in `errors.json` but never fires.
- **Mixed CRLF/LF line endings throw on import.** PapaParse infers the row terminator from the first newline and treats the rest as a single row. The error message is unhelpful; either auto-normalise on import or surface a clearer "mixed line endings detected" message.
- **`createModelId()` collision under same-millisecond ID generation.** Two manual imports executed in the same `Date.now()` tick can collide; `resolveModelInput` then resolves to the wrong source. Negligible in practice (no two manual imports happen within 1 ms), but worth fixing if we ever do batch/programmatic source creation.
- **v2-workflow type validation at import time.** Workflow import does not validate column types against the type registry up front — invalid types (e.g. `'number'` when the registry only knows `'integer'`/`'float'`) only fail later at compute time with `Unknown target type: <type>`. A pre-compute validator on the workflow JSON would surface this with a clearer error.

---

## Non-Destructive Pillar Strengthening

Analysis complete — no remaining gaps. See [DECISIONS.md §4](archive/DECISIONS.md) for what was shipped and what was decided against.

---

## SEO Landing Pages

**Effort**: Small per page (content only — infrastructure is in place)
**Reference**: [MONETIZATION-STRATEGY.md](future/MONETIZATION-STRATEGY.md) — Organic Growth section

Create focused landing pages for common data transformation queries (e.g., "pivot CSV online", "remove duplicates", "merge two CSVs"). Each page solves one problem using existing Syto transforms, then funnels users to the full app.

**Infrastructure**: The site uses MPA architecture with a static content page generator (`scripts/build-content-pages.ts`). Adding a new landing page requires only a markdown file in `src/content/` and a page entry in `scripts/content-pages-config.ts`. See [SPECIFICATION.md §3.5](SPECIFICATION.md) for site structure details.

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

- **ReDoS protection — Phase 2 (RE2-WASM at execution time)** (Medium) — Phase 1 (`safe-regex2` in `ast-validator`) only screens _literal_ regex patterns at validation. Dynamic patterns (column-reference arguments to `regexp_match`/`regexp_extract`/`regexp_replace`) skip validation entirely and could still freeze a tab on adversarial cell content. RE2-WASM would give true linear-time execution for all patterns. Trade-offs: WASM bundle weight (~150–300 KB), and a worker model would also let us add a true execution timeout. Revisit if anyone reports a frozen tab from a dynamic pattern, or before opening the app to LLM-generated workflows at scale.
- **Custom Icon Library** (Medium-Large) — Migrate from Iconify CDN to custom hand-drawn SVGs. Value is brand consistency and offline support. Revisit when branding becomes a priority.
- **Performance Profiling & Web Workers** (Investigation + Medium) — Systematic benchmarking and Web Workers for heavy Arquero transforms. Current soft limit ~100K rows. Revisit when users report real performance issues.
- **Workflow Format Stability** (Documentation + validation) — Formalize the transform JSON format for cross-version and cross-backend compatibility. Revisit when there's a user base depending on saved workflows or a second execution backend.
- **Template Landing Page for i18n** (Small) — Replace ~15 positional string replacements in UK landing page with `{{placeholder}}` tokens. Worth doing before adding a 3rd language.
