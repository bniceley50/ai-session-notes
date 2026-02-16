# Codex workflow

# # Start here (mandatory)

Every PowerShell block MUST start with this exact first line (prevents running in C:\Windows by mistake):

```powershell
Set-Location -LiteralPath 'N:\asn\ai-session-notes'
```

# # Start Codex

```powershell
.\codex_here.cmd
```

# # Daily loop (plan -> patch -> gate -> commit)

```powershell
# Plan in chat
# Make a small patch
.\tools\gate.cmd
git add .
git commit -m "Describe the change"
```

# # Never paste plans into PowerShell
- Plans are plain text, NOT commands.
- If you paste Markdown into PowerShell, it will error (Update/anti-drift/etc. will be treated as commands).

# # Command labeling rule
- Only run commands explicitly labeled: "PASTE INTO: TERMINAL (PowerShell)".
- Anything else is discussion text and must not be pasted into a shell.

# # Codex Driver Prompt (copy/paste each session)
```text
You are the repo operator. Before any edit run:
1) git status -sb
2) git diff --name-only
If clean: STOP and ask what to do next (don't invent work).
Only touch user-named files.
After edits: show git --no-pager diff -- <file>.
If tools\gate.cmd exists, run it.
```

Recommendation: prefer `git add -p` over `git add .` to avoid accidental commits.

# # Skills

```text
/skills
$session-wrapup
$update-next
$decision-log
$repo-hygiene
```

# # Rules we follow

- One change set at a time.
- No deletions without approval (archive/move instead).
- Always run `.\tools\gate.cmd` after edits.

