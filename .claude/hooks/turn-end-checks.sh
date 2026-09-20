#!/usr/bin/env bash
# Stop — hold the turn open while the tree is red.
#
# pre-commit formats and typechecks, pre-push runs typecheck and the suite, and
# CI runs both again. This gate is the agent's own: it covers every source state
# a session leaves behind, including the ones that never reach a commit.
#
# Two conditions keep the cost off ordinary turns. The gate runs only when the
# working tree has changes under src/, so a question-only turn stays fast. And
# it runs once per distinct source state, not once per turn: the signature of
# the last green run is recorded inside .git, so a turn that changed no source
# skips the suite even while the tree stays dirty.
#
# Known gap: the signature covers tracked content and the list of untracked
# paths. Editing an untracked file under src/ without adding it does not move
# the signature.
#
# The hook exits silently without jq or without shasum, so the gate is off on a
# machine lacking either. shasum is checked up front rather than left to fail:
# an empty signature compares equal to an absent stamp file, which would skip
# the suite on every turn while looking like it ran.
#
# docs/HARNESS.md -> The verify gate.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0
command -v shasum >/dev/null 2>&1 || exit 0

# A blocked stop re-runs this hook. Never block twice on the same turn.
[ "$(jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0
[ -n "$(git status --porcelain -- src 2>/dev/null)" ] || exit 0

sig=$( { git diff HEAD -- src; git ls-files --others --exclude-standard -- src | sort; } 2>/dev/null |
  shasum | cut -d' ' -f1)
stamp="$gitdir/syto-turn-gate"
[ "$sig" = "$(cat "$stamp" 2>/dev/null)" ] && exit 0

if ! out=$(npm run typecheck 2>&1); then
  printf 'Typecheck fails. Fix it before the turn ends.\n\n%s\n' "$(printf '%s' "$out" | tail -30)" >&2
  exit 2
fi

if ! out=$(npm test 2>&1); then
  printf 'Tests fail. Fix them before the turn ends.\n\n%s\n' "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi

printf '%s' "$sig" >"$stamp"
exit 0
