---
name: verify
description: Drive the running Syto app headless, or run the CLI for real, to verify a change by observing behavior rather than reading code — dev server + Playwright recipe, the CLI recipe, evidence capture, and the environment quirks this machine has.
---

# Verify — run the thing

Runtime observation, not CI. Build nothing, run the app or the CLI, make the
changed code execute at the surface a user meets, and capture what it shows.
Typecheck, the suite and the lint gates are the turn-end hook's job and prove
nothing about behavior.

**Why this skill exists.** The 2026-07-26 practice audit found four defects that
reading could not: a `--output <dir>` crash, two documented examples that fail
when typed, a silently-ignored `--input` flag, and the browser and the CLI
disagreeing about CSV parsing. `npm run typecheck` was clean and all 2,576 tests
passed while every one of them was broken. A green build is evidence about
types, not about what happens.

## The CLI

Runs straight from source, no build:

```bash
npx tsx src/cli.ts --help
npx tsx src/cli.ts run <workflow.json> --bind sales=<file.csv> -o <dir>
npx tsx src/cli.ts validate <workflow.json> --json
npx tsx src/cli.ts schema <file.csv>
```

Write the workflow and the data into the scratch directory, never into this
tree. Check the **exit code** on every run: the five documented codes are 0
success, 1 arguments or missing file, 2 validation, 3 binding, 4 transform
execution, and a command that prints an error and exits 0 is itself the defect.

**Run the examples a document prints, exactly as printed.** That is what caught
the broken ones. A command that only appears in prose has never been executed.

**`npm run build:cli` is the other half** and it is a different program: esbuild
bundles it with four externals, so a defect that only shows in the bundle —
a missing dependency, a define that was never set — is invisible to the `tsx`
path. Run the bundle when the change touches imports or the build script.

## The app

### Launch

```bash
npm run dev > <scratch>/dev.log 2>&1 &
grep -o 'http://localhost:[0-9]*' <scratch>/dev.log | head -1
```

**Read the port out of the log.** `vite.config.ts` sets no `server.port` and no
`strictPort`, so vite takes 5173 when it is free and silently drifts to 5174
when it is not. A script with 5173 hardcoded then drives somebody else's server.

Kill your own server by port (`lsof -ti :<port> | xargs kill`), never by name —
other vite processes belong to other sessions.

**After any dependency install, vite re-optimizes.** The log says
`Re-optimizing dependencies because lockfile has changed`. A tab the user had
open before that requests the old chunk hashes and fails on the lazy ones. If
you restarted the server while they had a tab open, tell them to hard-reload.

### Drive

Playwright is deliberately not a project dependency — it is a verification tool,
not app code, and `knip.json` would flag it. Its browsers are already cached in
`~/Library/Caches/ms-playwright`. Install the library in the scratch directory
and run plain `node` from there:

```bash
cd <scratch> && npm install playwright --no-save
```

```js
const browser = await chromium.launch({ args: ['--use-mock-keychain'] });
```

**`--use-mock-keychain` is required on this machine.** Without it a fresh
browser profile asks the macOS Keychain for its Safe Storage key and raises a
password prompt on the desktop, where no headless run can answer it.

### What this app does

Verified by driving it on 2026-09-21. Every line here is something a script got
wrong or would have got wrong.

- **The app is at `/app/`.** `/` is the landing page — it has no `#app-root`, so
  `goto('/')` plus a wait for app content times out against marketing copy.
  The third entry is `/tools/json-to-csv/`.
- **Boot is ready when `#app-root` has a child.** `waitForSelector('#app-root > *')`.
- **A fresh profile boots to the empty state** with no data at all: no table, no
  columns, nothing to assert on. Import something first.
- **Import a CSV through the hidden file input**:
  `page.setInputFiles('input[type=file]', path)`. The input sits behind the
  Upload button and is never visible; `setInputFiles` does not need it to be.
- **That opens a `[role=dialog]`** headed "Import CSV", which already holds a
  **preview table**. While the dialog is open, `document.querySelectorAll('table')`
  returns the preview and not the grid — a count of tables is not a test that
  the import landed.
- **Confirm with the exact name**: `getByRole('button', { name: 'Import', exact: true })`.
  Without `exact`, "Import from URL" also matches.
- **Wait for the dialog to go**, then read the grid: `waitForFunction(() => !document.querySelector('[role=dialog]'))`.
- **The grid carries a leading row-number column.** A three-column CSV gives four
  `th` elements, the first with empty text. Index from 1 or assert on the header
  text.
- **Persistence is IndexedDB plus localStorage.** State survives a reload in the
  same browser context and dies with the context, so a fresh `newPage` starts
  empty every time. To verify persistence, reload the same page rather than
  opening a new one.
- **DuckDB is lazy-loaded and experimental.** The first query that needs it
  cold-loads WebAssembly in a worker — seconds, not milliseconds. Wait for the
  DOM state you expect, never a fixed timeout.

### Reading state: `sytoDebug.snapshot(n)`

