# Project rules

## Documents: `brainstorms/` vs `plans/`

| Folder | What goes there |
|---|---|
| `brainstorms/` | Idea exploration, brainstorm discussions, analyses, and any plan that has **not** been approved |
| `plans/` | Plans the user **approved** (via plan mode → ExitPlanMode accepted) |

- File names start with a datetime prefix in local time: `YYYYMMDD-HHmm-<kebab-slug>.md`
  (e.g. `20261109-0316-browser-focus-brainstorm.md`). Get the time with `date +%Y%m%d-%H%M`.
- Never put an unapproved plan in `plans/`. A brainstorm doc moves to `plans/` only through approval.

## Automation (hook)

`.claude/hooks/save-plan.sh` runs on `ExitPlanMode` (configured in `.claude/settings.json`):
- **Approved** (`PostToolUse`) → copies the plan to `plans/<datetime>-<slug>.md`.
- **Rejected** (`PostToolUseFailure`) → saves the draft to `brainstorms/<datetime>-<slug>.md`. Later rejections of the same draft overwrite that file.

The slug comes from the plan's first `# ` heading, so start every plan with a clear title such as `# Plan: Add zone editor`.
Don't copy approved plans into `plans/` by hand, because the hook already does it. Brainstorm docs that don't come from plan mode are written by hand into `brainstorms/`.
