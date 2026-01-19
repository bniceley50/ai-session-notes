param(
  [string]$Date = (Get-Date -Format "yyyy-MM-dd")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Read-OrEmpty($path) {
  if (Test-Path $path) { return Get-Content -Raw -LiteralPath $path }
  return ""
}

function Ensure-File($path, $content) {
  if (!(Test-Path $path)) {
    $dir = Split-Path -Parent $path
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    $content | Set-Content -LiteralPath $path -Encoding UTF8
  }
}

function Extract-FirstBullets($text, $max) {
  $lines = $text -split "`r?`n"
  $bullets = @()
  foreach ($l in $lines) {
    if ($l -match "^\s*-\s+\S") { $bullets += ($l -replace "^\s*-\s+","").Trim() }
    if ($bullets.Count -ge $max) { break }
  }
  return $bullets
}

$contextPath   = Join-Path $Root "CONTEXT.md"
$decisionsPath = Join-Path $Root "DECISIONS.md"
$nextPath      = Join-Path $Root "NEXT.md"

$journalDir    = Join-Path $Root "JOURNAL"
$wrapDir       = Join-Path $journalDir "WRAPUPS"
$journalPath   = Join-Path $journalDir "$Date.md"
$outPath       = Join-Path $wrapDir "$Date.wrapup.md"

Ensure-File $contextPath   "# CONTEXT`n"
Ensure-File $decisionsPath "# DECISIONS`n"
Ensure-File $nextPath      "# NEXT`n"
Ensure-File $journalPath   "# JOURNAL — $Date`n`n## Wins`n- `n"

New-Item -ItemType Directory -Force $wrapDir | Out-Null

$context   = Read-OrEmpty $contextPath
$decisions = Read-OrEmpty $decisionsPath
$next      = Read-OrEmpty $nextPath
$journal   = Read-OrEmpty $journalPath

# Git snapshot (safe + useful)
$gitInfo = ""
try {
  Push-Location $Root
  if (Test-Path (Join-Path $Root ".git")) {
    $status = (git status -sb) 2>$null
    $stat   = (git diff --stat) 2>$null
    $names  = (git diff --name-only) 2>$null
    $gitInfo = @"
### Git Snapshot
$status

### Files changed (working tree)
$names

### Diff stat
$stat
"@
  }
} catch {
  $gitInfo = "### Git Snapshot`n(unavailable)"
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}

# Next 3 steps max
$nextTop3 = (Extract-FirstBullets $next 3)
if ($nextTop3.Count -eq 0) { $nextTop3 = @("Pick the next smallest step and write it in NEXT.md") }

# Choose ONE codex task (top of NEXT.md)
$oneTask = $nextTop3[0]

# Journal-derived bullets
$wins = (Extract-FirstBullets $journal 3)
if ($wins.Count -eq 0) { $wins = @("Made progress and kept moving.") }

# Facebook-friendly story (no tech overload)
$story = @()
$story += "Day $Date — build journal."
$story += "Main win: $($wins[0])"
if ($wins.Count -gt 1) { $story += "Also: $($wins[1])" }
$story += "Slow progress beats no progress. Showing up is the whole game."

$storyText = ($story -join "`n")

# Technical changelog pulls from journal + git
$wrap = @"
# Build Journal Wrap-Up Pack — $Date

## 1) Story (Facebook-friendly)
$storyText

## 2) Technical changelog (what changed / what we learned)
### What I did (from journal)
$journal

$gitInfo

## 3) Next Session Kickoff (3 steps max)
- $($nextTop3[0])
$(if ($nextTop3.Count -ge 2) { "- $($nextTop3[1])" } else { "" })
$(if ($nextTop3.Count -ge 3) { "- $($nextTop3[2])" } else { "" })

## 4) Codex task prompt (ONE change only, one file max)
PASTE INTO: CODEX

You are Codex working in repo: N:\asn\ai-session-notes

TASK:
- $oneTask

HARD CONSTRAINTS:
- Make ONLY ONE change
- Touch ONE file max
- No new dependencies unless explicitly required
- Keep it small and shippable

DELIVERABLE:
- Return a minimal patch + exact file path changed
- Explain what changed in 3 bullets max
"@

$wrap | Set-Content -LiteralPath $outPath -Encoding UTF8
Write-Host "[OK] Wrote: $outPath"
