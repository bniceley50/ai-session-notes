param(
  [string]$RepoRoot = (Get-Location).Path
)

$skills = @(
  @{ name = "decision-log";   desc = "Log and maintain clear project decisions in DECISIONS.md with rationale and revisit triggers." },
  @{ name = "repo-hygiene";   desc = "Propose safe repo cleanup (naming, placement, backups) without deleting anything unless explicitly approved." },
  @{ name = "session-wrapup"; desc = "Create an end-of-session wrapup and update NEXT/DECISIONS/CONTEXT and JOURNAL/WRAPUPS as needed." },
  @{ name = "update-next";    desc = "Rewrite NEXT.md into a crisp, ordered task list (Now/Next/Later) with verification notes when relevant." }
)

foreach ($s in $skills) {
  $path = Join-Path $RepoRoot (".codex\skills\" + $s.name + "\SKILL.md")
  if (-not (Test-Path $path)) { Write-Host "[SKIP] Missing $path"; continue }

  $raw = Get-Content -Raw -LiteralPath $path
  if ($raw.TrimStart().StartsWith("---")) {
    Write-Host "[OK] Already has frontmatter: $path"
    continue
  }

  $fm = @"
---
name: $($s.name)
description: $($s.desc)
metadata:
  short-description: $($s.desc)
---

"@

  Set-Content -LiteralPath $path -Value ($fm + $raw) -Encoding UTF8
  Write-Host "[FIXED] Added YAML frontmatter: $path"
}

Write-Host ""
Write-Host "Run: tools\gate.cmd"
