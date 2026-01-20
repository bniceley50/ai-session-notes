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