`window.sytoDebug` is set up at boot (`src/app/utils/debug-helpers.ts`). Its
`store` field is the whole `AppStore`, which is right for a human at a console
and wrong for a driver: `page.evaluate` drops anything that does not survive
`structuredClone`, so reaching for the wrong accessor returns `{}` or `null`,
which reads as "the app is empty" rather than "I asked wrong". That cost two
runs while this recipe was written — `columns` is a `string[]` and not column
objects, and `currentData` is a plain row array with no Arquero methods.

**So read state through `snapshot()`, which is the contract**: every value is a
string, a number, a boolean or an array of those.

```js
const snap = (n = 0) => page.evaluate((k) => window.sytoDebug.snapshot(k), n);
await page.waitForFunction(() => window.sytoDebug.snapshot().hasData === true);
```

It carries `hasData`, `sources`, `models`, `activeSourceId`, `activeModelId`,
`rowCount`, `columns`, `steps` (the transform kind of each step), `types`,
`isTransforming`, `activeDialog`, `notifications`, and `rows` — the first `n`
rows, `0` by default because 10k rows crossing the bridge on every poll makes
the poll the slowest thing in the run. Widen the function rather than teaching a
second driver to walk the store.

### The ribbon and the transform dialogs

- **Ribbon tabs carry `role="tab"`, not `role="button"`** (`src/app/components/AppHeader.tsx`).
  `getByRole('button', { name: 'Rows' })` times out against a button that is
  plainly on screen. Use `getByRole('tab', { name: 'Rows', exact: true })`.
  The three tabs are `Rows`, `Columns`, `Table`, and all three are disabled
  until data is loaded.
- **The verbs are buttons inside the tab.** `Rows` holds Filter, Sort,
  Duplicates, Slice rows, Sample, Headers. `Table` holds **Group by** — not
  "Aggregate", which is the step's name in the workflow and matches no control.
- **Filter and Derive are CodeMirror**, not `<input>` or `<textarea>`. Click
  `.cm-content` and use `page.keyboard.insertText(...)`; `fill()` does not work
  on a contenteditable editor. Derive's output-name field is an ordinary
  `input[type=text]`.
- **Group by selects columns with clickable chips**, one button per column, not
  a `<select>`. The dialog's first `<select>` is the aggregation row's column
  picker and it is **disabled whenever the function is Count**, which needs no
  column — `selectOption` on it times out, and that is correct behavior rather
  than a defect.
- **Confirm buttons repeat the verb**: the Filter dialog's confirm is also named
  "Filter". Use `.last()` to reach the dialog's copy rather than the ribbon's.
- **Importing a sample dataset is two dialogs.** "Import from URL" opens a
  picker; clicking a dataset link opens a second dialog headed "Import CSV" with
  a name field, a delimiter choice and a preview; that one's "Import" button is
  what lands the data. A driver that stops after the first click waits forever
  on `hasData`.

### The fixture and its ground truth

`public/datasets/superstore.csv` ships in the repository and is the fixture to
reach for: 10,194 rows, 21 columns, with embedded quotes and commas in
`Product Name`, two date columns, negative values in `Profit`, a slash in
`Country/Region` and a hyphen in `Sub-Category`.

Computed from the file with PapaParse on 2026-09-21, independent of the app —
these are what an assertion compares against, never a number the app produced:

| Question                              | Answer                                        |
| ------------------------------------- | --------------------------------------------- |
| Rows / columns                        | 10,194 / 21                                   |
| `[Category] == 'Furniture'`           | 2,201                                         |
| `[Sub-Category] == 'Chairs'`          | 634                                           |
| `[Country/Region] == 'United States'` | 9,994                                         |
| `[Profit] < 0`                        | 1,901                                         |
| Furniture grouped by Region           | South 332 · Central 485 · East 649 · West 735 |
| Distinct Order IDs                    | 5,111                                         |
| Total Sales / Profit                  | 2,326,534.35 / 292,296.81                     |

**Known bad on import:** 449 rows lose a leading zero from `Postal Code`, which
infers as `integer` (`docs/BACKLOG.md` → "Leading zeros are destroyed on
import"). Every other column infers correctly. A run that finds 449 damaged
rows has reproduced a known defect, not found a new one.

### Both engines, one workflow

The strongest check this repository has: export the workflow from the browser
and run the same file through the CLI. Nothing else asserts that the two engines
agree, and they share `src/core/`.

```bash
npx tsx src/cli.ts run <workflow.json> --bind superstore=<ABSOLUTE path to the csv>
```

The bind path must be absolute unless the data sits beside the workflow — a
relative one resolves against the **workflow file's** directory. Browser and CLI
produced identical output for import → filter → group by on 2026-09-21.

### Evidence

Listen for `pageerror` and `console` with `type() === 'error'` from the first
line of the script, and print the collected list at the end. A clean boot here
produces **zero** of either, so any entry is a finding. Screenshot each step
into the scratch directory and name the files in order.

Report what you observed and where. A step that could not run says so; it does
not get reported as a pass.

## Cleanup

Kill the dev server by port. Leave nothing in the repository tree: the scratch
directory holds the driver script, the fixtures, the log and the screenshots.
