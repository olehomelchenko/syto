# Syto — Internationalization (i18n) Guide

> **Related**: [DEVELOPMENT-PATTERNS.md](DEVELOPMENT-PATTERNS.md) §9 for quick reference

Syto uses **i18next** with **preact-i18next** for multi-language support. The system provides type-safe translations with automatic re-rendering on language changes.

---

## Architecture Overview

**Core Components**:

- **i18n Configuration**: `src/i18n/index.ts` — initialization, type augmentation, language settings
- **Translation Files**: `src/i18n/locales/{lang}/{namespace}.json` — translation key-value pairs
- **Provider**: `<I18nextProvider>` in `src/main.tsx` — enables reactive language switching
- **Storage**: User preference persisted via `UXSettings` in localStorage

**Supported Languages**:

- English (`en`) — default
- Ukrainian (`uk`) — with automatic 3-form plural handling

**Namespaces** (6 files per language):

| Namespace  | Purpose                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| `common`   | Shared UI chrome: buttons, labels, tooltips, sidebar text, notifications, prompts, confirms                  |
| `ui`       | Component-specific text: ribbon, pagination, toolbars, empty state, EDA, type menu, dataset/model info views |
| `dialogs`  | Transform dialog content: titles, field labels, placeholders, validation messages, help text                 |
| `settings` | Settings dialog strings                                                                                      |
| `errors`   | Error messages (parsing, validation, runtime)                                                                |
| `tools`    | Standalone tool pages: each tool gets a top-level key (e.g., `jsonToCsv`) to avoid collisions                |

**Rule of thumb**: If the text appears in a dialog's form fields, use `dialogs`. If it's in a toolbar, view, or panel, use `ui`. If it's a button/label reused across multiple places, use `common`.

---

## Adding Translations to a Component

**Step 1**: Import the hook and specify the namespace:

```typescript
import { useTranslation } from 'preact-i18next';

export function MyComponent() {
  const { t } = useTranslation('common'); // or 'settings', 'dialogs'

  return <button>{t('buttons.apply')}</button>;
}
```

**Multiple namespaces**: When a component needs keys from more than one namespace, pass an array. The first namespace is the default; use the `ns` option to reference others:

```typescript
const { t } = useTranslation(['dialogs', 'common']);

// Default namespace (dialogs):
t('importCsv.sourceNameLabel');

// Explicit namespace override:
t('buttons.backToDatasets', { ns: 'common' });
```

The test mock in `test-setup.ts` supports array namespaces and the `ns` option automatically.

**Step 2**: Add keys to translation files:

```json
// src/i18n/locales/en/common.json
{
  "buttons": {
    "apply": "Apply"
  }
}

// src/i18n/locales/uk/common.json
{
  "buttons": {
    "apply": "Застосувати"
  }
}
```

**TypeScript Support**: Translation keys are type-checked. Invalid keys will show TypeScript errors.

---

## Translation File Structure

**Naming Convention**: Use nested objects to group related strings:

```json
{
  "buttons": { "save": "...", "cancel": "..." },
  "labels": { "name": "...", "type": "..." },
  "tooltips": { "help": "..." }
}
```

**Key Paths**: Reference with dot notation: `t('buttons.save')`, `t('labels.name')`

**Keep Files Parallel**: All translation files must have matching structure across languages.

---

## Ukrainian Plural Forms

