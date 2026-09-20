#!/usr/bin/env bash
# PostToolUse(Edit|Write) — the absolute source bans, checked at the edit.
#
# The check is scripts/house-rules.mjs, which CI runs over the whole tree as
# `npm run lint:house`. This hook hands it the edited file alone, so the refusal
# an agent meets mid-edit is the refusal the build gives, and no second grammar
# lives here. The script owns the scope test too: a path outside src/ or not
# .ts/.tsx reports nothing.
#
# The payload is read with jq; without jq the hook reports nothing, so the
# project hooks are off on a machine that lacks it. Anchored to THIS repository:
# a session may hold a second working directory, and both bans are properties of
# this codebase.
#
# docs/HARNESS.md -> The house rules.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0
file=$(jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0
[ -n "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f "$file" ] || exit 0

if ! out=$(node scripts/house-rules.mjs --file "$file" 2>&1); then
  printf '%s\n' "$out" >&2
  exit 2
fi
exit 0
