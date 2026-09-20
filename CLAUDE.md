# Claude Context — Syto

@AGENTS.md

Everything about this project — the overview, the security requirements, the
codebase map, the AI Developer Protocol, the documentation index, the gates and
the skills — is in `AGENTS.md`, which the line above loads. This file holds only
what is true of Claude Code and of no other agent. **A fact stated in both files
is a fact that will diverge: put it in `AGENTS.md`.**

## What this repository runs against a Claude Code session

Registered in `.claude/settings.json`. Full description, including what each one
refuses and why: [docs/HARNESS.md](docs/HARNESS.md).

- **`PostToolUse` on Edit|Write → `.claude/hooks/house-rules.sh`** — refuses an
  edit that breaks an absolute ban (`eval`, `new Function`, a preact import in
  `src/core/`). The refusal names the replacement, so fix the edit rather than
  asking what to do.
- **`PostToolUse` on Edit|Write → `.claude/hooks/markers.sh`** — reports the
  `// TODO(YYYY-MM-DD):` markers the edited file carries, once per file per
  session. It advises and never refuses. **Answer it**: each marker is either
  fired — act on it in this diff or queue it — or not yet, and say which.
- **`Stop` → `.claude/hooks/turn-end-checks.sh`** — runs typecheck and the suite
  and holds the turn open while either fails. It runs once per distinct source
  state, so a turn that changed no source pays nothing.

Every one of these has a script twin under `scripts/` that CI runs, so an agent
that is not Claude Code meets the same refusal at the build. The hook adds only
the moment.

## Slash commands

The skills in `.claude/skills/` run as slash commands here; `AGENTS.md` lists
what each is for. `/alignment` and `/release` are marked
`disable-model-invocation: true` and start only when the user types them —
except that `/wrap-up` runs `/alignment` as a subagent, which reads the file
directly and is not blocked by the flag.

`.claude/agents/cold-reader.md` runs as a subagent.
