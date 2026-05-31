# Syto — UX Specification

> **Related Documentation**:
>
> - **[SPECIFICATION.md](SPECIFICATION.md)**: Technical architecture and codebase map
> - **[DATA-SPECIFICATION.md](DATA-SPECIFICATION.md)**: Data structures, transform format, and persistence
> - **[DEVELOPMENT-PATTERNS.md](DEVELOPMENT-PATTERNS.md)**: How to add transforms, testing, state management
> - **[CLAUDE.md](../CLAUDE.md)**: Development onboarding and quick reference
> - **[DEBUGGING.md](DEBUGGING.md)**: CSS Module debugging and component identification
> - **[CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md)**: UI text conventions, error messages, writing patterns

## 1. Design Foundation

### 1.1 Design Philosophy

| Aspect                 | Decision                                                 |
| ---------------------- | -------------------------------------------------------- |
| **Styling**            | Custom CSS with PostCSS nesting and CSS variables        |
| **Design Inspiration** | KSE Visual Identity (rigorous, clean, information-dense) |
| **Environment**        | Desktop-first, 13"+ screens, Chrome & Safari             |
| **Theme System**       | Dynamic themes (**Syto** and **Blues**) with Vega sync   |

### 1.2 Theme System

Syto supports high-fidelity theme switching, accessible via the **Settings** dialog. Themes control both the application UI and all embedded visualizations.

- **Syto (Classic)**: Heritage-focused Midnight Blue primaries with Cyan accents.
- **Blues (KSE)**: Rigorous Navy palette, optimized for academic and business environments.

**Integration**: Vega-Lite charts automatically inherit the active theme's color palette, axis styling, and typography for a seamless visual experience.

### 1.3 Brand & Visual Identity

See [style-guide.md](style-guide.md) for brand colors, data visualization palette, and typography definitions.

### 1.4 Design Principles

Principles guiding Syto's UX decisions, adapted from established design systems. See [DECISIONS.md](DECISIONS.md) §3 for the evaluation rationale.

