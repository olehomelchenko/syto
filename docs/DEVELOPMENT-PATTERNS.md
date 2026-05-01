# Syto — Development Patterns

> **Related Documentation**:
>
> - **[SPECIFICATION.md](SPECIFICATION.md)**: Technical architecture and codebase map
> - **[DATA-SPECIFICATION.md](DATA-SPECIFICATION.md)**: Data structures and transform format
> - **[UX-SPECIFICATION.md](UX-SPECIFICATION.md)**: UI/UX design guidelines
> - **[I18N-GUIDE.md](I18N-GUIDE.md)**: Complete i18n reference

This document describes established patterns for developing Syto. Follow these conventions when adding features or modifying existing code.

---

## 0. AI Development Rules

**Prohibited Actions**:

- **NEVER** run `git add`, `git commit`, `git stash`, or `git push`.
- All staging and committing must be done by the USER.

---

## 1. Adding a New Transform

Adding a transform requires changes across multiple files. All transform logic must be **non-destructive** — sources immutable, transforms return new tables, no side effects. See [SPECIFICATION.md §4.1](SPECIFICATION.md) for the full non-destructive principles.

> **New dialogs use the `useDialogState` pattern** — local signals in the component, `bridgedDialogEntry()` in the registry. No global state file, no handler file, no DialogCoordinator case. The legacy checklist below only applies to the remaining non-transform dialogs (`import-csv`, `import-url`, `import-text`, `generate`, `settings`, `type-conversion`, `workflow-import`).

### 1.1 Checklist (new style — `useDialogState`)

**Core layer** (same for both patterns):

