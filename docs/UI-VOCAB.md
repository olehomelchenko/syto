# Syto UI Vocabulary & Design Language

> **Purpose**: A design reference for Syto's UI — naming what exists, identifying what's missing, and establishing shared vocabulary for UI work. This document serves two roles:
>
> 1. **Alignment tool**: So Claude interprets UI requests using Syto's actual terminology
> 2. **Aspirational reference**: Patterns worth adopting in a data wrangling app, even if Syto doesn't use them yet
>
> Items marked with **→** are recommended additions not yet in the codebase.

> **Related**: [UX-SPECIFICATION.md](UX-SPECIFICATION.md) (authoritative technical spec), [SOUL.md](../SOUL.md) (design philosophy), [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md) (writing conventions)

---

## 1. Input Controls

### What Syto Has

| Syto Term                  | Component / CSS                              | Description                                                                                                                                                                     |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text input**             | `<input type="text">` / `.input`             | Standard single-line text field. Used for names, search, output columns                                                                                                         |
| **Number input**           | `<input type="number">`                      | Native browser number field with built-in arrows. Used for row limits, sample sizes, index parameters                                                                           |
| **Expression editor**      | `ExpressionEditor.tsx` (CodeMirror)          | Multi-line code editor with syntax highlighting, autocomplete, and inline docs. Grows with content, scrolls at max height. Used in filter, derive, conditional, date operations |
| **Checkbox**               | `<input type="checkbox">` / `.checkboxLabel` | Native checkbox. Used sparingly (analytics opt-out)                                                                                                                             |
| **Custom radio buttons**   | `.radioCircle` + `.radioDot`                 | Clickable div-based radio pattern with visual dot. Used for theme/language in Settings, delimiter/header mode in import                                                         |
| **Chip selector (single)** | `ColumnSelector.tsx` chip grid               | Grid of clickable column chips with type icons. Clicking one selects it exclusively. Used for source column picking in sort, replace, regexp                                    |
| **Chip selector (multi)**  | `ColumnSelector.tsx` chip grid               | Same grid, but Cmd/Ctrl+click toggles multiple selections. Used for bulk operations (remove, unpivot, fold)                                                                     |
| **Column list**            | `ColumnSelector.tsx` list mode               | Rows with checkboxes, drag handles, and inline rename inputs. Used for detailed column management (edit columns, reorder, select)                                               |
| **Native `<select>`**      | `<select>` / `.input`                        | Standard dropdown. Used for column/function pickers inside some dialogs (sort, aggregate, pivot). Avoided in favor of radio or chips where possible                             |
| **Textarea**               | `<textarea>`                                 | Multi-line text. Used for comments in dataset/model info views                                                                                                                  |

### Recommended Additions

| Term                          | What It Is                                                                   | Why Syto Should Have It                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **→ Combobox**                | Text input + filtered dropdown — user can type to search or pick from a list | Column pickers with 50+ columns become unwieldy as chip grids. A combobox with type-ahead filtering would scale better for wide datasets. Could replace `<select>` in dialogs where column count is unpredictable |
| **→ Stepper**                 | Number input with explicit +/− buttons (not browser-native arrows)           | Native number input arrows are tiny and platform-inconsistent. A proper stepper with visible buttons improves discoverability, especially for settings like row limits and sample sizes                           |
| **→ Segmented control**       | Mutually exclusive options rendered as a connected button group              | More compact than radio buttons, visually distinct from tabs. Good for binary or ternary choices that appear frequently: join type, sort direction, match mode. Think macOS-style segmented controls              |
| **→ Toggle / Switch**         | Binary on/off with a visual sliding indicator                                | Clearer than a checkbox for settings that enable/disable a behavior (e.g., "include headers", "case-sensitive matching"). The affordance immediately communicates on/off state                                    |
| **→ Tag input / Token input** | Free-form multi-value field where values appear as removable pills           | Useful for "filter by multiple values" or "keep these specific values" operations where the set is user-defined rather than picked from existing columns                                                          |

---

## 2. Layout & Navigation

### What Syto Has

