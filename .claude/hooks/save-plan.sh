#!/usr/bin/env bash
# Saves plans from ExitPlanMode into the project:
#   PostToolUse         (plan approved) -> plans/<YYYYMMDD-HHmm>-<slug>.md
#   PostToolUseFailure  (plan rejected) -> brainstorms/<YYYYMMDD-HHmm>-<slug>.md
# A rejected draft that is revised and rejected again overwrites its earlier
# brainstorm file (matched via the "source-plan" marker) instead of piling up copies.
set -euo pipefail

input=$(cat)
event=$(jq -r '.hook_event_name // empty' <<<"$input")
project="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input")}"
[ -n "$project" ] || exit 0

plan=$(jq -r '.tool_input.plan // .tool_response.plan // empty' <<<"$input")
src=$(jq -r '.tool_input.planFilePath // .tool_response.filePath // empty' <<<"$input")
if [ -z "$plan" ] && [ -n "$src" ] && [ -f "$src" ]; then plan=$(cat "$src"); fi
[ -n "$plan" ] || exit 0

case "$event" in
  PostToolUse)        dir="plans";       status="approved" ;;
  PostToolUseFailure) dir="brainstorms"; status="not approved" ;;
  *) exit 0 ;;
esac

# Slug from the first markdown heading, e.g. "# Plan: Add zone editor" -> "add-zone-editor"
title=$(grep -m1 '^# ' <<<"$plan" | sed -E 's/^# +//; s/^[Pp]lan:? *//' || true)
slug=$(printf '%s' "${title:-plan}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-60)
slug=${slug:-plan}
key=$(basename "${src:-$slug}")

mkdir -p "$project/$dir"
target=""
if [ "$dir" = "brainstorms" ]; then
  target=$(grep -l -F "<!-- source-plan: $key -->" "$project/brainstorms"/*.md 2>/dev/null | head -1 || true)
fi
[ -n "$target" ] || target="$project/$dir/$(date +%Y%m%d-%H%M)-$slug.md"

{
  printf '<!-- source-plan: %s -->\n' "$key"
  printf '<!-- status: %s · saved %s -->\n\n' "$status" "$(date '+%Y-%m-%d %H:%M')"
  printf '%s\n' "$plan"
} >"$target"

rel=${target#"$project/"}
jq -n --arg msg "Plan $status → saved to $rel" --arg ev "$event" \
  '{systemMessage: $msg, hookSpecificOutput: {hookEventName: $ev, additionalContext: $msg}}'