| Step | File                                           | What to Add                                                                                                                                                           |
| ---- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/core/transforms/types.ts`                 | Add to `FullTransformStep` + `KNOWN_TRANSFORM_KEYS`. If the transform references another model/source (like join, concat), also add to `MULTI_MODEL_REFERENCE_PATHS`. |
| 2    | `src/core/schema-engine.ts`                    | Add to `TransformStep` interface + schema propagation                                                                                                                 |
| 3    | `src/core/transforms/handlers/<category>.ts`   | Transform implementation                                                                                                                                              |
| 4    | `src/core/transforms/handlers/index.ts`        | Register handler in `TRANSFORM_HANDLERS`                                                                                                                              |
| 5    | `src/core/transforms/describers/<category>.ts` | Human-readable description                                                                                                                                            |
| 6    | `src/core/transforms/describers/index.ts`      | Register describer in `TRANSFORM_DESCRIBERS`                                                                                                                          |

**App layer** (new style):

| Step | File                                   | What to Add                                                                      |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------- |
| 7    | `src/app/types.ts`                     | Add to `DialogName` union type                                                   |
| 8    | `src/app/components/*Dialog.tsx`       | Dialog component using `useDialogState` hook (state + validation + edit support) |
| 9    | `src/app/components/index.ts`          | Export dialog component                                                          |
| 10   | `src/app/components/App.tsx`           | Render dialog in slide-panel section                                             |
| 11   | `src/app/dialog-registry.ts`           | `bridgedDialogEntry()` with inline `applyHandler`                                |
| 12   | `src/app/components/RibbonToolbar.tsx` | Ribbon button                                                                    |

**Key conventions:**

- Dialog state is created via `useDialogState((ctx) => ({ ... }))` — factory receives `columns`, `selectedColumns`, `schema`, `editingStep`
- Edit mode: factory reads `ctx.editingStep?.xxx` to pre-populate (no code needed in `step-handlers.ts:editStep()`)
- Error state: `hasError` / `getError` options on the hook flow to the Apply button via bridge signals
- Preview: use `useTransformPreview` hook (wraps `createDebouncedPreview`)

**Example:**

```tsx
import { signal } from '@preact/signals';
import { useDialogState } from '../hooks/useDialogState';

export function XxxDialog() {
  const { state } = useDialogState(
    (ctx) => {
      const editing = ctx.editingStep?.xxx;
      const initialCol =
        (editing as any)?.column ?? AppStore.selectedColumn.value ?? ctx.columns[0] ?? '';
      return {
        column: signal(initialCol),
        field: signal<string>((editing as any)?.field ?? 'default'),
      };
    },
    {
      hasError: (s) => !s.field.value,
      getError: (s) => (!s.field.value ? 'Field required' : null),
    }
  );
  // render using state.field.value
}
```

The registry entry uses `bridgedDialogEntry()`; its `applyHandler` reads `DialogStore.activeDialogState.value` (written by the hook) and dispatches via `StepService.runTransform()`.

**Three reactive patterns inside a dialog — pick the right one:**

- `useComputed` — derived render value (JSX or display string) from signals
- `useSignalEffect` — side-effectful reaction to signal changes (update another signal)
- `useTransformPreview` / `createDebouncedPreview` — debounced data preview with table output

For **manual-trigger previews** (button click, not auto-triggered), use `createDebouncedPreview` directly with a `useRef` — `useTransformPreview`'s `deps`-based auto-trigger is wrong there.

**i18n + docs + tests:**

| Step | File                                       | What to Add                                      |
| ---- | ------------------------------------------ | ------------------------------------------------ |
| 13   | `src/i18n/locales/{en,uk}/dialogs.json`    | Dialog title + dialog-specific strings           |
| 14   | `src/i18n/locales/{en,uk}/transforms.json` | Describer translation (with plural forms for UK) |
| 15   | `src/i18n/locales/{en,uk}/ui.json`         | Ribbon button label + title                      |
| 16   | `src/core/transforms-*.test.ts`            | Core logic tests                                 |
| 17   | `docs/DATA-SPECIFICATION.md`               | Transform documentation                          |
| 18   | `src/app/handlers/*`                       | Cycle check (if external ref, e.g. join/concat)  |

### 1.1.1 Legacy Checklist (global DialogStore)

<details>
<summary>For un-migrated dialogs only — click to expand</summary>

**App layer** (legacy):

| Step | File                                           | What to Add                                                   |
| ---- | ---------------------------------------------- | ------------------------------------------------------------- |
| 7    | `src/app/types.ts`                             | Add to `DialogName` union type                                |
| 8    | `src/app/stores/dialogs/<category>/*-state.ts` | Dialog state signals + reset function                         |
| 9    | `src/app/stores/dialogs/<category>/index.ts`   | Export new state                                              |
| 10   | `src/app/stores/DialogStore.ts`                | Import + add static field                                     |
| 11   | `src/app/handlers/transform/*-handlers.ts`     | Construct step, preview, apply handlers                       |
| 12   | `src/app/components/*Dialog.tsx`               | Dialog UI component                                           |
| 13   | `src/app/components/index.ts`                  | Export dialog component                                       |
| 14   | `src/app/components/App.tsx`                   | Render dialog in slide-panel section                          |
| 15   | `src/app/dialog-registry.ts`                   | Registry entry (`applyHandler`, `getState`, `getError`, etc.) |
| 16   | `src/app/components/RibbonToolbar.tsx`         | Ribbon button                                                 |

</details>

### 1.2 Adding a One-Click Shortcut (No Dialog)

For simple one-click transforms that wrap a single expression (e.g., `upper()`, `round()`, `year()`) or convert a column type, use the shortcut registry instead of the full checklist above:

1. Add one entry to `SHORTCUT_REGISTRY` in `src/app/handlers/transform/shortcut-handlers.ts`
2. Add i18n keys (`label`, `title`) in both `en/ui.json` and `uk/ui.json` under `ribbon.popovers.{category}.shortcuts`

No changes needed in `AppController`, `RibbonToolbar`, or other files — rendering and execution are data-driven.

### 1.2.1 Adding a Dialog Pre-Fill Preset (Opens Dialog with State)

For ribbon popover chips that pre-configure a dialog rather than applying instantly (e.g., Window presets like "Running Total", or `quickFilter`/`quickSplit` in `interaction-handlers.ts`):

1. Define preset data and a function that stashes it (see preset mechanism below)
2. Add a `ShortcutChip` in the popover content that calls the pre-fill function, then `onOpenDialog('...')`
3. Add i18n keys under `ribbon.popovers.{category}.shortcuts`

This is distinct from §1.2 shortcuts (which apply immediately). Use this pattern when the transform needs user review before applying.

**Preset mechanism for migrated dialogs.** Because `useDialogState` creates local signals only on mount, a quick action can't pre-fill them directly. Use a pair of module-level functions in the handler file:

```ts
// handlers/transform/xxx-handlers.ts
let xxxPreset: XxxPreset | null = null;
export function setXxxPreset(data: XxxPreset) {
  xxxPreset = data;
}
export function consumeXxxPreset(): XxxPreset | null {
  const p = xxxPreset;
  xxxPreset = null;
  return p;
}
```

The quick action calls `setXxxPreset(...)` then `openDialog('xxx')`. The factory calls `consumeXxxPreset()` to read and clear. Use this only when the preset data is non-trivial — simple cases (single column) should just read `AppStore.selectedColumn.value` in the factory.

### 1.2.2 Adding a Column Menu Quick Action

Column menu items are **data-driven** — defined as a `MenuEntry[]` array in `ColumnToolbar.tsx`. Each entry can specify `showFor` (whitelist) or `hideFor` (blacklist) column types. Adding or removing an item per type is a one-line config change.

**Flow**: `ColumnToolbar.tsx` (menu entry + prop) → `App.tsx` (callback wiring) → `AppController` (delegation) → `interaction-handlers.ts` (pre-fill `DialogStore` + `onOpenDialog`)

To add a new column menu item:

1. Add a `MenuEntry` object in the `menuEntries` array in `ColumnToolbar.tsx` with `showFor`/`hideFor` as needed
2. Add the callback prop to `ColumnToolbarProps` and wire it in `App.tsx`
3. Add a `quick*` function in `interaction-handlers.ts` that pre-fills `DialogStore.*State` and calls `onOpenDialog`
4. Add a pass-through method in `AppController.ts`
5. Add i18n keys under `toolbars.column.*` in both locale files

For actions that don't open a dialog (e.g., Sort, Remove), step 3 calls `StepService` directly instead.

### 1.2.3 Adding a New Window Function

Window functions are a sub-system of the `window` transform. Adding a new function touches fewer files than a full transform but requires registration in multiple layers:

| Layer     | File                                                                           | What to Add                                                                  |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Runtime   | `src/core/transforms/handlers/window.ts`                                       | Add to `WINDOW_FUNCTIONS` list                                               |
| Constants | `src/core/transforms/window-constants.ts`                                      | Add to `COLUMN_REQUIRED_FUNCTIONS` if it needs a source column               |
| Handler   | `src/app/handlers/transform/window-handlers.ts`                                | Add case in `buildWindowExpression()`                                        |
| Schema    | `src/core/schema-engine.ts`                                                    | Add type inference rule (ranking → float, positional → inherits source type) |
| UI        | `src/app/components/WindowDialog.tsx`                                          | Add to the correct category in `functionCategories`                          |
| i18n      | `src/i18n/locales/{en,uk}/dialogs.json`                                        | Add `window.functions.*` and `window.functionDescriptions.*`                 |
| Docs      | `src/content/functions/aggregate.md` + `src/content/uk/functions/aggregate.md` | Add to the appropriate table                                                 |

### 1.3 Core Implementation (`transforms/handlers/`)

Transforms are organized into category files in `src/core/transforms/handlers/`. Pattern for transform logic:

```typescript
// In src/core/transforms/handlers/your-category.ts
export function applyYourTransform(
  table: ColumnTable,
  params: YourTransformParams,
  schema: ColumnSchema[]
): ColumnTable {
  const { param1, param2 } = params;

  // 1. Validate inputs
  if (!param1) {
    throw new Error('param1 is required');
  }

  // 2. Apply transformation using Arquero
  const result = table.derive({ newCol: (d) => d.existingCol * 2 });

  // 3. Return modified table
  return result;
}
```

Then register in `src/core/transforms/handlers/index.ts` and add a describer in `src/core/transforms/describers/`.

Key conventions:

- Each transform is a single-key object (only one transform type per step)
- Use Arquero verbs when possible (`filter`, `derive`, `select`, `groupby`, etc.)
- Throw descriptive errors for invalid inputs
- Handle null/undefined values gracefully
- **Normalise Arquero `undefined` → `null` at handler output.** Per SOUL §7 and [DATA-SPECIFICATION §1.5](DATA-SPECIFICATION.md), Syto's missing-data sentinel is `null` everywhere. Arquero leaks `undefined` from at least three places: rollups of empty/all-null groups (`sum`, `mean`, `min`, `max`, `median`), unmatched cells in `left`/`right`/`full`/`lookup` joins, and the merged key column of unmatched rows in `join_full`. If your handler wraps an Arquero verb that can produce these, derive a post-process step that coerces `undefined` to `null` across the affected columns. See `handlers/aggregate.ts` and `handlers/join.ts` for the canonical patterns.
- **Transforms that generate new column names** (split, unroll, spread, pivot, describe-style output) **must call `assertNoCollisions`** from `src/core/transforms/unique-names.ts` before mutating the table. Arquero's `derive`/`spread`/`pivot` silently overwrite existing columns that happen to share a generated name, and that's a data-loss bug. Use `pickUniqueName` for internal scratch columns.

**Two expression styles in transforms:**

- **Row-wise** (derive, filter, conditional): Full AST pipeline — `parseExpression()` → `validateAST()` → `interpretAST()` per row. See §7. Column references: bare identifier for simple names, `[Bracketed Name]` for anything else — both produce `Identifier` AST nodes (the bracket form is a native jsep plugin, not a string pre-pass).
- **Arquero op-based** (window, aggregate): Persisted as strings like `"op.sum('col')"` or `"op.lag('col', 1)"`.
  - **Aggregate rollup specs** (zero-arg or single-column): encode and decode only via `encodeRollupSpec`/`decodeRollupSpec`/`tryDecodeRollupSpec` in `src/core/transforms/rollup-spec.ts` — never regex-parse these strings ad-hoc. The decoder handles three dialects (single-quoted legacy, bare-identifier legacy, JSON-quoted for names with quotes/backslashes) so column names with unusual characters round-trip safely.
  - **Window specs** (multi-arg, e.g. `op.lag('col', 1)`) use a separate parser in `src/core/transforms/handlers/window.ts` — they're not interchangeable with the rollup-spec helpers. TODO: window persistence still has the ad-hoc dialect and doesn't round-trip names with commas/quotes; converge with rollup-spec once a shared multi-arg encoder exists.
  - Aggregate functions in window context **must** be wrapped with `aq.rolling(opResult, frame)` — plain `op.sum` in `derive()` gives the whole-group total, not a running aggregate. Default frame `[-Infinity, 0]` gives SQL-consistent cumulative behavior.

### 1.4 Schema Propagation (`schema-engine.ts`)

Every transform must define how it affects the schema:

```typescript
// In deriveNextSchema()
if (transform.yourTransform) {
  // Option A: Transform produces a new column set from sample data (join, lookup, selectPattern, etc.)
  if (sampleData && sampleData.length > 0) {
    return this.inferSchemaFromSample(currentSchema, sampleData, { updatePositions: true });
  }

  // Option B: Add/modify specific columns
  return [...schema, { name: outputColumn, type: 'string' }];

  // Option C: Remove columns
  return schema.filter((col) => col.name !== removedColumn);
}
```

For transforms that produce a new column set from sample data, use `inferSchemaFromSample()` instead of writing the inference loop manually. It accepts options: `updatePositions` (override `originalPosition`), `promoteTypes` (use `getPromotedType` for existing columns), `sampleSize` (default 20).

### 1.5 Dialog State (`stores/dialogs/`)

Dialog states are organized in `src/app/stores/dialogs/` by category (transform, column, aggregate, combine, text, pattern, import). Create a new state file in the appropriate category:

```typescript
// In src/app/stores/dialogs/<category>/your-transform-state.ts
import { signal } from '@preact/signals';
import { registerReset } from '../reset-registry';

export const yourTransformState = {
  param1: signal(''),
  param2: signal<string[]>([]),
  error: signal<string | null>(null),
  previewData: signal<DataRow[] | null>(null),
};

// Register reset function
registerReset(() => {
  yourTransformState.param1.value = '';
  yourTransformState.param2.value = [];
  yourTransformState.error.value = null;
  yourTransformState.previewData.value = null;
});
```

Then export from the category's `index.ts` and the main `dialogs/index.ts`.

### 1.6 Dialog Component

Standard dialog structure:

```tsx
export function YourTransformDialog() {
  const state = DialogStore.yourTransformState;
  const columns = AppStore.columns.value; // Available columns

  // Validation effect
  useSignalEffect(() => {
    const value = state.param1.value;
    if (!value) {
      state.error.value = 'Parameter is required';
    } else {
      state.error.value = null;
      debouncedUpdatePreview();
    }
  });

  return (
    <SlidePanel
      title="Your Transform"
      onClose={() => DialogStore.closeDialog('yourTransform')}
      footer={
        <button onClick={handleApply} disabled={!!state.error.value}>
          Apply
        </button>
      }
    >
      <div class={styles.field}>
        <ColumnSelector
          label="Target Column"
          columns={columns}
          selectedColumns={state.param1.value}
          onSelectionChange={(val) => (state.param1.value = val as string)}
          mode="single"
          display="chip"
        />
      </div>
      {state.error.value && <div class={styles.error}>{state.error.value}</div>}
    </SlidePanel>
  );
}
```

### 1.7 Handler Functions

Handlers are organized in `src/app/handlers/` subdirectories by category:

- `transform/` — aggregate, derive, filter, join, pivot handlers, etc.
- `import/` — csv, json, generate handlers
- `dialog/` — column-editor, interaction handlers
- `core/` — step, keyboard, notification handlers

Handlers use stores directly and leverage shared utilities from `preview-engine.ts` and `validation-engine.ts` at the handlers root.

**Using Preview Engine** (recommended for new handlers):

```typescript
import { createDebouncedPreview } from './preview-engine';

const previewHandle = createDebouncedPreview({
  compute: () => {
    // Read dialog state, build transform, apply to AppStore.currentTable
    // Return { title, stats, columns, newColumns, rows } or null
  },
  onError: (error) => {
    state.error.value = error.message;
  },
});

export const debouncedUpdatePreview = previewHandle.trigger;
export const clearYourTransformPreview = previewHandle.clear;
```

**Preview column selection**: Each transform handler decides which columns to show in its preview. Prefer showing columns relevant to the operation — e.g., derive shows columns referenced in the expression (via `computeTokens()` from `expression-token-extractor.ts`) + the output column; merge shows selected merge columns + output. Avoid arbitrary slicing like `columns.slice(0, N)`.

See existing handlers (e.g., `filter-handlers.ts`) for full examples including `applyTransform` and `StepService.runTransform` patterns.

**Using Validation Engine** (for expression/regex validation):

```typescript
import { validateExpression, validateRegexPattern } from './validation-engine';

// Returns { valid, ast } — writes error to signal automatically
validateExpression(expression, columns, { errorSignal: state.error });

// Returns { valid, regex }
validateRegexPattern(pattern, { errorSignal: state.error, flags: 'gi' });
```

**Callback Pattern** (for UI integration):

```typescript
let callbacks: YourHandlerCallbacks | null = null;

// Called by AppOrchestrator.wireHandlerCallbacks() during initialization
export function setCallbacks(cb: YourHandlerCallbacks) {
  callbacks = cb;
}

// Handlers use callbacks for UI operations
export function handleAction() {
  callbacks?.openDialog('yourDialog');
}
```

---

## 2. State Management

**General principle — state-aware operations**: When one part of the app acts on data, it should respect the context established by other parts. For example, if the user has selected columns in the table and then opens a dialog, the dialog should pre-populate with those columns rather than starting from scratch. Prefer reading existing app state over hardcoded defaults. This makes the tool feel cohesive — every interaction builds on prior context rather than resetting it.

### 2.1 Two-Store Architecture

Syto uses two signal-based stores with distinct responsibilities:

| Store         | Purpose                                       | Lifetime         |
| ------------- | --------------------------------------------- | ---------------- |
| `AppStore`    | Application state (data, navigation, UI mode) | Session          |
| `DialogStore` | Form state for dialogs                        | Dialog lifecycle |

**AppStore** contains:

- Data state: `sources`, `models`, `currentTable`, `schema`
- Navigation: `activeSourceId`, `activeModelId`, `activeStepIndex`
- UI state: `selectedColumns`, `selectedCell`, `currentPage`
- Mode flags: `isJsonEditorOpen`, `isEdaVisible`

**DialogStore** contains:

- Per-dialog form values (inputs, selections)
- Validation errors
- Preview data
- Dialog open/close state

### 2.2 When to Use Each Store

```
User clicks "Filter" button
  → DialogStore.openDialog('filter')     // Dialog opens
  → DialogStore.filterState.expression   // Form input
  → DialogStore.filterState.error        // Validation feedback
  → DialogStore.filterState.previewData  // Preview rows

User clicks "Apply"
  → StepService.runTransform()           // Executes transform
  → AppStore.models updated              // New step added
  → AppStore.currentTable updated        // Data changes
  → DialogStore.closeDialog('filter')    // Dialog closes
  → DialogStore.resetAll()               // Form state cleared
```

### 2.3 Signal Patterns

Reading signals in components:

```tsx
// Direct read (triggers re-render on change)
const value = AppStore.someSignal.value;

// Computed (derived from other signals)
const hasData = computed(() => AppStore.sources.value.length > 0);
```

Writing signals:

```typescript
// Direct assignment
AppStore.someSignal.value = newValue;

// Batch updates (no built-in batching, just assign sequentially)
AppStore.signal1.value = value1;
AppStore.signal2.value = value2;
```

**Signal subscription trap**: Any `.value` read during a component's render — including inside helper functions called during render — subscribes that component to the signal. A parent component that calls `helperThatReadsSignal()` during render will re-render whenever that signal changes, cascading to all children. Use `useComputed()` to isolate derived values:

```tsx
// BAD: App subscribes to expression.value, error.value via hasError() internals
const dialogError = activeDialogHasError();

// GOOD: App subscribes only to the computed boolean result
const dialogError = useComputed(() => activeDialogHasError());
// use dialogError.value in JSX
```

Effects for side-effects:

```typescript
useSignalEffect(() => {
  // Runs when any accessed signal changes
  const expr = DialogStore.filterState.expression.value;
  validateExpression(expr);
});
```

**ExpressionEditor sync-back loop (critical)**: `ExpressionEditor` is a controlled CodeMirror component with a bidirectional data flow that can freeze the browser if broken:

```
User types → CM updateListener → onChange(doc) → signal.value = doc
                                                        ↓
CM ← dispatch(value) ← useEffect([value]) ← re-render ← signal change
```

The `isSyncing` ref flag in `ExpressionEditor.tsx` breaks this cycle: when the sync-back `useEffect` dispatches a programmatic change, the `updateListener` skips calling `onChange`. **Do not remove this guard** — without it, any edge case where the round-trip produces a slightly different string (whitespace normalization, IME composition, etc.) causes an infinite synchronous loop that freezes the browser tab. The string equality check (`value !== doc.toString()`) alone is not sufficient.

### 2.3 Settings Wiring Flow

Adding a new user setting touches 6 files in a specific chain:

```
ux-settings.ts          — UXSettings interface + DEFAULT_SETTINGS + loadUXSettings() merge
    ↓
settings-state.ts       — Dialog signal (e.g., signal<'a' | 'b'>('a'))
    ↓
DialogCoordinator.ts    — Init: reads from AppStore.uxSettings → writes to dialog signal
    ↓
SettingsDialog.tsx       — UI control + local handler that updates the signal
    ↓
App.tsx                  — Wires onXxxChange callback to AppController method
    ↓
AppController.ts         — Persists: updates AppStore.uxSettings + calls updateUXSetting()
```

Settings are **immediate-apply** — changes take effect on click, persisted to localStorage, no "unsaved changes" confirmation. Also update the default in `AppStore.uxSettings` initial value and `test-utils.ts` `defaultUxSettings`.

---

## 3. Testing Patterns

> For _strategic_ guidance (what tests should protect against, diagnostic questions, audit protocol) see [TESTING_STRATEGY.md](TESTING_STRATEGY.md). This section is tactical: how to write tests that fit this codebase's conventions.

### 3.1 Test Organization

| Test Type   | Location                        | Purpose                                  |
| ----------- | ------------------------------- | ---------------------------------------- |
| Unit        | `src/core/*.test.ts`            | Core logic (transforms, parsing, schema) |
| Integration | `src/core/integration.test.ts`  | Multi-step pipelines                     |
| Handler     | `src/app/handlers/*.test.ts`    | Handler logic and state management       |
| Component   | `src/app/components/*.test.tsx` | UI interaction                           |

### 3.2 Handler Test Utilities

Use shared utilities from `src/app/handlers/test-utils.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetStores, setTestData, TestData, suppressConsole } from './test-utils';
import { AppStore } from '../stores/AppStore';
import { DialogStore } from '../stores/DialogStore';

describe('your-handlers', () => {
  let consoleSpy: ReturnType<typeof suppressConsole>;

  beforeEach(() => {
    resetStores(); // Reset all store signals
    setTestData(TestData.simple); // Load test data into stores
    consoleSpy = suppressConsole(); // Suppress console.error/warn
  });

  afterEach(() => {
    consoleSpy.errorSpy.mockRestore();
    consoleSpy.warnSpy.mockRestore();
  });

  it('does something', () => {
    // Your test
  });
});
```

**Available Test Data**:

| Factory              | Description                              |
| -------------------- | ---------------------------------------- |
| `TestData.simple`    | Basic name/age/city data (3 rows)        |
| `TestData.withNulls` | Data with null values for impute testing |
| `TestData.numeric`   | Numeric columns for aggregation testing  |
| `TestData.joinPair`  | Two related datasets for join testing    |

**Preview Assertions**:

```typescript
import { expectPreviewState, expectPreviewCleared } from './test-utils';

// Assert preview has specific values
expectPreviewState({
  title: 'Filter',
  columns: ['name', 'age'],
  rowCount: 2,
});

// Assert preview is cleared
expectPreviewCleared();
```

### 3.3 Core Logic Tests

Pattern for core transform tests:

```typescript
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { fromArrow } from 'arquero';

describe('yourTransform', () => {
  // Helper to create test data
  const createTestTable = () =>
    fromArrow({
      name: ['Alice', 'Bob', 'Carol'],
      age: [30, 25, 35],
    });

  it('transforms data correctly', () => {
    const table = createTestTable();
    const transform = { yourTransform: { param1: 'value' } };

    const result = applyTransform(table, transform, [
      { name: 'name', type: 'string' },
      { name: 'age', type: 'integer' },
    ]);

    expect(result.numRows()).toBe(3);
    expect(result.columnNames()).toContain('newColumn');
  });

  it('handles edge cases', () => {
    const table = createTestTable();
    const transform = { yourTransform: { param1: '' } };

    expect(() => applyTransform(table, transform, [])).toThrow('param1 is required');
  });
});
```

### 3.4 Component Tests

Pattern for dialog tests:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { YourDialog } from './YourDialog';
import { DialogStore } from '../stores/DialogStore';

describe('YourDialog', () => {
  beforeEach(() => {
    DialogStore.resetAll();
  });

  it('validates input on change', async () => {
    const { getByLabelText } = render(<YourDialog />);

    const input = getByLabelText('Parameter 1');
    fireEvent.input(input, { target: { value: 'test' } });

    expect(DialogStore.yourTransformState.error.value).toBeNull();
  });

  it('shows error for invalid input', async () => {
    const { getByLabelText } = render(<YourDialog />);

    const input = getByLabelText('Parameter 1');
    fireEvent.input(input, { target: { value: '' } });

    expect(DialogStore.yourTransformState.error.value).toBe('Parameter is required');
  });
});
```

### 3.5 Mocking Guidelines

When to mock:

| Scenario              | Mock?     | Approach                                  |
| --------------------- | --------- | ----------------------------------------- |
| External APIs (fetch) | Yes       | `vi.spyOn(global, 'fetch')`               |
| IndexedDB             | Yes       | Mock storage module                       |
| Arquero operations    | No        | Use real library                          |
| Signal stores         | Sometimes | Reset in `beforeEach`, mock for isolation |
| Date/time             | Yes       | `vi.useFakeTimers()`                      |

**Shared mock factories**: Handler tests must use `MockFactories` from `test-utils.ts` instead of inline mock definitions. This centralizes mock shapes so interface changes only need one update:

```typescript
vi.mock('../../services/StepService', async () =>
  (await import('../test-utils')).MockFactories.stepService()
);
```

Available factories: `stepService`, `stepServiceFull` (adds `applyStepResult`), `notificationHandlers`, `previewEngine`, `validationEngineExpression`, `validationEngineRegex`.

### 3.6 Idioms and Conventions

**Empty-but-schemad tables in tests.** `aq.from([])` builds a _schema-less_ table that throws on any column-referencing verb (`filter`, `orderby`, `groupby`, join keys). When a test needs an empty input that still has a schema, filter a single-row table down to zero:

```typescript
// ✗ Throws as soon as any transform references a column
const empty = (aq as any).from([]);

// ✓ Retains schema; safe for all transforms
const empty = (aq as any).from([{ id: 0, name: '' }]).filter(() => false);
```

**`CONTRACT:`, `FINDING:`, and `SURPRISE:` prefixes in test names.** Markers that distinguish _why_ a behaviour is being asserted, so the test grep'able from the codebase and the next reader knows whether to trust the assertion as gospel:

- `CONTRACT:` — deliberately decided behaviour, usually anchored to SOUL.md (e.g. null normalisation, all-null aggregate semantics). Don't change without a corresponding SOUL/spec update.
- `FINDING:` — suspected bug pinned until fixed. Flip the assertion once resolved.
- `SURPRISE:` — unintuitive-but-currently-acceptable behaviour worth surfacing (e.g. trailing garbage after datetime regex still matches). Rename to `CONTRACT:` once accepted, or fix and flip.

**Adversarial fixtures live in `src/__fixtures__/`.** Pure-data TS modules (BOM/CRLF CSV strings, extreme numerics, scientific notation, timezone variants, Unicode normalisation forms, mixed-type columns). Conventions: per-fixture imports (no barrel `index.ts`), homogeneous arrays unless the fixture is specifically about heterogeneity. Read `src/__fixtures__/README.md` before adding new ones — and re-use existing fixtures across `inferType`, parser, and composition tests rather than duplicating inline literals.

**Multi-step composition scenarios live in `src/core/composition.test.ts`.** That file is the home for "real pipeline" tests — type drift, lookup-then-aggregate, window-rank-then-trim, null propagation through chains. Single-transform unit tests can't catch composition drift; add to `composition.test.ts` rather than wedging multi-step assertions into per-transform files.

**Editor pipeline NFC-normalises file contents on save.** Source files containing visually identical but byte-distinct Unicode strings (e.g. NFC `café` vs NFD `café`) will have both literals collapsed to NFC by Prettier/the editor. `\uXXXX` escape sequences inside string literals get unescaped at write-time too. When a test genuinely needs distinct codepoint sequences, build them at runtime with `String.fromCharCode(0x...)` — see `src/__fixtures__/combining-marks.ts` for the canonical pattern.

---

## 4. Error Handling

### 4.1 Error Types

| Type              | Where Used      | User Visibility                 |
| ----------------- | --------------- | ------------------------------- |
| Validation errors | Dialog forms    | Inline red text                 |
| Expression errors | Filter/Derive   | Formatted with position pointer |
| Transform errors  | Step execution  | Toast notification              |
| Data errors       | Type conversion | Error cell in table             |

### 4.2 Validation Errors

For form validation in dialogs:

```typescript
// Store error in dialog state
DialogStore.filterState.error.value = 'Expression is required';

// Display in component
{state.error.value && (
  <div class={styles.error}>{state.error.value}</div>
)}
```

### 4.3 Expression Errors

For user-written expressions, use the error formatter:

```typescript
import { formatError } from '../core/error-formatter';

try {
  const ast = parseExpression(expression);
  validateAST(ast, schema);
} catch (e) {
  // formatError creates multi-line message with position pointer
  const formatted = formatError(e, expression);
  DialogStore.filterState.error.value = formatted;
}
```

### 4.4 Data Errors (Error Cells)

Type conversion failures and expression evaluation errors produce `ConversionError` objects that live in data cells (Power Query-style). See [DATA-SPECIFICATION.md §8](DATA-SPECIFICATION.md#8-error-objects) for the full specification.

**Key rules**:

- Always use `isConversionError()` from `src/core/type-converter.ts` to detect error values — never inline duck-type `v.type === 'error'`.
- **Never use `structuredClone` on `model.data`** — `ConversionError` objects have `toString()`/`valueOf()` methods which `structuredClone` cannot clone (throws `DataCloneError`). Use `cloneData()` from `type-converter.ts` when a data backup is needed (e.g., error recovery). Prefer recomputing from source + steps over cloning when creating new models.
- **`model.data` and `source.data` can be `null`** — with lazy loading, data is not fetched from IndexedDB until needed. Call `ensureModelData(model)` or `ensureSourceData(source)` before accessing `.data` for cloning, computation, or display. These functions are no-ops when data is already loaded.

**Error propagation in expressions**: Errors propagate through arithmetic, comparisons, and logical operators (like `null` propagation). `??` and `coalesce()` treat errors as missing. `is_error(value)` detects errors in user expressions.

---

## 5. Performance Patterns

### 5.1 Debouncing

Use the preview engine for debounced previews (see §1.6). For other operations:

```typescript
// Using preview engine (preferred for transform previews)
import { createDebouncedPreview } from './preview-engine';

const previewHandle = createDebouncedPreview({
  compute: () => computePreview(),
  debounceMs: 150, // Optional, defaults to 150ms
});

// Manual debouncing (for non-preview operations)
let timer: number | null = null;

export function debouncedAction() {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => {
    performAction();
  }, 150);
}
```

Standard debounce times:

- Expression validation: 150ms
- Preview updates: 150ms
- Search/filter UI: 200ms

### 5.2 Preview Row Limits

Limit preview data to avoid rendering large datasets:

```typescript
import { getPreviewRowLimit } from './helper-handlers';

const previewRows = result.objects().slice(0, getPreviewRowLimit());
// Default: 100 rows, configurable in UX settings
```

### 5.3 Metrics Collection

All timed operations flow through `metricsCollector` (`src/app/infrastructure/metrics/`). It handles console logging, IndexedDB persistence, and retention. Metrics are silenced in test mode (`IS_TEST` guard) — no console noise, no IndexedDB writes.

**For tabular operations** (transforms with input/output shape), use `record()` directly with shape data — see `StepService.computeModelUpToStep()` for the pattern.

**For non-tabular operations** (init, import, export, storage):

```typescript
// Use time() — wraps any sync/async function
const data = await metricsCollector.time('storage:load', () => loadFromDB());

// Or record manually when timing can't wrap the whole operation
const start = performance.now();
// ... work ...
metricsCollector.record({
  transformType: 'model:recompute',
  durationMs: performance.now() - start,
  success: true,
  metadata: { modelId: model.id },
});
```

**Operation naming convention**: `category:detail` — e.g., `export:csv`, `storage:save`, `duckdb:init:eh`, `model:recompute`, `app:init`, `import:file`. Transform steps use plain names (`filter`, `derive`, `pipeline`).

Metrics are stored in IndexedDB and viewable as a virtual dataset in the sidebar. Console logging icons: ⚡ <50ms, ✓ 50–200ms, ⏱️ 200–500ms, ⚠️ >500ms.

### 5.4 Step Result Cache (`StepResultCache.ts`)

`StepResultCache` stores one intermediate pipeline checkpoint to avoid replaying all steps from step 0 when a user edits a single step. The cache is keyed by model ID + a JSON fingerprint of the steps before the checkpoint.

**Invalidation rule**: Any code that mutates `model.steps`, replaces source data, or changes model context must call `invalidateForModel(modelId)` or `invalidate()`. Current invalidation points: `executeStepRemoval`, `undo`, `redo`, `switchToModel`, `AppStore.reset`, `ReplaceSourceService.replaceSource`. If you add a new code path that mutates steps outside `updateStep`/`applyStepResult`, add an invalidation call — a stale cache produces silently wrong results.

### 5.5 Pagination

Large tables are paginated in the UI:

```typescript
// AppStore signals
pageSize: signal(100),
currentPage: signal(0),
totalPages: computed(() => Math.ceil(rowCount / pageSize))

// Only render current page
const startIdx = currentPage * pageSize;
const pageData = allData.slice(startIdx, startIdx + pageSize);
```

---

## 6. Data Flow

### 6.1 Transform Execution Flow

```
User clicks Apply
    ↓
applyActiveTransform() → dialog registry applyHandler(cb)
    ↓
Handler (inline in dialog-registry.ts, or e.g. filter-handlers.applyFilterTransform)
    ↓
StepService.runTransform(label, transform, cb)
    ├─ cb.onTransformStart(label)          → AppStore.isTransforming = true
    ├─ transforms.applyTransform(table, transform, columns)
    ├─ StepService.applyStepResult(...)    → updates model + AppStore signals
    └─ cb.onTransformEnd()                 → AppStore.isTransforming = false
    ↓
UI re-renders via signal subscriptions
```

**Key signals**: `AppStore.isTransforming` (boolean, true during execution) and `AppStore.transformMessage` (label shown in StatusBar). Set/cleared by the `ExecutionCallbacks`.

**Callbacks**: `ExecutionCallbacks` (defined in `StepService.ts`) are built by `buildDefaultExecutionCallbacks()` in `src/app/infrastructure/executeTransform.ts`. It resolves defaults directly from AppStore, notification, dialog, pagination, and preview modules — no global callback registration.

**Which execution API to use:**

| Caller context                                              | API to call                                             |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| Inside a registry `applyHandler`                            | `StepService.runTransform(label, transform, cb)`        |
| Outside a dialog (EDA, quick actions, external triggers)    | `executeTransform(label, transform)`                    |
| Dispatching an `applyHandler` (only `applyActiveTransform`) | `config.applyHandler(buildDefaultExecutionCallbacks())` |

Do not reintroduce a global callback registry (`setTransformCallbacks`-style) — all paths must resolve synchronously via module imports.

### 6.2 Dialog Lifecycle

```
1. Open:    DialogStore.openDialog('filter')
2. Input:   User types → signal updates → validation runs
3. Preview: Debounced preview computation → previewData signal
4. Apply:   Handler builds transform → StepService executes
5. Close:   DialogStore.closeDialog('filter')
6. Reset:   DialogStore.resetAll() clears form state
```

### 6.3 Model Operations Flow

Model management operations (create, copy, fork, rename, delete) follow a different wiring pattern from transform dialogs. They are direct actions triggered from the Sidebar or toolbar — no dialog registry involved.

**File flow**: `ModelService` method → `AppController` orchestration → `Sidebar` prop → `App.tsx` wiring

**Adding a new model operation**:

1. **`ModelService.ts`** — Add a static method with the business logic (validation, data cloning, store update, persistence). Follow the `copyCurrentModel()` pattern for operations that create new models.
2. **`AppController.ts`** — Add an orchestration method that injects `NotificationHandlers` (prompt/alert/confirm) and `switchToModel` callback. Only needed when composing 2+ service/handler calls.
3. **`Sidebar.tsx`** — Add callback prop to `SidebarProps` interface and destructure it. Wire a button or menu item.
4. **`App.tsx`** — Wire the prop in `sidebarProps` to `AppController.methodName()`.
5. **i18n** — Add keys to both `en/common.json` and `uk/common.json` (prompts, notifications, button labels).

**ModelService vs StepService boundary**:

- `ModelService` — model lifecycle (create, copy, fork, rename, delete, switch). Owns the model list in AppStore.
- `StepService` — pipeline execution (compute steps, apply transforms, undo/redo). Owns step history and transform orchestration.
- Operations that both create models and compute pipelines (fork, copy) call `StepService.computeModelUpToStep()` from within `ModelService`.

### 6.4 Import Pipeline Flow

All import paths (file upload, drag-drop, paste, URL) converge on the same core flow. Understanding this pipeline is essential when modifying import behavior.

#### Entry Points → Shared Pipeline

```
File upload/drop  ──→  handleFileSelect() / handleFileDrop()  ──┐
Clipboard paste   ──→  handlePaste() / promptPaste()           ──┤
                                                                  ├──→  showImportDialog(file)
URL import        ──→  fetchAndImportFromUrl()                 ──┤
                       (fetches URL → creates synthetic File)    │
Text entry        ──→  confirmTextEntry()                      ──┘
                       (creates synthetic File from textarea)
```

All entry points create a `File` object and call `showImportDialog(file)` in `import-handlers.ts`.

#### Core Pipeline

```
showImportDialog(file)
    │
    ├── .json file?       →  FileReader  →  handleJsonPreview(file, data)
    │                                             │
    │                                             ├── Populates importCsvState signals:
    │                                             │   previewHeaders, previewDataRows,
    │                                             │   isJson, jsonData, suggestedJsonKeys, etc.
    │                                             │
    │                                             └── callbacks.openDialog('import-csv')
    │
    ├── .xls/.xlsx file?  →  handleExcelPreview(file)
    │                             │
    │                             ├── Lazy-loads SheetJS via dynamic import()
    │                             ├── Parses preview + full file → stores in excelData signal
    │                             ├── Populates importCsvState (isExcel, rawPreviewData, etc.)
    │                             └── callbacks.openDialog('import-csv')
    │
    └── .csv file?        →  handleCsvPreview(file)
                                  │
                                  ├── PapaParse preview (first N rows)
                                  ├── Populates importCsvState signals:
                                  │   rawPreviewData, delimiter, headerMode, etc.
                                  └── callbacks.openDialog('import-csv')
```

**Dialog reuse rule**: All formats share the `import-csv` dialog. Format-specific sections are toggled via flags (`isJson`, `isExcel`). Delimiter controls are hidden for Excel; JSON path controls are shown only for JSON. Header mode and preview table are shared by all formats.

#### Preview Mechanism

When the `import-csv` dialog opens, the preview panel in `App.tsx` renders because:

1. `hasPreviewData()` in `DialogCoordinator` checks `importCsvState.previewDataRows.value.length > 0`
2. Preview columns/rows come from `importCsvState.previewHeaders` and `previewDataRows`
3. When the user changes delimiter or header mode, `updateImportPreview()` (CSV only — re-parses with new delimiter) or `updateHeadersForPreview()` (JSON/Excel — no re-parse needed) updates these signals

For transform dialogs, preview data uses `DialogStore.previewState` signals instead (set by `preview-engine.ts`).

#### Transition Dialog Pattern

Some import paths use a **two-step dialog flow**: a simple entry dialog that transitions to `import-csv` for preview/configuration. This avoids duplicating parsing logic.

```
[Entry Dialog]  →  user provides input  →  Apply button
    │
    └── handler function (e.g., fetchAndImportFromUrl / confirmTextEntry)
            │
            ├── Convert input to a File object
            ├── Set flags on importCsvState (fromUrlImport / fromTextEntry)
            ├── Close entry dialog (without full state reset)
            └── showImportDialog(file)  →  opens import-csv with preview
```

**Key details:**

- Each entry dialog has its own state file (`import-url-state.ts`, `import-text-state.ts`)
- Flags like `fromUrlImport` / `fromTextEntry` on `importCsvState` enable a "Back to..." link in `ImportCsvDialog`
- The `backToUrlImport()` / `backToTextEntry()` functions save importCsvState text, close, restore, and reopen the entry dialog
- For edit flows, the entry dialog can set `isReplaceMode = true` on `importCsvState` to route through `ReplaceSourceService` instead of `createSource`

**To add a new transition dialog**, follow the URL/text pattern:

1. Create state file in `stores/dialogs/import/`
2. Create dialog component
3. Add handler that converts input → `File` → `showImportDialog(file)`
4. Add a `from*` flag to `importCsvState` and a `backTo*()` function
5. Wire the Apply button via `StepCallbacks` (see §7.1 "Non-Transform Dialogs")

#### Confirm and Source Creation

When the user clicks "Apply" in the `import-csv` dialog:

```
confirmImport()
    │
    ├── Validates source name
    ├── Processes data (flatten JSON, apply delimiter/headers)
    ├── Replace mode?  →  ReplaceSourceService.replaceSource()
    └── Normal mode?   →  callbacks.createSource()
                               │
                               └── ImportService.createSource()
                                       │
                                       ├── Creates Source object (id, name, columns, data)
                                       ├── Creates Model with initial steps (import + types)
                                       ├── Updates AppStore (sources, models, navigation)
                                       └── Auto-saves to IndexedDB
```

#### Key Files

| File                                         | Purpose                                                   |
| -------------------------------------------- | --------------------------------------------------------- |
| `handlers/import/import-handlers.ts`         | All import logic (entry points, preview, confirm)         |
| `stores/dialogs/import/import-csv-state.ts`  | Signal state for the CSV import dialog                    |
| `stores/dialogs/import/import-url-state.ts`  | Signal state for the URL import dialog                    |
| `stores/dialogs/import/import-text-state.ts` | Signal state for the text entry dialog                    |
| `components/ImportCsvDialog.tsx`             | Import settings UI (delimiter, headers, JSON path)        |
| `components/ImportUrlDialog.tsx`             | URL input and sample dataset list (with metadata)         |
| `public/datasets/`                           | Bundled sample datasets (served as static assets)         |
| `components/ImportTextDialog.tsx`            | Textarea for manual data entry                            |
| `services/ImportService.ts`                  | Source and model creation                                 |
| `orchestration/DialogCoordinator.ts`         | Preview data routing (`hasPreviewData`, `getPreviewRows`) |
| `core/excel-parser.ts`                       | SheetJS wrapper (lazy-loaded via dynamic `import()`)      |

#### Lazy-Loading for Heavy Parsers

Large parser libraries should be loaded on demand via dynamic `import()` so they don't bloat the initial bundle. Excel import demonstrates the pattern:

1. Parser wrapper lives in `src/core/` (portable, testable — no browser APIs)
2. Handler calls `await import('../../../core/excel-parser')` only when an Excel file is selected
3. `vite.config.ts` has a `manualChunks` entry to split the library into its own bundle chunk
4. Full parsed data is stored in a signal (e.g., `excelData`) to avoid re-loading the library on confirm

Apply the same pattern for any new dependency >50KB gzip that's only used for a specific import/export path.

#### Adding a New Import Format

Follow this checklist (Excel is the reference implementation):

1. **Parser wrapper** (`src/core/<format>-parser.ts`) — thin async wrapper over the library, returns `unknown[][]` (2D array matching PapaParse output shape)
2. **State signals** (`import-csv-state.ts`) — add `is<Format>` flag + any format-specific data signal; reset in `resetImportCsvState()`
3. **File detection** (`import-handlers.ts`) — update `handleFileDrop()`, `handlePaste()`, and `showImportDialog()` to accept new extensions/MIME types
4. **Preview function** (`import-handlers.ts`) — new `handle<Format>Preview()` that lazy-loads the parser, populates `importCsvState`, and opens the dialog
5. **Confirm branch** (`import-handlers.ts`) — add format branch in `confirmImport()` before CSV fallback; reuse `mapRawDataToRows()` + `finishImport()`
6. **Dialog UI** (`ImportCsvDialog.tsx`) — hide/show format-specific controls via the `is<Format>` flag
7. **Dialog title** (`dialog-registry.ts`) — add `is<Format>` case in `getDialogTitle()`
8. **Bundle splitting** (`vite.config.ts`) — add `manualChunks` entry for the new library
9. **i18n** — title key in `dialogs.json`, error key in `errors.json`, update `dropFile` message (en + uk)
10. **File accept** (`App.tsx`) — add extensions to the file input `accept` attribute

---

## 7. Expression Engine

### 7.1 Three-Stage Pipeline

User expressions go through three stages for security:

```
"sales > 1000"
    ↓
┌─────────────────────────────────────────────┐
│ Stage 1: PARSING (expression-parser.ts)     │
│ - jsep converts string to AST               │
│ - Bracket notation [Column] → identifier    │
│ - Custom operators (nullish coalescing ??)  │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Stage 2: VALIDATION (ast-validator.ts)      │
│ - Whitelist check (allowed node types)      │
│ - Operator whitelist (no assignment, etc.)  │
│ - Function whitelist (64 safe functions)    │
│ - Schema validation (column exists?)        │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Stage 3: INTERPRETATION (ast-interpreter.ts)│
│ - Safe recursive evaluation                 │
│ - No eval(), no Function()                  │
│ - Null propagation in arithmetic            │
│ - Function implementations                  │
└─────────────────────────────────────────────┘
    ↓
Result (boolean for filter, value for derive)
```

### 7.1 Adding a New Dialog

Syto uses a centralized dialog registry ([`dialog-registry.ts`](../src/app/dialog-registry.ts)) to avoid scattered updates.

**Checklist** (typically 6-8 files):

1. **[`dialog-registry.ts`](../src/app/dialog-registry.ts)** - Add metadata entry (name, title, type, buttonText)
2. **[`types.ts`](../src/app/types.ts)** - Add to `DialogName` union
3. **[`*Dialog.tsx`](../src/app/components/)** - Create component
4. **[`index.ts`](../src/app/components/index.ts)** - Export component
5. **[`App.tsx`](../src/app/components/App.tsx)** - Render dialog
6. **[`DialogStore.ts`](../src/app/stores/DialogStore.ts)** - Add state (if needed)
7. **[`dialog-handlers.ts`](../src/app/handlers/dialog/dialog-handlers.ts)** - Add init logic (if needed)
8. **Wire up Apply button** (if transform dialog) - see below

The registry eliminates the need to update `isSlidePanel()`, `getDialogTitle()`, etc. - these are auto-generated from metadata.

**Centered-modal dialogs with custom buttons**: If the dialog manages its own action buttons (e.g., `workflow-import`, `download`), add its name to the footer exclusion list in `App.tsx` so the generic Apply/Cancel footer is suppressed. Also add the i18n key mapping in `dialog-registry.ts` `getDialogTitle()`.

#### Step 8: Wiring Transform Apply Button

For transform dialogs, register the `applyHandler` directly in the dialog registry. This requires updates in **2 files**:

| File                                       | What to Add                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `src/app/handlers/transform/*-handlers.ts` | `applyYourTransform(callbacks)` function          |
| `src/app/dialog-registry.ts`               | Add `applyHandler` to the dialog's registry entry |

The `applyActiveTransform()` function in `step-handlers.ts` automatically looks up the handler from the registry — no switch case, AppController method, or test-utils mock needed.

**Example:**

```typescript
// 1. Handler (src/app/handlers/transform/your-handlers.ts)
export async function applyYourTransform(callbacks: ExecutionCallbacks) {
  const transform = constructYourStep();
  await StepService.runTransform('Your Transform', transform, callbacks);
}

// 2. Registry entry (src/app/dialog-registry.ts)
yourDialog: {
  name: 'yourDialog',
  title: 'Your Transform',
  type: 'slide-panel',
  applyHandler: (cb) => YourHandlers.applyYourTransform(cb),
},
```

**Notification API**: All user-facing notifications are in `src/app/handlers/core/notification-handlers.ts`. Import directly — no `app` parameter needed:

- `showSuccess(message)` — auto-dismissing toast (3s)
- `showError(title, message)` — persistent error toast with optional step context
- `alert(message)` — blocking modal alert (returns Promise)
- `confirm(message, options?)` — blocking confirmation with optional `confirmLabel`
- `prompt(message, defaultValue?)` — blocking text input

**Error tooltips on Apply button**: If the dialog has an `.error` signal, add `getError: () => DialogStore.yourState.error.value` to the registry entry. This surfaces the error message as a tooltip on the disabled Apply button. The Apply button uses `aria-disabled` (not native `disabled`) so tooltips remain visible — `buttons.css` styles both identically.

#### Non-Transform Dialogs (Import/Utility)

Import dialogs (e.g., `import-url`, `import-text`) don't use `applyHandler` in the registry because they don't execute transforms — they transition to `import-csv` or perform custom logic. These use the **StepCallbacks** pattern instead:

| File                                       | What to Add                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `src/app/handlers/import/*-handlers.ts`    | Handler function (e.g., `confirmTextEntry()`)  |
| `src/app/handlers/core/step-handlers.ts`   | Add to `StepCallbacks` interface + switch case |
| `src/app/handlers/test-utils.ts`           | Add mock to `createMockStepCallbacks()`        |
| `src/app/orchestration/AppOrchestrator.ts` | Wire callback in `wireHandlerCallbacks()`      |

The switch case in `applyActiveTransform()` dispatches to the callback:

```typescript
// In step-handlers.ts
case 'import-text': callbacks?.confirmTextEntry(); return;
```

**When to use which pattern:**

- **Registry `applyHandler`**: Dialog produces a `TransformStep` (filter, derive, sort, etc.)
- **StepCallbacks switch case**: Dialog has custom apply logic (import transitions, multi-step flows)

#### Immediate-Apply vs Deferred-Apply Dialogs

Dialogs fall into two categories for change detection:

- **Deferred-apply** (most transform dialogs): User configures options, then clicks "Apply". Include `getState` in the registry so that closing without applying triggers the "unsaved changes" confirmation.
- **Immediate-apply** (e.g., settings): Changes take effect instantly via callbacks (persisted to localStorage, UI updated). **Omit `getState`** from the registry — there are no "unsaved changes" to discard, so the confirmation dialog should never appear.

### 7.2 Adding a New Function

> **Full details**: See [FUNCTION-DOCS-SYSTEM.md](FUNCTION-DOCS-SYSTEM.md) for the complete documentation pipeline.

To add a whitelisted function:

1. **Implement** in the appropriate category file (`src/core/functions/<category>-functions.ts`) with JSDoc:

```typescript
/**
 * @category [Date|Text|Math|Regex|Conversion|JSON]
 * @description Brief description of what the function does
 * @param paramName - Parameter description
 * @returns Return value description
 * @example your_function(arg1)
 * @example your_function("value") → result
 */