| Syto Term            | Description                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Header bar**       | 48px top strip with branding, ribbon tab switcher, and settings toggle                                                                                  |
| **Ribbon**           | Workflow-organized toolbar below the header. Three tabs (Rows, Columns, Table) with grouped action buttons                                              |
| **Ribbon popover**   | Dropdown panel triggered by ribbon buttons (Text ▾, Date ▾, Number ▾, Convert ▾). Contains quick-action chips and links to full dialogs                 |
| **Quick actions**    | One-click chips inside ribbon popovers that generate transform steps immediately without opening a dialog                                               |
| **Sidebar**          | Left panel (300px) showing source/model hierarchy as a tree view, plus import actions at top                                                            |
| **Main area**        | Flexible-width content region containing the data table, EDA panel, and info views                                                                      |
| **Pagination bar**   | Bar below the data table with row stats, model info button, page controls, and export actions                                                           |
| **EDA panel**        | Collapsible panel showing column statistics, histograms, and boxplots for the selected data                                                             |
| **Preview panel**    | Temporary panel that appears during dialog editing, showing the result of the current transform configuration                                           |
| **Floating toolbar** | Context-sensitive action bar that appears near a selected element (column header, cell, or row gutter). Positioned absolutely relative to the selection |
| **Popover**          | Small floating overlay anchored to a trigger. Used for ribbon dropdowns                                                                                 |
| **Tooltip**          | Non-interactive hover hint. Used for disabled button explanations and control labels                                                                    |

### Recommended Additions

| Term                                   | What It Is                                                                      | Why Syto Should Have It                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **→ Command palette**                  | Searchable action launcher (Cmd+K) listing all available transforms and actions | Power users in data tools want keyboard-driven workflows. Instead of navigating ribbon tabs, a palette lets users type "filter" or "join" and jump straight to the dialog. Especially valuable as the transform count grows                      |
| **→ Disclosure / Collapsible section** | A section that expands/collapses with a toggle arrow                            | Useful for progressive complexity in dialog bodies — show basic options first, hide advanced settings (regex flags, null handling, edge cases) behind a "More options" disclosure. Prevents overwhelming beginners while keeping power available |
| **→ Breadcrumb**                       | Navigational chain showing current context path                                 | Could clarify location within nested structures: Source → Model → Step 3 (Filter). Helpful as Syto's navigation grows more hierarchical                                                                                                          |

---

## 3. Dialog System

Syto uses dialogs extensively. There are two distinct geometries and two behavior categories.

### Dialog Geometries

| Type               | Syto Component      | Behavior                                                                                                                                         |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Slide panel**    | `SlidePanel.tsx`    | Opens from the right edge, ~1/3 screen width. Used for all transform editors and import dialogs. Supports a preview panel in the remaining space |
| **Centered modal** | `CenteredModal.tsx` | Floats centered with backdrop overlay. Used for settings, downloads, info, function reference                                                    |

Both share `DialogShell.tsx` for consistent header (title + close), footer (action buttons), focus trapping, and backdrop.

### Dialog Behavior Categories

| Category            | Change Application                                                         | Examples                              |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| **Immediate-apply** | Changes take effect as the user interacts. Dismiss = changes already saved | Settings (theme, language, row limit) |
| **Deferred-apply**  | Changes are buffered. User must explicitly Apply/OK. Dismiss = discard     | All transform dialogs, import dialogs |

This distinction matters for change detection — deferred dialogs snapshot state on open and compare on close to warn about unsaved changes.

### Dialog Anatomy

| Part                   | Syto Convention                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Trigger**            | Ribbon button, toolbar button, sidebar action, or keyboard shortcut                                        |
| **Backdrop / Overlay** | Semi-transparent dimmed background. Click-to-dismiss on centered modals                                    |
| **Header**             | Dialog title + close button (×). Replace mode shows a contextual banner                                    |
| **Body**               | Transform-specific controls. May include column selectors, expression editors, radio groups, preview areas |
| **Footer**             | **Cancel** (dismiss without saving) + **Apply** or **OK** (commit). Some dialogs add secondary actions     |

### Dialog Behavior Terms

