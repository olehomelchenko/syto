# Syto — Feature Backlog

Planned work, organized by tier so future sessions can pick up the next item without re-prioritizing. Higher tiers come first.

- **Tier 1** — Refactoring that reduces code and bug surface.
- **Tier 2** — Documented bugs and a11y gaps.
- **Tier 3** — New features.

Below the tiers: future ideas (revisit when conditions change), out-of-scope items, and pointers to closed-out work. See [CHANGELOG.md](CHANGELOG.md) for shipped work.

---

## Tier 1 — Refactoring (reduce code, reduce bug surface)

Ordered by safety-then-payoff: pure dedup first, then architectural unification, then mechanical convergence on shared patterns.

### Dialog-Handlers / DialogCoordinator Consolidation

**Effort**: Small-Medium

`dialog-handlers.ts` has a duplicate `hasUnsavedChanges()` and its own `closeDialog()` that parallel `DialogCoordinator`'s versions. Consolidate into a single layer — the orchestration layer is the natural home. Decide whether `dialog-handlers.ts` keeps a re-export shim or drops its versions entirely and all callers migrate to `DialogCoordinator`.

### DialogCoordinator: Unify Import-CSV Preview

**Effort**: Small-Medium

Five preview getters (`hasPreviewData`, `getPreviewTitle`, `getPreviewStats`, `getPreviewColumns`, `getPreviewRows`) all special-case `import-csv` because it uses a different data shape. Two viable directions:

1. Normalize import-csv to populate the standard `previewState`.
2. Add a `getPreview()` method to `DialogConfig` so each dialog provides its own preview interface.

Pays off every time someone adds a dialog. The choice is a design call.

### Extract `Papa.parse(file, …)` from `import-handlers.ts`

**Effort**: Small

Three `Papa.parse(file, …)` sites in `src/app/handlers/import/import-handlers.ts` mix parsing with state handling. Follow the same extraction pattern used in `WorkflowImportService.parseSourceFile` so call sites become testable without mocking PapaParse.

---

## Tier 2 — Documented bugs and a11y gaps

Ordered by user-visibility, then by ease of fix.

### Leading zeros are destroyed on import, silently

Type inference reads a column of digit strings as `integer`, so an identifier that is not a number loses its leading zeros with no warning. Measured against `public/datasets/superstore.csv` on 2026-09-21 by driving the real import: **449 of 10,194 rows** come out damaged — `05401` → `5401` (Burlington, Vermont), `07036` → `7036` (Linden, New Jersey), `02151` → `2151` (Revere, Massachusetts). The column is named `Postal Code`.

This is the worst class of defect this tool can have: the data is wrong, the user is not told, and nothing downstream can recover the original. It reaches the CLI too, since inference is `src/core/schema-engine.ts` and both engines call it.

Three directions, and the choice is a design call:

1. **Never widen a leading-zero string to a number.** Cheap, no UI, catches the whole class. **It is not free**, and the site says why: the branch at `src/core/schema-engine.ts:170` exists so that splitting `"2024-01-15"` gives an integer month from `"01"`. A blanket rule re-types that as string. Whoever takes this decides where the line sits — a length threshold, a uniform-width test, or a flag the split transform passes that a CSV import does not.
2. **Keep it, but warn.** Infer as today and raise a notification naming the column and the affected row count, with a one-click "keep as text".
3. **Make it reviewable.** The Import CSV dialog already shows a preview and already knows the inferred types; let the user override a column's type there before the import lands.

Option 1 is the floor and should ship whatever else does. `SOUL.md` promises the user can see exactly what happened to their data, and a silent narrowing breaks that promise.

### Import Preview counts the preview, not the file

The Import CSV dialog's preview header reads `99 rows, 21 columns (first 99 rows shown)` for `superstore.csv`, which has 10,194 rows. The parenthetical is accurate and the leading number is not: `99 rows` is the size of the slice being shown, presented where a reader looks for the size of the file they are importing. Seen 2026-09-21 driving the real import. The import itself is correct — the success notification says 10,194.