| Principle                        | Meaning                                                                                                 | Example                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Match disruption to severity** | Low-priority feedback is non-blocking; high-priority interrupts the workflow                            | Success → auto-dismissing toast. Error → persistent toast. Destructive action → confirmation dialog                                                                                       |
| **Mark the minority**            | Label whichever state is less common — required or optional fields                                      | If most fields are required, mark only optional ones "(optional)". If most are optional, mark required with asterisk                                                                      |
| **Two channels for status**      | Never communicate status through color alone — always pair with icon, shape, or text                    | Error: red border + icon + message. Disabled: opacity + tooltip. Type: icon + label (Abc, #)                                                                                              |
| **Progressive disclosure**       | Show simple options first, advanced settings on demand                                                  | Quick actions in popovers for common operations; full dialog for complex configuration. Disclosure sections for advanced options in dialog bodies                                         |
| **Inline action threshold**      | When a surface has many actions, promote only the highest-frequency ones; collapse the rest into a menu | Column headers: chevron dropdown contains all actions in a labeled vertical menu. Multi-column toolbar: only count + remove inline. Destructive actions separated by a divider at the end |

---

## 2. Layout Structure

### 2.1 Main Grid System

The interface is structured using a rigid grid system:

```css
body {
  display: grid;
  grid-template-columns: 300px 1fr;
  grid-template-rows: 48px auto 1fr;
  grid-template-areas:
    'header  header'
    'ribbon  ribbon'
    'left    main';
}
```

- **Header (48px)**: Persistent branding, ribbon tabs, and settings toggle.
- **Ribbon (~56px)**: Workflow-organized transform actions.
- **Left Panel (300px)**: Data sources and transformation pipeline.
- **Main Area (Flexible)**: Data table preview and EDA panels.

---

## 3. Core Components

### 3.1 Workflow Ribbon

The ribbon provides all transform operations organized across three tabs. Each tab contains grouped buttons and dropdown popovers. Many popovers include **quick actions** (one-click chips that generate `derive` steps without opening a dialog) alongside links to full dialogs.

_Note: All Data I/O actions are in the Sidebar, not the ribbon._

#### Rows Tab

| Group             | Actions                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| **Filter & Sort** | Filter, Sort, Duplicates, Keep/Remove Rows (slice), Sample, Promote Header |

#### Columns Tab

| Group                | Actions                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Manage**           | Edit Columns (reorder/rename/select/remove), Split, Merge, More → (Spread, Unroll) |
| **New Columns**      | Derive, Conditional, Regexp Match, Regexp Extract, Add Index                       |
| **Transform Values** | Text ▾, Date ▾, Number ▾, Convert ▾, Replace, Impute                               |
| **Types**            | Auto Detect Schema                                                                 |

The **Transform Values** group uses dropdown popovers with type-aware quick actions:

- **Text ▾** (requires string column selected): Quick actions for Upper, Lower, Title Case, Trim, Length. Links to Split, Replace, Regexp Extract, and Text Operations dialogs.
- **Date ▾** (requires date/datetime column selected): Quick actions for extracting Year, Month, Day, Quarter, Weekday, Week. Quick actions for truncating to Year, Month, Week, Day. Links to Date Operations and Parse Date dialogs.
- **Number ▾** (requires numeric column selected): Quick actions for Round, Floor, Ceil, Truncate, Absolute Value, Sign. Link to Derive dialog.
- **Convert ▾** (requires column selected): Quick type conversions: To Text, To Number, To Integer, To Date.

Quick actions apply immediately to the selected column (generating a `derive` or `types` step) without opening a dialog. Buttons are disabled with explanatory tooltips when no column of the required type is selected.

The **Summarize** group includes a **Window ▾** dropdown popover with preset chips (Row Number, Rank, Previous Value, Running Total, Moving Average, Fill Down) that open the Window dialog pre-configured. Unlike Transform Values quick actions, these presets pre-fill dialog state for user review rather than applying instantly. A "Custom window..." link opens the blank dialog.

#### Table Tab

| Group         | Actions                                  |
| ------------- | ---------------------------------------- |
| **Summarize** | Group By (aggregate), Window ▾, Describe |
| **Reshape**   | Pivot, Unpivot (Fold)                    |
| **Combine**   | Join, Append (concat/union)              |

### 3.2 Sources & Models Sidebar

The sidebar provides central management for all data assets:

- **Import Actions**: "Add File", "Paste Data", and "Import URL" are small-icon actions at the top of the panel.
- **Hierarchy**: Tree-view structure showing CSV sources and their dependent models.
- **Model Stats**: Inline counts for steps and data shape (rows x columns).

### 3.3 Model View Toolbar

Located above the data preview table, this toolbar provides status and model-specific actions:

- **Model Info Button**: Opens the Model Info view showing model metadata, comment, and column schema. Positioned leftmost, before the Rename button.
- **Metadata**: Real-time summary of the data shape and pipeline length.
- **Download Modal**: A unified menu for exporting current data as CSV/JSON or the workflow spec.
- **Overlapping Icon Buttons**: Reworked copy buttons using a format icon base (CSV/JSON) with a copy overlay icon.
- **JSON Editor Toggle**: Rapid switching between the visual steps view and the raw JSON specification.

### 3.3.1 Dataset & Model Info Views

Both datasets (sources) and models have dedicated info views accessible via:

- **Dataset Info**: Clicking a source in the sidebar or navigating to `#/src_xxx/info`
- **Model Info**: Clicking the "Model Info" button in the pagination bar or navigating to `#/src_xxx/mdl_xxx/info`

These views display:

- **Actions**:
  - **Dataset Info**: Replace Data (initiates replace flow), Restore Backup (visible only if backup exists), Rename, Delete
  - **Model Info**: Rename, Delete
- **Comment Section**: Editable text area for user notes about the dataset or model
- **Column Schema Table**: Complete list of columns with types and positions

Comments are persisted to IndexedDB and automatically saved when edited.

### 3.4 Interactive Table Context

- **Column Headers**: Each header displays type badge (left), column name (center), and a chevron dropdown trigger (right). A **quality bar** — a 3px horizontal strip at the bottom edge — appears when the column has missing values (amber) or conversion errors (red), with segment widths proportional to their percentage of total rows. Hidden entirely for clean columns. Keyboard-navigable using roving tabindex — ArrowLeft/Right moves focus between headers (with wrapping), Home/End jump to first/last. Click selects the column (EDA panel, highlighting). Shift+ArrowLeft/Right extends column range selection (clamped at boundaries, no wrapping). Minimum column width matches the dropdown menu width for visual alignment.
- **Column Menu**: Clicking the chevron trigger (or pressing Enter/Space on a focused header) opens a dropdown menu (`role="menu"`) anchored below the column header. Menu items have icon + text label format, grouped by dividers: Sort Asc/Desc | Filter, Rename, Split, Duplicate | Date Operations (conditional on date/datetime type), Deduplicate, Impute | Remove (danger). ArrowUp/Down navigates items (with wrapping), Home/End jump to first/last. Escape closes the menu. Opening the menu also selects the column so EDA context matches.
- **Multi-Column Selection**: Cmd/Ctrl+Click toggles individual columns in a multi-selection; Shift+Click selects a range from the last anchor column. Multi-column floating toolbar shows count and bulk remove action.
- **Row Gutter**: A sticky left column displays 1-based row numbers. Clicking a gutter cell selects the row; Cmd/Ctrl+Click toggles rows; Shift+Click selects a contiguous range. Keyboard-navigable using roving tabindex — ArrowUp/Down moves focus between rows (with wrapping), Shift+ArrowUp/Down extends range selection (clamped at page boundaries).
- **Row Toolbar**: Floating toolbar (`role="toolbar"`) appears when rows are selected, offering Keep (filter to selected), Remove (delete selected), and Extract to Model (creates a new model with selected rows and current pipeline). Supports ArrowLeft/Right keyboard navigation.
- **Cell Toolbar**: Clicking a cell allows for rapid "Keep only this" or "Exclude this" filtering based on that specific value.
- **Type Badges**: Visual indicators for data types (Abc, #, 📅), synced with the granular schema engine.
- **Type Menu**: Keyboard-navigable (`role="menu"`) with arrow key support (Up/Down/Home/End) and auto-focus on open.

**Click-Outside & Selection Clearing**: A global click listener (`handleBodyClick` via `EventRouter`) clears column/row/cell selection when clicks land outside selection-relevant UI. Each surface that should **preserve** selection calls `e.stopPropagation()` on its root element — this is the primary protection mechanism. Protected surfaces: column headers, cells, row gutters (in App.tsx callbacks), floating toolbars, centered modals, RibbonToolbar, RibbonPopover content, and the EDA panel. Escape key also clears selection (priority: message box → dialog → type menu → selection). When adding a new UI surface that should preserve selection, add `onClick stopPropagation` to its root — do not add CSS class selectors to `handleBodyClick`.

### 3.5 Dialog System

**Slide Panel Dialogs**: Transform operations (filter, derive, sort, join, etc.) and import dialogs (CSV/URL) use slide panels that open from the right side, occupying approximately 1/3 of the screen width. These panels support a preview pane that appears to the left when preview data is available.

**Centered Modal Dialogs**: Settings, downloads, and informational dialogs (about, reference) use centered modals that overlay the main content.

**Lightweight Modals**: Some features need modals without the full dialog registry lifecycle (state snapshots, unsaved-changes detection, URL sync). These render conditionally based on a signal, manage their own backdrop/escape handling, and follow the same visual pattern (backdrop + rounded card + header). Examples: `TablePreviewModal` (join table preview), `EdaBivariateModal` (bivariate chart preview). Use this pattern when the modal is ephemeral and has no form state to protect.

**Unified Modal Shell**: Both dialog types use a shared component architecture that handles the backdrop, header (title + close button), and footer (actions). This ensures visual consistency and reduces code duplication across all dialogs.

**Z-Index Stacking Rule**: Modals use `position: fixed` with `z-index: var(--z-index-modal-backdrop)` (3000). They must **not** be rendered inside elements that set their own `z-index` (e.g., the EDA panel at `z-index: 1000`), because the parent creates a stacking context that traps the child — the modal's z-index becomes relative to the parent, not the viewport. Solution: render the modal as a sibling (use a fragment) or use a portal.

**Keyboard Accessibility**: Both dialog types implement focus trapping via `useFocusTrap` hook — Tab/Shift+Tab cycles within the dialog, and focus is restored to the previously focused element on close. Slide panel dialogs support Enter-to-submit (skipped when focus is in textarea, select, contenteditable, or CodeMirror editors).

**Preview Panel**: Appears in the remaining 2/3 of screen space when preview data exists for slide panel dialogs. Supports highlighting of new/derived columns and shows import previews with configurable row limits via UX settings.

**Replace Mode Feedback**:
In replace mode, the Import Dialog displays:

- **Replace Mode Banner**: A contextual header indicating which source is being updated.
- **Schema Diff Panel**: A proactive analysis panel showing detected differences between the existing schema and the replacement data. It categorizes changes into **Missing Columns** (warning state), **New Columns**, and **Type Changes**.
- **Danger States**: If columns present in the original source are missing in the replacement data, the Schema Diff Panel adopts a danger (red) theme to warn about potential model breakages.

**Column Selection Patterns**:

- **Single-select chips**: For source column pickers (sort, replace, regexp-\*)
- **Multi-select chips**: For bulk column operations (remove, unpivot) with Cmd/Ctrl+click toggle
- **List Selection**: For detailed management (rename, reorder, select) with drag-and-drop support

**Form Control Conventions**:

- **Radio buttons**: Preferred for small option sets in dialogs (delimiter, header mode, sheet selection). Keeps all choices visible at a glance.
- **Native `<select>`**: Avoid in dialogs — use radio buttons or chip selectors instead. Reserve `<select>` only for inline/toolbar contexts where space is extremely constrained.

**Preview Triggers**:

- **Auto-updating (debounced)**: filter, derive, regexp-match, regexp-extract, date, select-columns, impute
- **Button-triggered**: aggregate, join, pivot (expensive operations)

### 3.6 Toast Notifications

Toast notifications provide non-blocking feedback for user actions. They appear in the top-right corner and use the `ToastContainer` component.

**Notification Types**:

| Type        | Behavior                 | Duration | Use Case                                       |
| ----------- | ------------------------ | -------- | ---------------------------------------------- |
| **Success** | Auto-dismisses           | 3 sec    | Operation completed (import, export, rename)   |
| **Warning** | Auto-dismisses           | 6 sec    | Caution needed but not blocking                |
| **Error**   | Persists until dismissed | Manual   | Operation failed, requires user acknowledgment |

**Success Notifications** are shown for:

- Data import completion (with row count)
- Export operations (CSV, JSON, workflow)
- Model operations (create, copy, rename, delete)
- Source operations (rename, delete)
- Transform application
- Step removal and updates
- Clipboard copy operations

**Error Notifications** include step context when applicable (e.g., "Step 3: Filter: sales > 1000") to help users identify which transformation failed.

#### Notification Channel Selection

| Channel                 | Persistence                                      | Blocks user? | When to use                                                                         |
| ----------------------- | ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------- |
| **Toast**               | Auto-dismiss (success/warning) or manual (error) | No           | Confirming completed actions, reporting failures                                    |
| **Inline message**      | Until resolved                                   | No           | Field-level errors, form validation (`.error`), contextual banners (`InlineBanner`) |
| **Banner**              | Until dismissed                                  | Partial      | Ongoing conditions: stale model, replaced source data, multi-step errors            |
| **Confirmation dialog** | Until responded                                  | Yes          | Destructive actions: delete, replace, remove                                        |

**Rules**:

- One action per notification — no multi-button toasts
- Never auto-dismiss error notifications
- Prefer inline feedback near the action over toasts — use toasts for operations that complete away from the trigger
- For content writing conventions (tone, length, capitalization): see [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md)

### 3.7 Form Design Patterns

#### Field Composition

Standard anatomy for form fields in dialogs:

```
label              ← identifies the field
input              ← the control itself
helper text        ← persistent guidance, always visible
error message      ← appears on validation failure
```

CSS classes for all four elements are defined in `form-controls.module.css` (`.label`, `.input`, `.helpText`, `.error`).

#### Validation Timing

- **Validate on blur** (field loses focus) — not on every keystroke
- **Expression editors**: validate on debounce (existing behavior, keep it)
- **Show error state**: red border on input + error message below field
- **Dialog-level errors** (affecting the entire operation): use `.error` box in dialog body

#### Required vs Optional Fields

Follow the **"mark the minority"** principle (see §1.3):

- If most fields are required → mark only optional ones with "(optional)" after the label
- If most fields are optional → mark required ones with red asterisk (\*)
- Never mark both required and optional — pick one

#### Control Selection Thresholds

| Option count  | Recommended control                |
| ------------- | ---------------------------------- |
| 2–3           | Radio buttons or segmented control |
| 4–7           | Radio buttons or chip selector     |
| 8+            | Combobox with type-ahead filtering |
| Dynamic / 50+ | Combobox (essential)               |

Cross-reference: [UI-VOCAB.md](UI-VOCAB.md) §1 for the full control inventory.

#### Helper Text vs Placeholder vs Tooltip

| Channel         | Persistence      | Content type                      | Example                             |
| --------------- | ---------------- | --------------------------------- | ----------------------------------- |
| **Helper text** | Always visible   | Format hints, constraints         | "e.g., `sales > 1000`"              |
| **Placeholder** | Until user types | Example value                     | "Enter expression..."               |
| **Tooltip**     | On hover only    | Supplementary, non-essential info | "Columns with spaces: `[Col Name]`" |

Never use placeholder as the sole label — it disappears on input. See [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md) §6 for detailed rules.

#### Form Spacing in Dialogs

| Gap  | Token        | Use                                 |
| ---- | ------------ | ----------------------------------- |
| 4px  | `--space-xs` | Between label and input             |
| 8px  | `--space-sm` | Between input and helper/error text |
| 16px | `--space-md` | Between field groups                |
| 24px | `--space-lg` | Between form sections               |

### 3.8 Empty States

Every screen that can be empty should have a designed empty state — not blank space.

#### Types

| Type            | Trigger                                | Syto example                                       |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| **No data**     | Nothing to display yet                 | Main area before import (`EmptyState.tsx`)         |
| **User action** | User filtered/searched to zero results | Zero rows after filter, no columns selected in EDA |
| **Error**       | Operation failed                       | Pipeline error, failed import                      |

#### Principles

- **Positive framing**: describe what the user can do, not what's missing. "Import data to get started" not "No data loaded."
- **Always provide next action**: button, link, or instruction.
- **Replace the container content** — don't show an empty table shell with column headers and zero rows.
- **Anatomy**: icon (optional) + title + subtitle (optional) + action button(s).

#### Key Scenarios

| Scenario                      | Empty state message                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| No data loaded                | "Import data to get started" + action buttons                                         |
| Zero rows after filter        | Title: "No rows match the current filter" + Subtitle: "Try adjusting the expression." |
| No steps in pipeline          | "Add a transform from the ribbon above"                                               |
| No columns selected in dialog | "Select a column to begin"                                                            |
| EDA panel with no column      | "Select a column to see statistics"                                                   |
| No search results             | "No matches found"                                                                    |

For text conventions in empty states: see [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md) §8.

### 3.9 Disabled & Read-Only States

#### Variants

| State         | Visual treatment                    | Cursor        | Use case                          |
| ------------- | ----------------------------------- | ------------- | --------------------------------- |
| **Disabled**  | 50% opacity                         | `not-allowed` | Preconditions not met (temporary) |
| **Read-only** | Normal appearance, no hover effects | `default`     | Display-only contexts             |
| **Hidden**    | Not rendered                        | N/A           | Irrelevant to current context     |

#### "Why Disabled" Tooltip

Every disabled interactive element should explain _why_ it is disabled via a `title` attribute or tooltip. This pattern already exists for ribbon quick actions and should be generalized:

- Ribbon buttons: "Select a date column to use date operations"
- Dialog Apply button: "Fix validation errors to apply"
- Column-conditional controls: "Requires a numeric column"

#### CSS Convention

```css
/* Exclude aria-disabled from interactive pseudo-classes */
&:hover:not(:disabled):not([aria-disabled='true']) { ... }
&:active:not(:disabled):not([aria-disabled='true']) { ... }

/* Standard disabled pattern */
&:disabled,
&[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: auto; /* preserve tooltip access */
}
```

The hover/active exclusion is required because `aria-disabled` doesn't suppress pseudo-classes the way native `disabled` does. Without it, hover effects show on disabled buttons (depends on CSS source order for correctness — the explicit `:not()` is more robust).

Note: `pointer-events: auto` is required so that `title` tooltips remain accessible on disabled elements.

---

## 4. Typography & Scaling

- **Primary Font**: Graphik (fallback to Arial)
- **Hierarchy**: Medium weights (500) for headers and emphasis; Regular (400) for data.
- **Tabular Numerals**: Numeric cells and statistic tables use tabular numerals for better alignment and readability.

---

## 5. Implementation Standards

- **Borders**: Rigorous 1px solid borders in Medium Gray (`--color-medium-gray`) for structural separation.
- **Micro-interactions**: Subtle hover states and status transitions (`--transition-fast`).
- **Z-Index Strategy**: Centralized stacking order defined in `variables.css` to prevent overlap conflicts.
- **Token Usage**: Strict adherence to functional variables (e.g., `--color-text`, `--shadow-xl`) over hardcoded values.

### 5.1 Spacing Token Usage

| Token               | Size                                                               | Intended use |
| ------------------- | ------------------------------------------------------------------ | ------------ |
| `--space-xs` (4px)  | Tight internal gaps: label-to-input, icon-to-text, chip padding    |
| `--space-sm` (8px)  | Component internal padding, chip grid gaps, toolbar button spacing |
| `--space-md` (16px) | Between form field groups, dialog body padding, table cell padding |
| `--space-lg` (24px) | Between major sections within a dialog, panel content padding      |
| `--space-xl` (32px) | Page-level margins, large empty state padding                      |

**Principle**: proximity signals connection. Elements that are related should be closer together than elements that are not. Use the smallest token that maintains visual distinction between groups.

### 5.2 Motion & Animation

#### Reduced Motion

All animations must respect the user's OS preference. Add to `styles/base.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Duration Tiers

| Tier       | Token                 | Duration | Use                                                        |
| ---------- | --------------------- | -------- | ---------------------------------------------------------- |
| **Fast**   | `--transition-fast`   | 150ms    | Hover states, focus rings, toggle switches                 |
| **Normal** | `--transition-normal` | 200ms    | Slide panel open/close, expanding sections, dropdown menus |

Both tokens use `ease-out` easing, which is correct for entrances. Exit animations (elements leaving the screen) should use `ease-in` if distinct easing is needed, but for Syto's current scope the single easing is sufficient.

### 5.3 Icon Size Tokens

Five tiers in `variables.css` cover all icon dimensions:

| Token       | Size | Typical use                                        |
| ----------- | ---- | -------------------------------------------------- |
| `--icon-xs` | 12px | Compact type indicators (small variant)            |
| `--icon-sm` | 16px | Inline icons in menus, popovers, form controls     |
| `--icon-md` | 20px | Sidebar/toolbar action icons, type indicator badge |
| `--icon-lg` | 24px | Button icons, dialog icons, toolbar icons          |
| `--icon-xl` | 32px | Ribbon buttons, close buttons, nav buttons         |

**Rule**: Use icon tokens only for `.iconify` elements and icon-sized button containers. Non-icon UI elements (radio circles, color swatches, dots) should use explicit pixel values — icon tokens are a visual sizing tier, not a general "small square" abstraction.

### 5.4 Icon Sets

The project uses [Iconify](https://iconify.design/) with icons loaded on demand. Multiple icon sets are in use — each has a defined role:

| Set                       | Role                                             | Examples                                                     |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `carbon:`                 | Primary — general UI actions, status, navigation | `carbon:filter`, `carbon:edit`, `carbon:warning`             |
| `ix:`                     | Data-type column indicators                      | `ix:data-type-string`, `ix:data-type-integer`, `ix:calendar` |
| `material-symbols-light:` | Specialized domain icons (impute, pivot, split)  | `material-symbols-light:pivot-table-chart-rounded`           |
| `codicon:`                | Code-related actions                             | `codicon:replace`                                            |
| `mdi:`                    | JSON type only                                   | `mdi:code-json`                                              |

**Rules**:

- Default to `carbon:` for new icons. Only reach for another set when Carbon lacks a suitable glyph.
- Use `material-symbols-light:` (not `material-symbols:`) when Material Symbols icons are needed — the light weight matches the overall thin-line aesthetic.
- `getTypeIcon()` in `helper-handlers.ts` is the **single source** for column type → icon mappings. Components needing a type icon should import it rather than maintaining a local switch.

### 5.5 Button System

The global `buttons.css` defines shared button variants. Local CSS modules consume interaction tokens but own their layout.

#### Variants

| Variant         | When to use                                                    |
| --------------- | -------------------------------------------------------------- |
| `--primary`     | CTAs, form submit, confirmation dialogs                        |
| `--ghost`       | Default action button — use unless another variant fits better |
| `--secondary`   | Cancel buttons, navigation controls, toggle groups             |
| `--danger`      | High-emphasis destructive (confirmation dialogs)               |
| `--danger-text` | Standard destructive actions (delete, remove)                  |
| `--text`        | Links styled as buttons                                        |
| `--active`      | Toggle-on state (pairs with `--ghost` for toggle-off)          |
| `--small`       | Compact size modifier, combinable with any variant             |

#### Choosing a variant

1. **Is it destructive?** Use `--danger-text`. In confirmation dialogs, use `--danger` for the confirm action.
2. **Is it the primary action?** Use `--primary` (submit, confirm, CTA).
3. **Is it cancel or a secondary choice?** Use `--secondary`.
4. **Otherwise** use `--ghost` — it's the default for action buttons in chrome, content areas, and toolbars.

#### Local systems

- **Ribbon**: Vertical stack buttons with `--icon-xl` icons. Own layout, consumes `--btn-hover-bg`, `--btn-pressed-bg`, `--btn-disabled-opacity` tokens.
- **FloatingToolbar**: Icon-only buttons. Uses `--color-light-gray` hover (gray, not cyan — overlays data table where cyan means selection). Danger variant uses `--btn-danger-hover-bg`.
- **Sidebar**: Specialized undo/redo and step navigation. Consumes `--btn-disabled-opacity`.

#### Icon sizing

Button variants define `.iconify` sizing via CSS rules — never use inline `fontSize` styles:

- Standard buttons (`--secondary`, `--danger`, `--ghost`, `--active`): `--icon-lg` (24px)
- `--small` buttons: `--icon-md` (20px)
- Ribbon buttons: `--icon-xl` (32px) via local CSS module

#### Disabled states

A base disabled rule on `.button` provides `opacity: var(--btn-disabled-opacity)` (0.5), `cursor: not-allowed`, and `pointer-events: auto` (preserves tooltip access per §3.9). All variant hover/active states are guarded with `:not(:disabled):not([aria-disabled='true'])`.

#### Interaction tokens (`variables.css`)

| Token                    | Value                               | Purpose                    |
| ------------------------ | ----------------------------------- | -------------------------- |
| `--btn-hover-bg`         | `rgba(var(--color-cyan-rgb), 0.08)` | Standard button hover      |
| `--btn-pressed-bg`       | `rgba(var(--color-cyan-rgb), 0.15)` | Active/pressed state       |
| `--btn-disabled-opacity` | `0.5`                               | Universal disabled opacity |
| `--btn-danger-hover-bg`  | `rgba(var(--color-red-rgb), 0.1)`   | Danger variant hover       |

---

## 6. CSS Architecture & Maintainability

The project follows a **Modular Token-Based Architecture** designed for high modularity and theme-swapping reliability.

### 6.1 Modular Structure

- **Global Styles**: `styles/variables.css`, `styles/base.css`, `styles/layout.css`, `styles/buttons.css`
- **Shared Dialog Styles**: Three utility modules provide reusable classes across all dialogs:
  - `form-controls.module.css` — labels, inputs, checkboxes, radios, toggles, chips, error/warning boxes
  - `expression-help.module.css` — expression docs, example grids, operator tags, dynamic docs
  - `column-editor.module.css` — drag/drop column lists, rename inputs
- **Dialog-Specific Styles**: Complex dialogs have their own `*.module.css` (e.g., `SettingsDialog.module.css`, `DateDialog.module.css`) for styles used by one or two components
- **Component Styles**: Other CSS Modules co-located with components in `src/app/components/`
- **Debugging**: See [DEBUGGING.md](DEBUGGING.md) for CSS Module class name patterns and DevTools tips

When a dialog needs classes from multiple modules, import each and merge via spread:

```ts
import formStyles from './form-controls.module.css';
import exprStyles from './expression-help.module.css';
const styles = { ...formStyles, ...exprStyles };
```

**Rule**: Modifier classes (e.g., `.active` nested inside `.chip`) must come from the same module as their parent class — CSS Modules hashes are per-file, so cross-module compound selectors won't match.

### 6.2 Theming Logic

A two-tier variable system separates static palettes from functional tokens:

1.  **Palettes**: Raw hex codes grouped by brand (Syto, KSE).
2.  **Functional Tokens**: Logic-based variables (e.g., `--color-primary`, `--shadow-md`) that map to palettes based on the active theme.

### 6.3 Unified Component Patterns

- **Elevations**: Shadow tokens `--shadow-sm` through `--shadow-xl` for standard drop shadows, plus `--shadow-panel` (side shadow for slide panels) and `--shadow-up` (upward shadow for bottom-anchored panels like EdaPanel). Use the standard tiers for overlays and floating elements; use the directional variants only for edge-anchored UI.
- **Overlays**: Shared backdrop and blur tokens provide a consistent "glassmorphism" feel for both Slide Panels and Centered Dialogs.
- **Aesthetic Consistency**: Modals and Dialogs share standardized header/footer padding and styling, ensuring a contiguous visual language regardless of the interaction type.

---

## 7. Component Catalog

All UI components are Preact/TSX with co-located CSS Modules in `src/app/components/`.

### 7.1 Layout Components

| Component           | Purpose                                 |
| ------------------- | --------------------------------------- |
| `App.tsx`           | Root component, orchestrates layout     |
| `RibbonToolbar.tsx` | Workflow tabs and transform actions     |
| `Sidebar.tsx`       | Sources/models tree and import actions  |
| `DataTable.tsx`     | Paginated data preview with type badges |
| `PaginationBar.tsx` | Stats, download, copy actions           |

### 7.2 Dialog Components

**Shell Components**:

- `DialogShell.tsx` — Shared backdrop, header, footer
- `SlidePanel.tsx` — Right-side panel for transforms
- `CenteredModal.tsx` — Overlay modal for settings/info

**Transform Dialogs**:

- `FilterDialog.tsx`, `DeriveDialog.tsx`, `SortDialog.tsx`
- `AggregateDialog.tsx`, `PivotDialog.tsx`, `JoinDialog.tsx`
- `SplitDialog.tsx`, `ReplaceDialog.tsx`, `FoldDialog.tsx`
- `RegexpMatchDialog.tsx`, `RegexpExtractDialog.tsx`
- `TypeConversionDialog.tsx`, `DedupeDialog.tsx`, `ImputeDialog.tsx`, `SampleDialog.tsx`
- `GenerateDialog.tsx` — Synthetic data generation

**Other Dialogs**:

- `ImportCsvDialog.tsx`, `ImportUrlDialog.tsx`
- `DownloadDialog.tsx`, `SettingsDialog.tsx`
- `FunctionReferenceDialog.tsx` — Expression function reference
- `JsonEditorModal.tsx` — Full-screen CodeMirror editor for pipeline JSON

### 7.3 EDA Components

Located in `src/app/components/eda/`:

| Component                       | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `EdaPanel.tsx`                  | Main panel orchestrating EDA sections and chart rendering |
| `eda/EdaOverview.tsx`           | Stats summary (rows, missing, unique, errors)             |
| `eda/EdaNumericSection.tsx`     | Numeric column statistics, boxplots, histograms           |
| `eda/EdaCategoricalSection.tsx` | Categorical/frequency distribution (bar chart + list)     |

**Data flow**: Column click → `eda-handlers.ts` → `EDAEngine.calculateStats()` → `AppStore.edaStats` signal → `EdaPanel` renders the appropriate section. Chart rendering uses `ChartsEngine` (Vega-Lite) via refs in `EdaPanel`'s useEffect.

**Treatment toggles**: Date and numeric columns support a "treatment toggle" in the panel header that switches between their native view and a categorical view. Each toggle is backed by a signal (`edaDateTreatment`, `edaNumericTreatment`). When categorical is selected for numeric columns, `EDAEngine.calculateCategoricalOverlay()` computes frequency stats lazily. Both sections share the same `edaChartGrid` layout (chart left, detail panel right).

**Actionable data rule**: All interactive data elements in the EDA panel (stat values, missing/error counts, categorical chart bar segments) must use the shared `CellToolbar` via `AppStore.selectedCell` — not bespoke dropdowns. Set `selectedCell` with appropriate flags (`isEda`, `isEdaMissing`, `isError`) and position the toolbar via `cellToolbarPos`. This keeps the interaction pattern consistent with cell clicks in the data table. Clicking a categorical bar segment opens the same toolbar used when clicking the corresponding cell value: null → keep/remove missing; error → keep/remove errors; regular value → `=`/`≠`/replace (plus comparable ops when treating numeric as categorical). The "Other" aggregate bin is intentionally non-interactive. Visually, actionable data uses a faint background tint at rest + an icon hint on hover (see `edaStat--clickable` pattern).

**`isEda` caveat**: `CellToolbar`'s `isEda` branch renders nothing for non-comparable types (e.g. strings) — it's designed for missing/error markers and numeric comparisons. For regular (non-null, non-error) values of any type, omit `isEda` and set `rowIdx: -1`; this routes through the standard cell toolbar (= / ≠ / replace, plus comparable ops). `updateToolbarPosition()` will silently no-op on `rowIdx: -1` since no matching DOM cell exists — callers must set `cellToolbarPos` themselves.

### 7.4 Pipeline Components

| Component             | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `StepEditor.tsx`      | Individual step display                      |
| `JsonEditorModal.tsx` | Full-featured CodeMirror editor for raw JSON |

### 7.5 Sub-Component Directories

Complex dialogs are split into focused sub-components organized in directories:

**Join Dialog** (`join/`):

| Component                | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `JoinTypeSelector.tsx`   | Join type selection (left, inner, etc.) |
| `JoinKeyPairEditor.tsx`  | Key pair management for join conditions |
| `JoinColumnSelector.tsx` | Column selection from joined tables     |

Join key auto-matching: When both tables are available, the dialog auto-populates key pairs from columns with identical names (`findMatchingColumns` in `join-handlers.ts`). When a user switches one table, key selections on the _unchanged_ side are preserved — only invalid keys (columns no longer present) are cleared, then remaining unmatched columns are auto-matched.

**Generate Dialog** (`generate/`):

| Component                   | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `GeneratorTypeSelector.tsx` | Generator type selection (sequence, etc.) |
| `GeneratorConfigEditor.tsx` | Type-specific configuration editors       |

**Column Selector** (`column-selector/`):

| Component            | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `ColumnSelector.tsx` | Unified selection (Grid/List modes, opt-in `searchable` prop) |
| `ColumnChip.tsx`     | Individual column chip component                              |
| `ColumnRow.tsx`      | List mode row component                                       |

### 7.6 Shared Components

| Component              | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `ColumnToolbar.tsx`    | Floating actions on column header (single + multi)                   |
| `CellToolbar.tsx`      | Floating actions on cell click                                       |
| `RowToolbar.tsx`       | Floating actions on row selection                                    |
| `TypeIndicator.tsx`    | Column type indicator with icon                                      |
| `ExpressionEditor.tsx` | CM6 multi-line editor with syntax highlighting                       |
| `ExpressionDocs.tsx`   | Context-aware inline docs for expression dialogs                     |
| `InlineBanner.tsx`     | Typed banner (info/warning/error/success) for dialog inline feedback |
| `GlobalUI.tsx`         | Toast notifications (see §3.6) and global modals                     |
| `ToastContainer.tsx`   | Renders toast notification stack                                     |

---

## 8. Global Styles

Located in `styles/` directory:

| File             | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `variables.css`  | Design tokens (colors, spacing, shadows, z-index) |
| `base.css`       | Resets, global defaults, `:focus-visible` ring    |
| `typography.css` | Font definitions and text styles                  |
| `layout.css`     | Grid system and structural layout                 |
| `buttons.css`    | Button variants and states                        |
| `util.css`       | Utility classes                                   |

---

## 9. Accessibility Patterns

Syto targets WCAG 2.1 AA for dialog and widget semantics. These conventions apply to all components.

### 9.1 Dialog ARIA Roles

Every modal surface must declare its role, trap focus, and be labeled:

| Attribute         | Value                                                                    | Notes                                                                  |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `role`            | `"dialog"` (informational) or `"alertdialog"` (destructive/confirmation) | Use `alertdialog` for step removal, dependency impact, unsaved changes |
| `aria-modal`      | `"true"`                                                                 | Always present on dialog surfaces                                      |
| `aria-labelledby` | Unique ID matching the title element                                     | e.g., `"filter-dialog-title"`                                          |

Title elements (`<h2>`, `<h3>`) must have a matching `id`. Close buttons must have `aria-label={t('buttons.close', { ns: 'common' })}` (or a hardcoded string if the component doesn't use i18n).

### 9.2 Live Regions

| Component        | Role     | aria-live | Rationale                            |
| ---------------- | -------- | --------- | ------------------------------------ |
| `ToastContainer` | `log`    | `polite`  | Informational — should not interrupt |
| `StatusBar`      | `status` | `polite`  | Processing indicator                 |

Never use `role="alert"` (assertive) for toasts — it interrupts screen reader speech mid-sentence.

### 9.3 Decorative Icons

All `<span class="iconify">` elements must have `aria-hidden="true"`. Icons are decorative; adjacent text provides meaning.

```tsx
// Correct
<span class="iconify" aria-hidden="true" data-icon="carbon:filter"></span>

// Wrong — screen reader announces meaningless icon name
<span class="iconify" data-icon="carbon:filter"></span>
```

### 9.4 Icon-Only Buttons

Buttons with only an icon (no visible text) must have both `title` and `aria-label` with the same value:

```tsx
<button title={t('sort.ascending')} aria-label={t('sort.ascending')}>
  <span class="iconify" aria-hidden="true" data-icon="carbon:sort-ascending"></span>
</button>
```

Applies to: `ColumnToolbar`, `RowToolbar`, `PaginationBar`, and any toolbar with icon-only actions.

### 9.5 Tab Widgets

Tab-like navigation (e.g., `AppHeader` ribbon tabs) must use:

- `role="tablist"` + `aria-label` on the container
- `role="tab"` + `aria-selected` on each tab button

### 9.6 Data Tables

The `<table>` element in `DataTable` must have `aria-label={t('dataTable.ariaLabel')}`.

### 9.7 Skip Navigation

A visually-hidden skip link (`<a href="#main-content" class="visually-hidden">`) is rendered as the first child of `App.tsx`. The `<main>` element has `id="main-content"`. The `.visually-hidden` utility class in `styles/util.css` hides the link until focused.

---

**End of UX Specification**