| Term                | Meaning                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Dismiss**         | Close without committing (Escape, backdrop click, Cancel). In immediate-apply dialogs, changes are already saved |
| **Commit**          | Close while saving — Syto convention is **Apply** or **OK** button                                               |
| **Modal**           | Blocks interaction with the rest of the app; has an overlay. All Syto dialogs are modal                          |
| **Focus trap**      | Tab/Shift+Tab cycles only within the dialog. Implemented via `useFocusTrap` hook                                 |
| **Enter-to-submit** | Pressing Enter in a slide panel commits the dialog (skipped when focus is in textarea, select, or CodeMirror)    |

### Preview Behavior

| Mode                         | When Used                                            | Behavior                                                         |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **Auto-preview (debounced)** | filter, derive, regexp, date, select-columns, impute | Preview updates automatically as user types, with debounce delay |
| **Button-triggered preview** | aggregate, join, pivot                               | User clicks "Preview" explicitly. Used for expensive operations  |

### Recommended Dialog Improvements

| Pattern                 | Description                                                                                               | Where It Helps                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **→ Inline validation** | Real-time feedback on individual fields (red border + message below the input) before the user hits Apply | Expression editors already show parse errors, but column selectors and other inputs fail silently until Apply. Early feedback reduces round-trips. See UX-SPECIFICATION.md §3.7 for validation timing rules |
| **→ Sticky footer**     | Dialog footer stays visible when body content scrolls                                                     | Complex dialogs (aggregate with many columns, join with many key pairs) can push the Apply button offscreen                                                                                                 |
| **→ Field composition** | Structured pattern: label + input + help text + error message as a single unit                            | Documented in UX-SPECIFICATION.md §3.7. Uses existing `.label`, `.input`, `.helpText`, `.error` classes from `form-controls.module.css`                                                                     |

---

## 4. Table Interactions

These are unique to Syto and form the core of the direct-manipulation experience.

| Pattern                    | Description                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Column header**          | Clickable/keyboard-navigable header cell. Contains type badge (left), column name (center), chevron dropdown trigger (right), and an optional quality bar (bottom edge). Click selects the column for EDA. Shift+click extends range selection                                                                                                                                 |
| **Quality bar**            | 3px horizontal strip at the bottom of a column header. Shows error % (red, from right) and missing % (amber, from right). Hidden when the column is 100% valid. Derived from a computed signal over all columns — recomputes on any data change                                                                                                                                |
| **Type badge**             | Inline icon indicator showing the column's inferred type: Abc (string), # (number), calendar (date/datetime). Clickable to open the type menu                                                                                                                                                                                                                                  |
| **Type menu**              | Keyboard-navigable menu for changing a column's type. Opens anchored to the type badge                                                                                                                                                                                                                                                                                         |
| **Column menu**            | Dropdown `role="menu"` triggered by the chevron on a column header. Items are **type-conditional** — each entry specifies `showFor`/`hideFor` column types (e.g., Split only for strings, Spread only for JSON, Date only for date/datetime). Always-visible items: Filter, Rename, Duplicate, Convert Type, Remove. See `DEVELOPMENT-PATTERNS.md` §1.2.2 for how to add items |
| **Multi-column toolbar**   | Floating `role="toolbar"` shown when multiple columns are selected. Shows count and bulk actions (Remove)                                                                                                                                                                                                                                                                      |
| **Cell toolbar**           | Floating toolbar on cell click. Quick filter actions: "Keep only this value" / "Exclude this value"                                                                                                                                                                                                                                                                            |
| **Row gutter**             | Sticky left column with 1-based row numbers. Click selects rows; Shift/Cmd for range/toggle                                                                                                                                                                                                                                                                                    |
| **Row toolbar**            | Floating toolbar on row selection. Actions: Keep, Remove, Extract to Model                                                                                                                                                                                                                                                                                                     |
| **Click-outside clearing** | Global listener clears all selection when clicking outside protected surfaces. Protected surfaces call `stopPropagation` on their root element                                                                                                                                                                                                                                 |

### Recommended Table Improvements

| Pattern                     | Description                                                           | Rationale                                                                                                    |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **→ Column resize handles** | Draggable dividers between column headers                             | Currently all columns share equal width. Wide text columns get truncated while narrow ID columns waste space |
| **→ Frozen columns**        | Pin columns so they stay visible during horizontal scroll             | When working with wide datasets, users lose context on key identifier columns as they scroll right           |
| **→ Sort indicator**        | Persistent arrow icon in column headers showing active sort direction | After applying a sort step, there's no visual feedback in the table header showing which column is sorted    |