Fix: say what the file holds, then what is shown — `10,194 rows, 21 columns (first 99 shown)`. If the row count is not known before the full parse, say so rather than printing the slice size as the total.

### `ImputeDialog` preview ignores `currentData`

Its "Strategy preview" panel runs against a hard-coded 8-row sample table with nulls regardless of real data. Users think they're previewing against their data; they aren't.

### `ParseDateDialog` format / i18n drift

`getCommonFormats()` returns 10 presets; `formatKeyMap` only re-labels 4, so 6 presets render with raw token labels (e.g. `YYYY-MM-DD HH:mm:ss`). Conversely, i18n keys `parseDate.formats.iso` and `parseDate.formats.unix` are defined but never reached because `getCommonFormats()` doesn't emit `YYYY-MM-DD` or `timestamp` as preset values.

### Mixed CRLF/LF line endings throw on import

PapaParse infers the row terminator from the first newline and treats the rest as a single row. The error message is unhelpful. Either auto-normalise on import or surface a clearer "mixed line endings detected" message.

### `createModelId()` collision under same-millisecond ID generation

Two manual imports executed in the same `Date.now()` tick can collide; `resolveModelInput` then resolves to the wrong source. Production impact is negligible (no two manual imports happen within 1 ms), but it's a real race and the test suite had to work around it. Worth fixing if we ever do batch/programmatic source creation.

### v2-workflow type validation at import time

Workflow import does not validate column types against the type registry up front — invalid types (e.g. `'number'` when the registry only knows `'integer'`/`'float'`) only fail later at compute time with `Unknown target type: <type>`. A pre-compute validator on the workflow JSON would surface this with a clearer error.

### a11y: `GenerateDialog` radios are `display: none`

Visually replaced by icon labels but only reachable via `name` attribute — not via RTL roles or assistive tech.

### a11y: Pattern-dialog `<select>` has no `aria-labelledby`

Tests grab it via `screen.getByText('Match type:').nextElementSibling`, which is brittle. An `aria-labelledby` fix would tighten both the tests and the a11y story.

### Dead i18n key `errors.validation.invalid.regexPattern`

`validation-engine.ts` uses `errors.validation.invalid.pattern`. The unused key still sits in `errors.json` but never fires.

### End-to-end verification: 34 of 38 transforms never driven

`/verify` can drive the real app headless as of 2026-09-21, and the first round found two user-facing bugs in a morning — both now above this line. The rest of the surface has never been exercised against a real dataset.

Coverage after round 1, measured 2026-09-21:

| Surface                                                   | Driven | Total |
| --------------------------------------------------------- | ------ | ----- |
| Transform kinds (`src/core/transforms/handlers/index.ts`) | 4      | 38    |
| Expression functions (`src/schemas/functions.json`)       | 0      | 73    |
| Dialogs (`src/app/components/*Dialog.tsx`)                | 4      | 43    |

Round 1 drove `types`, `filter`, `derive` and `aggregate`, each checked against numbers computed from `public/datasets/superstore.csv` independently of the app, plus a browser-versus-CLI comparison of one exported workflow. The recipe, the fixture's ground truth and every quirk that cost a failed run are in `.claude/skills/verify/SKILL.md`.

The remaining rounds, ranked by expected bug yield:

1. **The other 34 transforms** — `join`, `pivot`, `fold`, `spread`, `window`, `unroll`, `dedupe`, `impute`, `split`, `lookup` and the rest. Biggest surface, shared by both engines, and every result is checkable against the fixture.
2. **Round-trip and persistence** — reload, undo/redo, Steps-panel editing, export to CSV and re-import. Same data-loss family as the leading-zeros bug, which is where the damage that matters lives.
3. **The 73 expression functions** — Superstore exercises the date, math, text and regex families. Audit finding F11 already reports the Ukrainian function documentation as corrupted, so the generated docs are worth checking beside the functions.
4. **Multi-model dependencies** — staleness tracking and model chaining. Complex state, thin coverage.
5. **EDA and charts** — visual output, the weakest to assert automatically. Last, and partly by screenshot.

