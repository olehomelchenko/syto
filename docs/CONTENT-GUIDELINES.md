# Syto — Content Guidelines

> **Purpose**: Conventions for writing UI text — labels, error messages, notifications, and all user-facing copy. Adapted from IBM Carbon Design System principles, tailored to Syto's bilingual (en/uk) context. See [DECISIONS.md](DECISIONS.md) §3 for the full rationale.
>
> **Related**: [UX-SPECIFICATION.md](UX-SPECIFICATION.md) (UI patterns), [I18N-GUIDE.md](I18N-GUIDE.md) (translation setup), [SOUL.md](../SOUL.md) (project philosophy)

---

## 1. General Principles

- **Sentence case** everywhere — headings, labels, buttons, menus, tooltips. See §2.
- **Active voice** — "Select a column" not "A column should be selected."
- **Concise** — every word should earn its place. Prefer shorter forms.
- **No "please"** — it adds no information and translates inconsistently across languages. See §9.
- **No exclamation marks** in errors or warnings. Reserve for positive confirmations only ("Imported!").
- **Second person** — address the user as "you" when needed, but most UI text can omit the pronoun entirely ("Select a column" not "You need to select a column").
- **No editorial meta-talk** — don't leak internal framing into user-visible copy. Phrases like "user-facing changes", "excluding refactors", "curated list" describe the content as filtered; users just want the content. Describe what the thing _is_, not what it was _selected down to_. Applies to docs, release notes, dialog text, tooltips — anywhere a reader lands cold.

---

## 2. Capitalization

### 2.1 Sentence Case Rule

All UI text uses **sentence case**: capitalize only the first word and proper nouns.

| Element       | Correct                                       | Incorrect                                     |
| ------------- | --------------------------------------------- | --------------------------------------------- |
| Dialog title  | "Filter rows"                                 | "Filter Rows"                                 |
| Button label  | "Add column"                                  | "Add Column"                                  |
| Menu item     | "Sort ascending"                              | "Sort Ascending"                              |
| Tab label     | "Columns"                                     | "COLUMNS"                                     |
| Tooltip       | "Select a date column to use date operations" | "Select A Date Column To Use Date Operations" |
| Error message | "Column name is required"                     | "Column Name Is Required"                     |

**Rationale**: Sentence case is faster to read, easier to translate, and avoids ambiguity about which words to capitalize in multi-word terms.

### 2.2 Exceptions

- **Proper nouns**: CSV, JSON, URL, Syto, Arquero, Vega-Lite, Excel
- **Acronyms**: EDA, TSV, ODS, ISO
- **Column/function names** displayed as user data — render as-is

### 2.3 Product Name in Ukrainian

In Ukrainian prose (`src/content/uk/**/*.md`, Ukrainian i18n bundles, anywhere a reader sees rendered UK text), write the product name as **Сито**, not "Syto".

Keep the Latin "Syto" unchanged in: URLs, GitHub links, CLI commands (`syto run`), code blocks, HTML `<title>` slugs, file paths, and the npm package name. These are identifiers, not prose.

Rationale: Cyrillic transliteration reads natively to Ukrainian users; Latin spellings read like untranslated technical jargon.

---

## 3. Labels & Headings

### 3.1 Field Labels

- **1-3 words** — "Output column", not "Name of the output column"
- **No trailing colon** — the label's position above/beside the field is sufficient
- **Noun phrase** — "Column name", "Sample size", "Date format"
- **Always visible** — never replace a label with placeholder text

### 3.2 Dialog Titles

Action-oriented, describing what the dialog does:

| Good           | Avoid                                 |
| -------------- | ------------------------------------- |
| "Filter rows"  | "Filter configuration"                |
| "Import CSV"   | "Import settings"                     |
| "Sort columns" | "Sort" (too terse for a dialog title) |
| "Join tables"  | "Join setup"                          |

### 3.3 Section Headings

- **Noun phrases** for groups: "Output options", "Join keys"
- **Imperative** for instructions: "Select columns to keep"

---

## 4. Action Buttons

### 4.1 Task-Specific Verbs

Button labels should describe the specific action, not use generic terms.

| Dialog       | Button label | Avoid         |
| ------------ | ------------ | ------------- |
| Filter       | "Filter"     | "Apply", "OK" |
| Sort         | "Sort"       | "Apply"       |
| Derive       | "Add column" | "Apply"       |
| Join         | "Join"       | "Apply"       |
| Import CSV   | "Import"     | "OK"          |
| Replace data | "Replace"    | "Apply"       |
| Rename       | "Rename"     | "OK"          |

**Rationale**: Task-specific verbs confirm what will happen. "Apply" is ambiguous — the user has to remember what they're applying.

### 4.2 Destructive Actions

- Use explicit verbs: "Delete", "Remove", "Replace"
- Pair with danger styling (red) when the action is irreversible
- Confirmation dialogs should repeat the action: "Delete model 'Sales Q4'?" with a "Delete" button, not "Are you sure?" with "OK"

### 4.3 Cancel & Dismiss

| Dialog type                      | Dismiss button label | Rationale                                    |
| -------------------------------- | -------------------- | -------------------------------------------- |
| Deferred-apply (transforms)      | "Cancel"             | User is abandoning uncommitted changes       |
| Immediate-apply (settings)       | "Close"              | Changes are already saved; nothing to cancel |
| Informational (about, reference) | "Close"              | No changes involved                          |

---

## 5. Error Messages

### 5.1 Structure

Every error message has two parts:

1. **What happened** — state the problem directly
2. **How to fix it** — tell the user what to do next