---

## 5. Feedback & Status

### What Syto Has

| Pattern                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toast notification**    | Non-blocking popup in top-right corner. Success (3s auto-dismiss), Warning (6s), Error (persistent until dismissed). Implemented via `ToastContainer.tsx`                                                                                                                                                                                                                                                                                                        |
| **Error message box**     | Red-bordered inline box (`.error`) shown inside dialog bodies for validation/execution errors                                                                                                                                                                                                                                                                                                                                                                    |
| **Warning box**           | Yellow-bordered inline box (`.warningBox`) for caution states                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Note box**              | Gray-bordered inline box (`.noteBox`) for neutral informational messages                                                                                                                                                                                                                                                                                                                                                                                         |
| **Analysis badge**        | Small inline annotation (e.g. `.warningBadge` with ⚠️) placed next to the input that produced it, not in a separate banner. Used for live data-derived warnings ("⚠️ N nulls", "⚠️ Duplicates") attached to a specific control. Canonical pattern: `JoinKeyPairEditor.tsx` — analysis is computed from the candidate columns and rendered inline next to each side of the key pair. Prefer this over a dialog-level banner when the warning is tied to one input |
| **Schema diff panel**     | Structured comparison panel shown during data replacement. Categorizes changes: missing columns (danger), new columns, type changes                                                                                                                                                                                                                                                                                                                              |
| **Disabled with tooltip** | Ribbon buttons and quick actions disable when preconditions aren't met, with explanatory tooltip on hover                                                                                                                                                                                                                                                                                                                                                        |

### Recommended Additions

| Pattern                              | What It Is                                                                           | Where It Helps                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **→ Empty state**                    | A designed placeholder with illustration, explanatory text, and a primary action CTA | Taxonomy and inventory documented in UX-SPECIFICATION.md §3.8. Text conventions in CONTENT-GUIDELINES.md §8. Key opportunities: empty model, empty table after filter, empty EDA panel, no columns selected |
| **→ Skeleton / Loading placeholder** | Animated placeholder mirroring the shape of expected content while data loads        | Transforms that take time (join, aggregate on large data) show no feedback between click and result. A skeleton in the preview panel communicates progress                                                  |
| **→ Progress indicator**             | Determinate (progress bar) or indeterminate (spinner) for long operations            | Large file imports, complex multi-step pipeline recomputation. Currently the UI freezes during heavy computation with no visual feedback                                                                    |
| **→ Inline success feedback**        | Momentary green flash or checkmark on a control after a successful action            | Subtle confirmation that an immediate-apply setting was saved, or that a step was successfully added. Toasts work but are spatially disconnected from the action                                            |
| **→ Banner / Callout**               | Persistent inline alert within a page section, not auto-dismissing                   | Useful for ongoing conditions: "This model has errors in 3 steps" or "Source data has been replaced since this model was last run." More persistent than toasts, less intrusive than error boxes            |

---

## 6. Spatial & Positioning Vocabulary

Terms useful when describing layout changes in Syto.

### Structural

| Term                   | Meaning                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Chrome**             | The persistent UI shell surrounding the workspace — header, ribbon, sidebar, pagination bar     |
| **Canvas / Workspace** | The main content area where the data table lives                                                |
| **Panel**              | A distinct rectangular region (sidebar, EDA panel, preview panel)                               |
| **Pane**               | One section of a split layout (e.g., "dialog pane" + "preview pane" when a slide panel is open) |
| **Gutter**             | The space between panels, or the row-number column in the data table                            |

### Positioning

| Term         | Meaning                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Anchored** | Positioned relative to a trigger element — popovers, floating toolbars, type menus            |
| **Pinned**   | Stays fixed while surrounding content scrolls — row gutter, column headers (if sticky)        |
| **Sticky**   | Scrolls with content until hitting a boundary, then pins — pagination bar                     |
| **Flush**    | Element touches container edge with no gap — ribbon extends full width, sidebar has no margin |
| **Inset**    | Content padded inward from container edge — dialog body content, table cells                  |

