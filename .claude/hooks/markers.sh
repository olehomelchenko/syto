#!/usr/bin/env bash
# PostToolUse(Edit|Write) — put a touched file's markers in front of the agent.
#
# Nearly every trigger recorded in this tree is keyed to a touch ("the next
# touch moves it") or to a count ("a third instance extracts the helper"). Only
# whoever holds the file can decide either one. Every marker here was written in
# one week in May 2026 and none was triaged since, so the triggers kept firing
# unread.
#
# So the evaluation moment moves to the edit. The agent has the file open and
# the diff in hand, which is the one moment the question costs nothing.
#
# Advisory, not a refusal: this reports through additionalContext and exits 0.
# The house-rules bans admit no judgment and so exit 2. Whether a trigger fired
# is a judgment, and a blocking error on every edit to a marker-bearing file
# would train the agent to skip past it.
#
# This script holds no census of its own. `scripts/markers.mjs --file` owns the
# marker grammar, the scope list and the comment walker, because the gate and
# the notice must agree on what a marker is. Node is a hard dependency of this
# repository, so it needs no guard the way jq does.
#
# Reported once per file per session, because a session may edit one file many
# times and the question is the same each time. The stamp is ONE file holding
# the session id and the paths already reported: a file per session accumulates
# under .git/ with nothing to prune it. Known gap: a long session that touches a
# file at both ends gets the notice only at the first touch.
#
# docs/HARNESS.md -> The marker census.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

# One jq pass for both fields, matching house-rules.sh's single read.
read -r file session < <(
  jq -r '[(.tool_input.file_path // "-"), (.session_id // "-")] | @tsv' 2>/dev/null
) || exit 0
[ "$file" = "-" ] && exit 0
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
gitdir=$(git rev-parse --git-dir 2>/dev/null) || exit 0

# The notice is empty for a file out of scope, outside this repository, or
# carrying no marker — so the scope test never needs restating here.
notice=$(node scripts/markers.mjs --file "$file" 2>/dev/null) || exit 0
[ -n "$notice" ] || exit 0

# The stamp resets whenever the session id changes, so exactly one file exists.
stamp="$gitdir/syto-markers"
if [ "$(head -n 1 "$stamp" 2>/dev/null)" != "${session:--}" ]; then
  printf '%s\n' "${session:--}" >"$stamp" 2>/dev/null || exit 0
fi
grep -qxF "$file" "$stamp" 2>/dev/null && exit 0
printf '%s\n' "$file" >>"$stamp"

jq -n --arg ctx "$notice" \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
exit 0
