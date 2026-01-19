param(
  [Parameter(Mandatory=$true)]
  [string]$OutFile,

  [string]$CommandRan = "",

  # Paste the error text here or pipe it in
  [string]$ErrorText = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Try to gather useful repo context (won't fail the script if git isn't available)
$gitStatus = ""
$gitDiffStat = ""
try { $gitStatus = (git status -sb 2>$null) -join "`n" } catch {}
try { $gitDiffStat = (git diff --stat 2>$null) -join "`n" } catch {}

# Basic env
$node = ""
$pnpm = ""
try { $node = (node -v 2>$null).Trim() } catch {}
try { $pnpm = (pnpm -v 2>$null).Trim() } catch {}

$cwd = (Get-Location).Path

$body = @"
# DEBUG REQUEST

## Goal
Explain the error and propose the smallest fix.

## Environment
- Windows 11
- Repo: $cwd
- Node: $node
- pnpm: $pnpm

## Git status
$gitStatus

## Git diff --stat
$gitDiffStat

## What I ran
$CommandRan

## Error output
$ErrorText

## Constraints
- Prefer ONE file change.
- No new deps unless absolutely needed.
"@

$body | Set-Content -LiteralPath $OutFile -Encoding UTF8
Write-Host "[OK] Wrote $OutFile"