---

## 7. Design System Concepts

| Term                       | Meaning in Syto                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design tokens**          | Named CSS custom properties for colors, spacing, shadows, radii. Defined in `variables.css`. Always use tokens over raw values                                                              |
| **Functional tokens**      | Logic-level tokens (`--color-primary`, `--color-text`, `--shadow-md`) that map to different palette values per theme                                                                        |
| **Component variant**      | Visual variations controlled by class modifiers: `--primary`, `--ghost`, `--danger`, `--small` on buttons                                                                                   |
| **Density**                | How compact elements are. Syto's dialogs use a compact density; the ribbon uses a comfortable density. When adding new UI, match the density of adjacent elements                           |
| **Affordance**             | Visual cue communicating interactivity. Chip selectors use hover states and cursor:pointer. The expression editor uses a code-like monospace appearance to signal "type here"               |
| **Progressive disclosure** | Showing simple options first, advanced settings on demand. Syto uses this in ribbon popovers (quick actions visible, full dialog one click away) but could use it more inside dialog bodies |
| **Escape hatch**           | A way to bypass structured UI for direct control. The JSON editor toggle is Syto's primary escape hatch — edit the raw pipeline spec when the visual builder isn't enough                   |

---

## 8. How to Prompt Claude for UI Work

When asking Claude to build or modify UI in Syto, specify:

1. **Component type** — use terms from this document (e.g., "chip selector" not "tag buttons", "slide panel" not "drawer")
2. **Dialog geometry** — slide panel or centered modal?
3. **Dialog behavior** — immediate-apply or deferred-apply?
4. **Controls in the body** — list specific input types: chip selector, expression editor, radio group, etc.
5. **Conditional visibility** — what shows/hides/enables based on other field values?
6. **Preview mode** — auto-updating (debounced) or button-triggered?
7. **Consistency reference** — "match the density of the Filter dialog" or "same chip selector pattern as Sort"

### Example: Vague vs. Precise Prompt

**Vague:**

> Add a settings dialog for the filter step.

**Precise:**

> Add a slide panel dialog for configuring the Filter step. The body contains: a single-select chip selector for the target column, a radio button group for the operator (Equals / Contains / Starts with / Is null), and a text input for the comparison value that hides when "Is null" is selected. Auto-updating preview with debounce. Footer has Cancel and Apply buttons. Match the density and control sizing of the existing Sort dialog.

---

## 9. Clarifying Questions Claude Should Ask

When a UI request is ambiguous, ask about:

| Topic                  | Example Question                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dialog geometry**    | "Should this be a slide panel (like transform editors) or a centered modal (like settings)?"                                                      |
| **Apply behavior**     | "Should changes apply immediately, or should the user click Apply to commit?"                                                                     |
| **Preview**            | "Should this dialog show a live preview? Auto-updating or button-triggered?"                                                                      |
| **Column selection**   | "How should users pick columns — chip grid (good for <20 columns), combobox (good for >20), or list with checkboxes (when order/rename matters)?" |
| **Conditional fields** | "Are any fields shown/hidden based on other field values?"                                                                                        |
| **Density**            | "Should this match the compact density of existing dialogs, or have more breathing room?"                                                         |
| **Consistency**        | "Is there an existing dialog this should match in layout and control choices?"                                                                    |
| **Scale**              | "How many items might appear in this list? Over ~50 items warrants a virtual list or combobox with filtering."                                    |

---

## 10. Recommended Improvements Summary

Patterns marked **→** above, collected for quick reference during a UI overhaul.

**Controls**: Combobox (type-ahead column picker), Stepper (visible +/−), Segmented control (compact option groups), Toggle switch (on/off settings), Tag input (multi-value free-form)

**Layout**: Command palette (Cmd+K), Disclosure sections (progressive complexity in dialogs), Breadcrumbs (navigation context)

**Dialogs**: Inline field validation, Sticky footer for scrollable bodies, Field composition pattern (label + input + help + error)

**Table**: Column resize handles, Frozen/pinned columns, Sort direction indicators in headers

**Feedback**: Designed empty states, Loading skeletons, Progress indicators, Inline success feedback, Persistent banners/callouts