export const your_function = (arg1: any, arg2?: any) => {
  // Implementation
};
```

2. **Export** from `src/core/functions/index.ts` (ensure included in `FUNCTION_IMPLS`)

3. **Add to whitelist** in `ast-validator.ts` (both `ALLOWED_FUNCTIONS` and `FUNCTION_ARITY`):

```typescript
const ALLOWED_FUNCTIONS = [
  // ... existing functions
  'your_function',
];

const FUNCTION_ARITY: Record<string, [number, number]> = {
  // [min, max] arguments
  your_function: [1, 2],
};
```

4. **Regenerate documentation**: `npm run docs:generate`

5. **Verify**: `npm test -- function-docs-validation.test.ts`

6. Update `DATA-SPECIFICATION.md` §4.3 if adding a new category or significant function group.

### 7.3 Extending the Expression Language (New Syntax / AST Node)

For new **syntax** (a new AST node type, keyword, or operator — not just a function), updates span five files. Miss one and either the runtime or the editor UX breaks silently.

| File                                     | Role                                 | What to Add                                                                                                                            |
| ---------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/expression-parser.ts`          | Preprocess + jsep → AST              | jsep plugin (`hooks.add('gobble-token', …)`) or `addBinaryOp`/`addUnaryOp`. If the node stores bare names, extend `restoreColumnNames` |
| `src/core/ast-validator.ts`              | Whitelist + scope + arity            | Add the type to `ALLOWED_NODE_TYPES`; validate children; pass an extended schema array down if the node introduces locals              |
| `src/core/ast-interpreter.ts`            | Evaluate AST against row data        | Add a `case` in `evaluateNode`. If the node introduces locals, build a new scope object — do not mutate `rowData`                      |
| `src/core/expression-token-extractor.ts` | AST walk for editor chip/column list | Add a `case` so columns aren't double-counted and locals aren't reported as columns                                                    |
| `src/core/expression-language.ts`        | CodeMirror tokenizer + autocomplete  | Add keywords to `KEYWORDS`/`OPERATOR_KEYWORDS` + a `KEYWORD_COMPLETIONS` entry                                                         |