| Pattern               | Good                                    | Bad                                                |
| --------------------- | --------------------------------------- | -------------------------------------------------- |
| Required field        | "Column name is required"               | "Please enter a column name"                       |
| Missing selection     | "Select a column"                       | "Please select a column"                           |
| Invalid input         | "Enter a valid number"                  | "Please enter a valid number"                      |
| Fix before proceeding | "Fix expression errors before applying" | "Please fix the expression errors before applying" |
| Format requirement    | "Date format is required"               | "Please specify a date format"                     |

**Rules**: Start with imperative verb or state the requirement directly. No "please" — it adds words without information.

### 5.2 Error Placement

| Scope               | Display                          |
| ------------------- | -------------------------------- |
| **Field-level**     | Inline message below the control |
| **Dialog-level**    | Error box in dialog body         |
| **Operation-level** | Toast notification               |

**Rule**: Prefer the most specific scope. A missing column name is a field-level error, not a toast.

### 5.3 Toast Error Messages

- Include step context when applicable: "Step 3: Filter — Expression error: unexpected token"
- Never auto-dismiss error toasts
- Max two sentences: what failed + what to do about it

---

## 6. Helper Text, Placeholders & Tooltips

Three channels for supplementary information, each with a distinct role:

| Channel         | Persistence                     | Role                                              | Example                                              |
| --------------- | ------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **Helper text** | Always visible, below the field | Essential guidance: format, constraints, examples | "e.g., `sales > 1000`"                               |
| **Placeholder** | Disappears on input             | Example value showing expected format             | "Enter expression..."                                |
| **Tooltip**     | On hover/focus only             | Supplementary, non-essential information          | "Columns with spaces need brackets: `[Column Name]`" |

### Rules

- **Never use placeholder as the only label** — it disappears when the user starts typing
- **Helper text for constraints** — "Maximum 100 rows", "Regex syntax supported"
- **Placeholder for format hints** — show what valid input looks like
- **Tooltips for disabled states** — explain why a control is disabled and what would enable it
- **Keep tooltips under 2 lines** — if you need more, use helper text

---

## 7. Notifications & Toasts

### 7.1 Tone by Type

| Type        | Tense                   | Structure                     | Example                                              |
| ----------- | ----------------------- | ----------------------------- | ---------------------------------------------------- |
| **Success** | Past tense              | What completed                | "Imported 1,234 rows"                                |
| **Warning** | Present tense           | Condition + consequence       | "3 columns have type mismatches"                     |
| **Error**   | Past tense + imperative | What failed + recovery action | "Import failed: invalid CSV. Check the file format." |

### 7.2 Length

- **Success/warning**: one sentence maximum
- **Error**: two sentences maximum (what happened + how to fix)
- **No "please"** in notifications

### 7.3 Channel Selection

Detailed guidance on when to use each notification channel: see [UX-SPECIFICATION.md](UX-SPECIFICATION.md) §3.6.

---

## 8. Empty State Text

### 8.1 Positive Framing

Describe what the user _can do_, not what's missing.

| Avoid                | Prefer                                                     |
| -------------------- | ---------------------------------------------------------- |
| "No data loaded"     | "Import data to get started"                               |
| "No rows match"      | "No rows match this filter. Try adjusting the expression." |
| "No steps yet"       | "Add a transform from the ribbon above"                    |
| "No column selected" | "Select a column to see statistics"                        |

### 8.2 Template

Empty states follow a consistent structure:

1. **Title** (what the user can do) — imperative or declarative
2. **Subtitle** (how to do it) — optional, one sentence
3. **Action** (button or link) — optional, for primary empty states

Design details for empty states: see [UX-SPECIFICATION.md](UX-SPECIFICATION.md) §3.8.

---

## 9. i18n Considerations

### 9.1 Translation-Friendly Patterns

- **Avoid "please"** — maps to varying formality levels in Ukrainian (будь ласка) and adds unnecessary translation burden
- **Avoid concatenating fragments** — word order differs between English and Ukrainian. Use complete sentences with interpolation variables:

```
// Bad: assembled from parts
"Select " + count + " column" + (count > 1 ? "s" : "")

// Good: interpolation with i18next plural support
t('selection.columns', { count })
// en: "Select {{count}} column" / "Select {{count}} columns"
// uk: handles 1/few/many plural forms
```

- **Keep sentences complete** — don't split a message across multiple i18n keys
- **Avoid idioms** — "heads up", "gotcha", "you're all set" don't translate well

### 9.2 Gendered Language

Ukrainian uses grammatical gender for past-tense verbs. Where possible, use impersonal constructions in Ukrainian translations to avoid assuming the user's gender. See [I18N-GUIDE.md](I18N-GUIDE.md) for plural rules and translation patterns.

---

## 10. Audit Checklist

Quick reference for reviewing UI text before shipping:

| Check                          | Rule                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| Sentence case?                 | Only first word + proper nouns capitalized                     |
| No "please"?                   | Drop it — start with verb or state requirement                 |
| Task-specific button?          | "Filter", "Sort", "Import" — not "OK" or "Apply"               |
| Error has fix?                 | What happened + how to resolve                                 |
| Helper vs placeholder correct? | Helper = persistent, placeholder = format hint                 |
| Complete sentence?             | No fragment concatenation for i18n                             |
| Under length limit?            | Success toast: 1 sentence. Error: 2 max. Tooltip: 2 lines max. |
| Positive empty state?          | Describes what user can do, not what's missing                 |

---

**End of Content Guidelines**
