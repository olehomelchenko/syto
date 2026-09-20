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