**Invariants to preserve:**

- **Error pass-through in local scopes.** `CallExpression` and `LetExpression` deliberately do **not** short-circuit on `ConversionError`; the error flows into the function arg / binding so `is_error(x)`, `coalesce(x, …)`, and `x ?? fallback` can observe it. Short-circuiting is correct only for binary/logical/conditional/unary nodes (see `ast-interpreter.ts` — it is load-bearing, not an accident). Any new scope-introducing node should follow the pass-through rule.
- **Reserved bare identifiers.** Word-form keywords (`and`, `or`, `not`, `let`, `in`) are not available as bare column references; users must bracket such column names. See DATA-SPECIFICATION.md §4.2b.
- **Bracket placeholder restoration.** The parser replaces `[Col Name]` with a short placeholder before calling jsep, then restores names by walking the AST. Any new node that stores identifier **strings** (rather than nested `Identifier` nodes) must be covered explicitly in `restoreColumnNames`, or users writing `[X]` in that position will see the placeholder leak through.

---

## 8. Refactoring & Refinement Patterns

### 8.1 UI Logic Consolidation

When two operations share >80% of UI needs (e.g., _Concat_ vs. _Union_ or _Join_ variants), prefer a **Unified Dialog** (like `AppendDialog`) over separate components.

- **Toggle for Variant**: Use a simple checkbox or radio to switch between specific transform keys (e.g., `{concat: ...}` vs `{union: ...}`).
- **Parity through Patterns**: If a more complex operation (Join) already has a high-quality selector, reuse its UI components (`JoinTreeSelector`) and handler logic to bring simpler operations to parity.

