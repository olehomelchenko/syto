---
name: release
description: Bump the app version, update CHANGELOG, and prepare a git tag for release
disable-model-invocation: false
---

# Release

Bump the app version, update CHANGELOG.md, and prepare a git tag.

## Process

### 1. Determine what changed since the last version

Run `git log` from the last version tag (or all history if no tags exist) and review the changes. Categorize:

- **Features**: New user-facing capabilities
- **Fixes**: Bug fixes
- **Improvements**: Performance, UX polish, refactoring that affects behavior
- **Internal**: Refactoring, docs, tests, build changes (don't list individually — summarize if substantial)

### 2. Determine bump type

Read the current version from `package.json`.

The project uses **simplified semver during pre-1.0**:

| Bump                | When                                                                | Example           |
| ------------------- | ------------------------------------------------------------------- | ----------------- |
| **Minor** (`0.x.0`) | New features, UI changes, behavior changes, workflow format changes | `0.2.0` → `0.3.0` |
| **Patch** (`0.x.y`) | Bug fixes, polish, performance, internal improvements               | `0.2.0` → `0.2.1` |
| **Major** (`1.0.0`) | Only when declaring public stability (user decision)                | —                 |

Present the categorized changes and your recommended bump type to the user for confirmation before proceeding.

### 3. Update version

Update the `version` field in `package.json`. This is the **single source of truth** — Vite injects it as `__APP_VERSION__` at build time.

### 4. Update CHANGELOG

Add a new section to `docs/CHANGELOG.md` under the appropriate month heading. Follow the existing format:

- Group by feature/change, not by commit
- Lead with the name in bold, then a dash and description
- Most important changes first
- Don't list every commit — summarize related changes into coherent items

If the current month already has entries, add a version separator:

```markdown
## March 2026

### v0.3.0

- **New feature** — Description...

### v0.2.1

- **Bug fix** — Description...
```

### 5. Cross-check user-facing docs

Before cutting the tag, scan the hand-maintained user-facing docs against the changes landing in this release:

- `src/content/getting-started.md` (+ UK) — still describe the three-tab ribbon, current import sources, workflow, and tips correctly?
- `src/content/shortcuts.md` (+ UK) — did any commit in this range touch `src/app/handlers/core/keyboard-handlers.ts`, `src/app/orchestration/EventRouter.ts`, `src/app/components/DataTable.tsx`, or add dialog-level keyboard handling? If yes, verify the list is complete **and still accurate** — v0.5.0 found `Delete` documented as "Remove the last step" months after the fix that made it remove the viewed step. Pass the paths to `git log` exactly as written here; an almost-right path returns an empty log, which reads as "no drift".
- `src/content/about.md` (+ UK) — any feature descriptions or counts worth refreshing?

The `/alignment` skill should catch per-PR drift; this is the net for accumulated drift across many PRs since the last tag. If anything is stale, update it **before** creating the version bump commit — the release's CHANGELOG entry is not the place to quietly include doc fixes.

### 6. Suggest git tag

After the user stages and commits the version bump, suggest:

```bash
git tag v{version}
git push --tags
```

**The website is Cloudflare Pages, not GitHub Pages and not GitHub Actions.** The `syto` Pages project builds Production from **`main`** and Preview from `dev`, so a push to `dev` publishes a preview URL and nothing else. Publishing means merging `dev` into `main` and pushing `main`. Verify with:

```bash
npx wrangler pages deployment list --project-name syto | grep Production
```

`npm run deploy` (`gh-pages -d dist`) is dead and must not be used: no `gh-pages` branch exists on the remote, and nothing serves one. Removing that script is queued in `docs/BACKLOG.md`.

## Rules

- **Never bump version without user confirmation** on the bump type
- **Never stage or commit** — the user handles git operations
- The workflow format `formatVersion` is independent of the app version — only bump it when the workflow schema actually changes
- Version is displayed in: Settings dialog, exported workflow JSON (`sytoVersion` field)