Ukrainian has **3 plural forms** (vs. English's 2):

- **Form 0**: Ends with 1 (not 11): `1 рядок`, `21 рядок`
- **Form 1**: Ends with 2-4 (not 12-14): `2 рядки`, `23 рядки`
- **Form 2**: All others: `0 рядків`, `5 рядків`, `11 рядків`

**Implementation**: i18next handles this automatically. Use `count` parameter:

```typescript
// Translation files:
// en: { "rows": "{{count}} row", "rows_other": "{{count}} rows" }
// uk: {
//   "rows_0": "{{count}} рядок",
//   "rows_1": "{{count}} рядки",
//   "rows_2": "{{count}} рядків"
// }

const { t } = useTranslation('common');
t('rows', { count: 1 }); // "1 row" / "1 рядок"
t('rows', { count: 5 }); // "5 rows" / "5 рядків"
t('rows', { count: 23 }); // "23 rows" / "23 рядки"
```

**Reference**: See `src/i18n/index.ts` lines 21-35 for full plural rules documentation.

---

## Adding a New Language

**Step 1**: Create translation files:

```bash
mkdir -p src/i18n/locales/fr
cp src/i18n/locales/en/*.json src/i18n/locales/fr/
# Translate content
```

**Step 2**: Update `src/i18n/index.ts`:

```typescript
// Add imports
import frCommon from './locales/fr/common.json';
import frSettings from './locales/fr/settings.json';
import frDialogs from './locales/fr/dialogs.json';

// Add to SUPPORTED_LANGUAGES
export const SUPPORTED_LANGUAGES = ['en', 'uk', 'fr'] as const;

// Add to LANGUAGE_NAMES
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  uk: 'Українська',
  fr: 'Français',
};

// Add to resources
i18n.use(initReactI18next).init({
  resources: {
    en: {
      /* ... */
    },
    uk: {
      /* ... */
    },
    fr: {
      common: frCommon,
      settings: frSettings,
      dialogs: frDialogs,
    },
  },
  // ...
});
```

**Step 3**: Update `src/app/infrastructure/ux-settings.ts`:

```typescript
export interface UXSettings {
  // ...
  language: 'en' | 'uk' | 'fr';
}
```

**Step 4**: Add language selector UI in `SettingsDialog.tsx`.

---

## Adding a New Namespace

**Step 1**: Create translation files:

```bash
# For each language:
echo '{}' > src/i18n/locales/en/errors.json
echo '{}' > src/i18n/locales/uk/errors.json
```

**Step 2**: Update `src/i18n/index.ts`:

```typescript
// Add imports
import enErrors from './locales/en/errors.json';
import ukErrors from './locales/uk/errors.json';

// Add to type augmentation
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      settings: typeof enSettings;
      dialogs: typeof enDialogs;
      errors: typeof enErrors; // Add this
    };
  }
}

// Add to resources and namespace list
i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, settings: enSettings, dialogs: enDialogs, errors: enErrors },
    uk: { common: ukCommon, settings: ukSettings, dialogs: ukDialogs, errors: ukErrors },
  },
  ns: ['common', 'settings', 'dialogs', 'errors'], // Add to list
  // ...
});
```

**Step 3**: Use in components:

```typescript
const { t } = useTranslation('errors');
```

---

## Technical Implementation Details

**Initialization Flow**:

1. `src/i18n/index.ts` loads user's language from localStorage **before** `i18n.init()`
2. i18next initializes with correct language (no race condition)
3. `src/main.tsx` wraps `<App>` with `<I18nextProvider>`
4. Components using `useTranslation()` subscribe to language changes

**Language Switching**:

1. User clicks language in Settings dialog
2. `AppController.switchLanguage(lang)` called
3. Updates: i18n, AppStore, localStorage
4. `I18nextProvider` triggers re-render of all components using `useTranslation()`

**Type Safety**:

- Translation keys are validated at compile time
- Namespace names are type-checked
- Typos in `t('invalid.key')` produce TypeScript errors
- **Do not wrap `i18n.t()` in a helper.** The typed key overload requires a string literal at the call site; routing keys through a generic `(key: string) => i18n.t(key, ...)` wrapper widens the key to `string` and breaks namespace-aware narrowing (TS error on the wrapper's own `i18n.t` call). If a call site repeats the same namespace many times, inline the calls — don't DRY them up.

**Testing**: When adding translated text, verify:

- Both EN and UK files have matching keys
- No missing translation keys (would show fallback)
- Plurals work correctly for Ukrainian
- Run `npm run i18n:check` to validate key parity across all locales (plural-form aware)

---

## Common Patterns

**Dynamic Text with Variables**:

```typescript
// Translation: "Showing {{count}} of {{total}} rows"
t('table.showing', { count: 100, total: 1000 });
```

**Conditional Text**:

```typescript
// Use separate keys instead of logic in translation
const key = isSource ? 'labels.source' : 'labels.model';
t(key);
```

**HTML in Translations** — never use `dangerouslySetInnerHTML` with user-interpolated variables (XSS risk, even self-XSS). Split into JSX instead:

```tsx
// BAD — user data rendered as HTML
<p dangerouslySetInnerHTML={{ __html: t('key', { name: userInput }) }} />

// GOOD — user data rendered as text node, safe by default
<p>{t('importCsv.replacingSource')} <em>{sourceName}</em></p>
```

When translatable text wraps around `<code>` or other markup, extract only the natural-language parts as i18n keys; keep universal code snippets as JSX:

```tsx
// Translation key: "if your JSON is" (no code in key)
<code>results</code> ({t('importCsv.exampleIfJsonIs')} <code>{`{ "results": [...] }`}</code>)
```

**i18n in portable core modules** — files under `src/core/` must not import `i18n` (they run in Node.js for the CLI, where no i18n runtime is configured). `npm run lint:core` is the check: it typechecks core plus the CLI with the DOM removed. When a core module needs translated strings, accept them as an options field and fall back to English defaults. The app-side caller builds the labels object from `t()` and passes it in. See `ChartOptions.labels` / `ChartLabels` in `src/app/services/charts.ts` and `buildChartLabels` in `src/app/components/eda/chart-labels.ts` for the pattern — the charts engine now lives in the app layer because it renders into the DOM, and it keeps the parameterized-labels shape a core module owes.