### 8.2 Safe Graph State Mutations

For any transform that creates a reference from one model/source to another (Append, Join, Lookup):

- **DFS Cycle Detection**: Always run a check using `DependencyService.checkCircularDependency` at the handler level _before_ applying the transform.
- **Compute Order**: Ensure that for previews, the target table is fully computed up to its current last step using `StepService.computeModelUpToStep`.

### 8.3 Deterministic Type Promotion

When "stacking" or "merging" data from two different tables, follow the **Common Denominator Pattern**:

1.  Compare types for same-named columns.
2.  Use a centralized promotion utility (see `SchemaEngine.getPromotedType`).
3.  Standardize on: `integer` + `float` → `float`, `date` + `datetime` → `datetime`, otherwise → `string`.

### 8.4 Selection-Source Synchronization

When a dialog depends on a source that the user can change:

- **Automatic Refresh**: Implement an `onTargetChange` handler that resets/extracts columns from the new target and updates selection signals immediately.
- **Selection Persistence**: If the new source shares some columns with the old one, consider preserving matching selections; otherwise, default to "Select All" for discoverability.

### 8.5 Registry & Test Awareness

When adding or removing dialog names from the `DialogName` union:

- **Registry Check**: Verify [`dialog-registry.ts`](../src/app/dialog-registry.ts) matches the new types.
- **Completeness Tests**: Update [`dialog-registry.test.ts`](../src/app/dialog-registry.test.ts) to ensure automated tests don't break on "undefined" config lookups.