Each round rewrites the table above rather than appending to it.

---

## Tier 3 — New features

Ordered by analyst impact and how cleanly each unblocks a real workflow gap.

### Transform Gaps

> **See also**: [TRANSFORM-ARCHITECTURE-REVIEW.md](TRANSFORM-ARCHITECTURE-REVIEW.md) for the transform design principles and the Power Query M limitation comparison that shapes which gaps are worth filling.

#### Top N per Group

**Effort**: Small-Medium
**Origin**: [Weaverbird comparison](WEAVERBIRD-COMPARISON.md) — WB's `top` step

A transform that returns the top (or bottom) N rows within each group, ordered by a value column. Example: "top 5 products by sales in each category."

**Why this matters**: One of the most common analytical questions. Currently requires two steps: a `window` transform to compute `rank()` partitioned by group, then a `filter` to keep only rank ≤ N. Combining these into one operation is a significant UX improvement for a very frequent task.

**Implementation**: Arquero `groupby()` → `derive(rank)` → filter → ungroup → drop rank column. All primitives already exist.

#### Fill Date Gaps

**Effort**: Medium
**Origin**: [Weaverbird comparison](WEAVERBIRD-COMPARISON.md) — WB's `addmissingdates` step

An `addMissingDates` transform that fills gaps in time series data. Given a date column and a granularity (day/week/month), generates missing rows with null values for metric columns.

**Why this matters**: Time series with gaps produce misleading charts (lines jump over missing periods) and break calculations like moving averages. Every analyst working with dates encounters this. There is no reasonable workaround in Syto today — it would require manually generating a date range externally and joining it in.

**Implementation**: Detect date range bounds from data, generate complete sequence at specified granularity, left-join original data onto the generated sequence. If grouping columns are specified (e.g., per-region time series), cross-join groups × dates first.

#### Bulk File Import with Optional Union

**Effort**: Small-Medium
**Origin**: Tidy data analysis — "one type in multiple tables" pattern (Wickham, 2014)

Import multiple files at once via multi-select file picker (`<input multiple>`) or multi-file drag-drop. Each file becomes a separate source (using existing import logic in a loop). After import, offer a one-click "Combine into one?" option that auto-generates a `union` or `concat` step across all imported sources.

**Optional enhancement**: Before combining, auto-derive a `source_file` column on each source so users can trace rows back to their origin file.

**Why this matters**: A common real-world pattern is data split across many files (one per year, per region, per export batch). Currently each file must be imported individually and manually concatenated. Bulk import removes the tedium for the 2–20 file case, which covers most analyst workflows.

**Technical notes**: No new dependencies. Browser APIs (`FileList`, `DataTransferItemList`) natively support multi-file selection. Schema mismatches across files are handled by existing `concat`/`union` column alignment logic.

#### Flatten JSON Transform

**Effort**: Medium

A new `flatten` transform that expands JSON object keys into separate columns (analogous to `spread` for arrays). Discovers keys from sample data, creates derived columns with configurable prefix. Initially available via JSON editor only.

### UI/UX

#### Empty State Components

**Effort**: Medium

Add designed empty states for scenarios currently showing blank space. See [UX-SPECIFICATION.md](UX-SPECIFICATION.md) §3.8 for the inventory: zero rows after filter, no steps in pipeline, empty EDA panel, no columns selected in dialog.

### Marketing / SEO

#### SEO Landing Pages

**Effort**: Small per page (content only — infrastructure is in place)
**Reference**: [MONETIZATION-STRATEGY.md](future/MONETIZATION-STRATEGY.md) — Organic Growth section

