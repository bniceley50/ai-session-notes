# Codex workflow

## Start Codex

```powershell
.\codex_here.cmd
```

## Daily loop (plan -> patch -> gate -> commit)

```powershell
# Plan in chat
# Make a small patch
.\tools\gate.cmd
git add .
git commit -m "Describe the change"
```

> WARNING: Plans are NOT commands. Never paste Markdown plans into PowerShell.

Command labeling rule: only run commands explicitly labeled "PASTE INTO: TERMINAL (PowerShell)".

Codex Driver Prompt (reuse as needed):
```text
You are the repo operator. Before any edit run:
1) git status -sb
2) git diff --name-only
If clean: say "No changes required." and stop.
Only touch files explicitly named by the user.
After edits: show git --no-pager diff -- <files changed>.
If tools\gate.cmd exists, run it.
```

Recommendation: prefer `git add -p` over `git add .` to avoid accidental commits.

## Skills

```text
/skills
$session-wrapup
$update-next
$decision-log
$repo-hygiene
```

## Rules we follow

- One change set at a time.
- No deletions without approval (archive/move instead).
- Always run `.\tools\gate.cmd` after edits.