### 8.6 Known Repetitive Patterns (Tech Debt)

> **Full analysis**: See git history (original `CODE-REDUCTION-ANALYSIS.md`)

Several patterns that were reasonable at small scale have become burdensome. Follow these rules to avoid making them worse while they await refactoring:

**Shortcut handlers** (`shortcut-handlers.ts` → `AppController.ts` → `RibbonToolbar.tsx`): ✅ **Refactored**

- All shortcuts are now declarative entries in `SHORTCUT_REGISTRY` (`shortcut-handlers.ts`). AppController exposes a single `executeShortcut(id)` method. RibbonToolbar renders popovers data-driven via `renderShortcutSections()`.
- **To add a new shortcut**: Add one entry to `SHORTCUT_REGISTRY`, add i18n keys in both locale files. No other files need changes.

**`deriveNextSchema()` in `schema-engine.ts`**: ✅ **Refactored**

- Shared `inferSchemaFromSample()` helper handles the "iterate sample data columns, preserve known types, infer new" pattern. Used by selectPattern, removePattern, join, lookup, concat/union.
- **To add a new sample-data-based branch**: Call `this.inferSchemaFromSample(currentSchema, sampleData, options)` — see §1.4.

**Transform linter** (`src/app/linters/transform-linter.ts`): ✅ **Refactored**