Create focused landing pages for common data transformation queries (e.g., "pivot CSV online", "remove duplicates", "merge two CSVs"). Each page solves one problem using existing Syto transforms, then funnels users to the full app.

**Infrastructure**: The site uses MPA architecture with a static content page generator (`scripts/build-content-pages.ts`). Adding a new landing page requires only a markdown file in `src/content/` and a page entry in `scripts/content-pages-config.ts`. See [SPECIFICATION.md §3.5](SPECIFICATION.md) for site structure details.

**Priority candidates:** pivot/unpivot, deduplicate, split column, filter rows, join/merge CSVs, JSON-to-CSV, rename columns, aggregate/group-by.

**i18n considerations for landing pages:**

Landing pages are zero-JS static HTML — the app's runtime i18next system cannot serve them. Multilingual landing pages require a **separate build-time i18n pipeline**:

- **URL structure**: Decide early on `/{locale}/...` path prefix (e.g., `/uk/pivot-csv-online/`). This shapes routing, Vite MPA config, and all internal links — hard to retrofit later.
- **Content approach**: Separate markdown files per locale — English at `src/content/`, Ukrainian at `src/content/uk/`. Long-form marketing copy doesn't fit i18next's key-value model.
- **Shared UI chrome**: Build script can read from existing `locales/*/common.json` for nav/footer/CTA button labels that appear on both landing pages and in the app, avoiding duplication.
- **`hreflang` tags**: Every page needs `<link rel="alternate" hreflang="..." href="...">` cross-references so Google serves the right locale.
- **`<html lang="...">`**: Set per-page at build time, not toggled by JS.
- **Sitemap**: Multilingual sitemaps need `xhtml:link` alternates per URL — generate from the build script.
- **No automatic locale redirects**: Google prefers serving a default language and letting `hreflang` handle discovery. Avoid `Accept-Language` redirects on landing pages.
- **Maintenance cost**: Each landing page must be written/maintained in all supported languages. Manageable for 2 locales; scales poorly beyond ~3 without a translation workflow.

#### Example workflows

Onboarding & website video. See [EXAMPLE-WORKFLOWS.md](future/EXAMPLE-WORKFLOWS.md).

---

## Future Ideas (revisit if the app gains traction)

Not currently prioritized. Listed so the rationale survives when these come back up.

- **ReDoS protection — Phase 2 (RE2-WASM at execution time)** (Medium) — Phase 1 (`safe-regex2` in `ast-validator`) only screens _literal_ regex patterns at validation. Dynamic patterns (column-reference arguments to `regexp_match`/`regexp_extract`/`regexp_replace`) skip validation entirely and could still freeze a tab on adversarial cell content. RE2-WASM would give true linear-time execution for all patterns. Trade-offs: WASM bundle weight (~150–300 KB), and a worker model would also let us add a true execution timeout. Revisit if anyone reports a frozen tab from a dynamic pattern, or before opening the app to LLM-generated workflows at scale.
- **Custom Icon Library** (Medium-Large) — Migrate from Iconify CDN to custom hand-drawn SVGs. Value is brand consistency and offline support. Revisit when branding becomes a priority.
- **Performance Profiling & Web Workers** (Investigation + Medium) — Systematic benchmarking and Web Workers for heavy Arquero transforms. Current soft limit ~100K rows. Revisit when users report real performance issues.
- **Workflow Format Stability** (Documentation + validation) — Formalize the transform JSON format for cross-version and cross-backend compatibility. Revisit when there's a user base depending on saved workflows or a second execution backend.
- **Template Landing Page for i18n** (Small) — Replace ~15 positional string replacements in UK landing page with `{{placeholder}}` tokens. Worth doing before adding a 3rd language.

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

## Closed-out areas

- **Non-Destructive Pillar Strengthening** — analysis complete, no remaining gaps. See [DECISIONS.md §4](DECISIONS.md) for what was shipped and what was decided against.