- Shared `validateStepExpressions()` generator validates filter/derive/conditional expressions in one place, consumed by `lintTransformJson`, `validateSteps`, and `getTransformJsonError`.
- **To add a new expression-bearing transform**: Add its validation to the generator, not to each consumer.

**AppController pass-throughs**: ✅ **Refactored**

- All pure pass-throughs removed. AppController now contains only orchestration methods that compose multiple handler/service calls or inject callbacks.
- **Rule**: Import handler functions directly at the call site. Only add methods to AppController when they genuinely compose logic from multiple modules (e.g., `switchToModel` coordinates `ModelService`, `InteractionHandlers`, `PaginationHandlers`, and URL state).

### 8.7 Accessibility Checklist

When adding a new component, verify these conventions (details in [UX-SPECIFICATION.md §9](UX-SPECIFICATION.md#9-accessibility-patterns)):

- **Dialogs**: `role="dialog"` or `"alertdialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title `id`
- **Close buttons**: `aria-label` with i18n key `buttons.close`
- **Iconify spans**: `aria-hidden="true"` on every `<span class="iconify">`
- **Icon-only buttons**: `aria-label` matching the `title` prop
- **Live regions**: Use `role="log"` / `role="status"` with `aria-live="polite"` for dynamic feedback areas

### 8.8 CSS Modules & DOM Queries

CSS Module class names are hashed at build time (dev: `Component__className___hash`, prod: hash-only). Never use CSS class selectors in `event.target.closest()`, `document.querySelector()`, or similar DOM queries from JavaScript — they won't match the hashed classes. Use **data attributes** (e.g., `[data-row-gutter]`, `[data-eda-panel="true"]`) for any element that needs to be found by event handlers or imperative DOM logic.

### 8.9 CSS Token Discipline

All visual properties that participate in theming or appear in multiple files must use tokens from `variables.css`:

- **Always token**: colors, box-shadow, z-index ≥1000, font-size, border-radius, icon dimensions (`.iconify` width/height)
- **Hardcoded OK**: local z-index (1–101 for sibling stacking), one-off layout dimensions (widths, heights, padding that aren't icon/spacing tiers), form control sizes that aren't icons
- **Never hardcode**: hex colors or `rgba(r,g,b,a)` with literal RGB — use `var(--color-*)` or `rgba(var(--*-rgb), opacity)` patterns so themes apply correctly

When adding a new color, check `variables.css` for an existing semantic token before creating one. Prefer reusing `--color-cyan`, `--color-dark-gray`, etc. over adding single-use tokens.

For button-specific tokens (`--btn-hover-bg`, `--btn-disabled-opacity`, etc.) and variant conventions, see [UX-SPECIFICATION.md §5.5](UX-SPECIFICATION.md).

### 8.10 Spacing Around Global Classes in CSS Modules

`.iconify` is a global class, so `.menuItem .iconify { margin-right: 12px }` in a CSS Module won't match — `.menuItem` gets hashed but `.iconify` stays literal, breaking the compound selector. Options:

- **Prefer `gap`**: Use `gap` on the flex parent instead of margins on children. Works regardless of child class origin and avoids the global-vs-module mismatch entirely.
- **`:global()` escape hatch**: If you must target `.iconify` specifically (e.g. for sizing or color), use `:global(.iconify) { ... }` nested inside the module class. `FloatingToolbar.module.css` uses this pattern for icon sizing.

---

## 9. Internationalization (i18n)

See **[I18N-GUIDE.md](I18N-GUIDE.md)** for the complete reference (adding languages, namespaces, plural rules, technical details).

**Quick reference** for everyday development:

- Use `useTranslation('namespace')` — namespaces: `common` (shared UI), `ui` (components), `dialogs` (transform dialogs), `settings`, `errors`
- Multiple namespaces: `useTranslation(['dialogs', 'common'])`, use `{ ns: 'common' }` for non-default
- Keys must exist in both `en` and `uk` locale files. Run `npm run i18n:check` to validate parity.
- Never use `dangerouslySetInnerHTML` with user-interpolated translation variables — split into JSX instead (see I18N-GUIDE.md § Common Patterns).
- Ukrainian has 3 plural forms — use `count` parameter; i18next handles form selection automatically.

---

## 10. Adding a Tool Page

Tool pages are standalone Preact mini-apps (e.g., JSON-to-CSV converter) served at `/tools/<name>/`. They share the site header/footer via `styles/content.css` but are fully independent of the main app — no AppStore, no DialogStore.

### 10.1 Key Constraints

- **Self-contained state**: Each tool uses its own signals in `src/tools/<name>/state.ts`. Never import from `app/stores/`.
- **Pure logic in `src/core/`**: Reusable data utilities go in `src/core/` with co-located tests, following the existing portability rule (no browser APIs, no Preact).
- **`tools` i18n namespace**: All user-facing strings go in `src/i18n/locales/{en,uk}/tools.json` under a tool-specific key (e.g., `jsonToCsv`). Components use `useTranslation('tools')`.
- **HTML is not templated**: Unlike content pages, each tool has a hand-crafted HTML file with its own SEO meta, structured data, and mount point. The site header/nav is duplicated (not generated from a template).

### 10.2 Checklist

**Files to create:**

| #   | Path                                 | Purpose                                                                                                              |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `tools/<name>/index.html`            | HTML shell: SEO meta, site header/nav, `<div id="tool-root">`, static SEO content, script tag pointing to `main.tsx` |
| 2   | `src/tools/<name>/main.tsx`          | Entry point: imports i18n, wraps root component in `<I18nextProvider>`, renders into `#tool-root`                    |
| 3   | `src/tools/<name>/<Name>App.tsx`     | Root component                                                                                                       |
| 4   | `src/tools/<name>/state.ts`          | Signal-based state (self-contained)                                                                                  |
| 5   | `src/tools/<name>/<Name>.module.css` | Tool-specific styles                                                                                                 |
| 6   | `src/tools/<name>/components/*.tsx`  | Sub-components                                                                                                       |
| 7   | `src/core/<utility>.ts` + `.test.ts` | Pure logic (if needed)                                                                                               |

**Files to update:**

| #   | File                             | Change                                                                                                                          |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 8   | `src/i18n/locales/en/tools.json` | Add tool-specific key with nested sections                                                                                      |
| 9   | `src/i18n/locales/uk/tools.json` | Matching Ukrainian translations                                                                                                 |
| 10  | `vite.config.ts`                 | Add Rollup input: `'<name>': resolve(__dirname, 'tools/<name>/index.html')`                                                     |
| 11  | Navigation links                 | Update nav in `index.html`, tool HTML files, and `{{tools-href}}` in content page build scripts if a tools index page is needed |

**No changes needed in**: `src/i18n/core.ts` (the `tools` namespace is already registered — just add keys to the JSON files), `scripts/content-pages-config.ts` (only for content pages).

### 10.3 Styling

Tool pages load `styles/content.css` for the shared site chrome (header, footer, layout). Tool-specific UI uses a CSS Module. Components from the main app (e.g., `DataTable.module.css`) can be imported if reuse is appropriate — note that imports from `src/tools/<name>/components/` to `src/app/components/` require three levels up (`../../../app/components/`), not two.

The `content.css` file includes a `.tool-page` section with layout rules for tool pages.

### 10.4 Adding a Reference Chapter (In-App Dialog + Public Docs Site)

Reference content lives under `src/content/` as plain markdown and is rendered in **two places** from the same source: the in-app `FunctionReferenceDialog` and the static public site at `/docs/<slug>/`. A new chapter requires changes in four directories:

| #   | File                                             | Purpose                                                                                       |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | `src/content/<section>/<chapter>.md`             | English content                                                                               |
| 2   | `src/content/uk/<section>/<chapter>.md`          | Ukrainian translation (required — the sidebar lookup falls back to EN)                        |
| 3   | `src/app/components/FunctionReferenceDialog.tsx` | Import both `{ html }` modules, add to `contentByLocale`, insert into `sidebarGroups`         |
| 4   | `src/i18n/locales/{en,uk}/dialogs.json`          | `referencePage.sidebar.<id>` labels (EN + UK)                                                 |
| 5   | `scripts/content-pages-config.ts`                | Append to `pages`, add entry to `ukPageMeta`, insert into `sidebarGroups` + `ukSidebarLabels` |

The chapter **id** (e.g., `let-bindings`) is the single key that ties all five files together. Pick it deliberately — it becomes the URL slug (`/docs/<id>/`), the sidebar id, and the i18n translation key.

**External sidebar entries** (e.g., "What's New" → GitHub Releases): use `SidebarItem.external: true` with an absolute URL in `content-pages-config.ts`, and the `kind: 'external'` variant in `FunctionReferenceDialog.tsx`. Only the sidebar label and i18n key are required — skip files 1, 2, and the `pages` / `ukPageMeta` entries. External entries open in a new tab with a ↗ indicator.

---

## 11. Versioning & Release

### Version injection flow

`package.json` `version` → `vite.config.ts` `define` → `__APP_VERSION__` global → consumed at runtime by `ExportService` (workflow JSON `sytoVersion`), `AppHeader` (alpha badge), `SettingsDialog` (footer).

### Scheme

Simplified semver during pre-1.0: **minor** = features/behavior changes, **patch** = fixes/polish. Every deploy gets a version bump. Workflow `formatVersion` is independent — only bump it when the workflow schema changes.

### Process

Use the `/release` skill to walk through: changelog update, `package.json` bump, git tag suggestion. The `/alignment` skill reminds about version bumps when reviewing user-visible changes.

### Changelogs

Two changelogs serve different audiences:

- **`docs/CHANGELOG.md`** — internal dev log, implementation-oriented, every change. Updated during `/release`.
- **GitHub Releases** — user-facing release notes per tag. Written for users of the tool, not maintainers.

The "What's New" entry in the docs sidebar and in-app Reference dialog links directly to GitHub Releases — there is no Syto-hosted "What's New" page to maintain.

### PWA & Updates

Updates are **manual** — the user clicks an "Update" button in the header when a new version is detected. This is intentional: auto-update can disrupt in-progress work. Config: `vite-plugin-pwa` with `registerType: 'prompt'` in `vite.config.ts`; client-side logic in `src/app/infrastructure/pwa.ts`; UI in `AppHeader`.

**Testing PWA updates** requires production builds (service workers don't run in dev mode): build → serve `dist/` with a static server → open in browser → rebuild with a change → refresh the tab to trigger the update prompt.

---

## 12. DuckDB-WASM Experimental Engine

Syto supports an opt-in DuckDB-WASM engine alongside Arquero. When enabled in Settings → Experimental, supported transforms and EDA stats run via SQL in a Web Worker instead of the main-thread Arquero path. Unsupported transforms silently fall back to Arquero.

### Architecture

```
UXSettings.experimental.engine ('arquero' | 'duckdb')
    ↓
StepService.tryDuckDB()         — checks setting + translator registry
    ↓
duckdb-transforms.ts            — pure functions: TransformStep → SQL string
    ↓
DuckDBService.execute()         — registers data as JSON, runs SQL, returns plain objects
    ↓
applyStepResult()               — same path as Arquero (createFromData branch)
```

EDA panel: `eda-compute.ts` dispatches to `DuckDBEdaEngine` (numeric stats via `QUANTILE_CONT`/`STDDEV_POP`, categorical via `GROUP BY`) or falls back to the JS `EDAEngine`.

### Key constraints

- **WASM + Worker must be self-hosted** — cross-origin Workers are blocked by same-origin policy. Use Vite `?url` imports (`import wasmUrl from '...duckdb-eh.wasm?url'`), never CDN URLs for Worker scripts.
- **Lazy-loaded** — `DuckDBService` dynamically imports `@duckdb/duckdb-wasm` on first use. The ~3.5 MB WASM binary is isolated in its own chunk via `manualChunks` in `vite.config.ts`.
- **Async-only** — DuckDB runs in a Worker, so all operations return Promises. `computeModelUpToStep()` (sync) remains Arquero-only; only `runTransform()` and EDA use DuckDB.
- **Dev-only logging** — all `[DuckDB]` console messages are gated behind `import.meta.env.DEV`.

### Adding a new DuckDB-supported transform

1. Write a translator function in `duckdb-transforms.ts`: `(transform, columns) → SQL string` referencing table `input`
2. Register it in the `DUCKDB_TRANSLATORS` map
3. Add unit tests for the SQL generation (no WASM needed)

---

**End of Development Patterns**
