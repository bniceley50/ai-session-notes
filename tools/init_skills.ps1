$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$skillsDir = Join-Path $repoRoot "SKILLS"
New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null

$script:Results = @()
$script:Backups = @()

function Add-Result {
  param([string]$Status, [string]$Path)
  $script:Results += ("[{0}] {1}" -f $Status, $Path)
}

function Backup-IfExists {
  param([string]$Path)
  if (Test-Path -LiteralPath $Path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = "$Path.bak-$ts"
    Copy-Item -LiteralPath $Path -Destination $backup -Force
    $script:Backups += $backup
    return $backup
  }
}

function Normalize-Text {
  param([string]$Text)
  if ($null -eq $Text) { return "" }
  return ($Text -replace "`r`n", "`n")
}

function Write-IfDifferent {
  param([string]$Path, [string]$Content)
  if (Test-Path -LiteralPath $Path) {
    $current = Get-Content -Raw -LiteralPath $Path
    if ((Normalize-Text $current) -ne (Normalize-Text $Content)) {
      Backup-IfExists $Path | Out-Null
      $Content | Set-Content -LiteralPath $Path -Encoding UTF8
      Add-Result "OK" $Path
    } else {
      Add-Result "SKIP" $Path
    }
    return
  }
  $Content | Set-Content -LiteralPath $Path -Encoding UTF8
  Add-Result "OK" $Path
}

function Write-IfDifferentAscii {
  param([string]$Path, [string]$Content)
  if (Test-Path -LiteralPath $Path) {
    $current = Get-Content -Raw -LiteralPath $Path
    if ((Normalize-Text $current) -ne (Normalize-Text $Content)) {
      Backup-IfExists $Path | Out-Null
      Set-Content -LiteralPath $Path -Value $Content -Encoding ASCII
      Add-Result "OK" $Path
    } else {
      Add-Result "SKIP" $Path
    }
    return
  }
  Set-Content -LiteralPath $Path -Value $Content -Encoding ASCII
  Add-Result "OK" $Path
}

function Write-IfMissing {
  param([string]$Path, [string]$Content)
  if (Test-Path -LiteralPath $Path) {
    Add-Result "SKIP" $Path
    return
  }
  $Content | Set-Content -LiteralPath $Path -Encoding UTF8
  Add-Result "OK" $Path
}

function Write-IfMissingOrSmall {
  param([string]$Path, [string]$Content, [int]$MinBytes = 20)
  if (Test-Path -LiteralPath $Path) {
    if ((Get-Item -LiteralPath $Path).Length -lt $MinBytes) {
      Backup-IfExists $Path | Out-Null
      $Content | Set-Content -LiteralPath $Path -Encoding UTF8
      Add-Result "OK" $Path
    } else {
      Add-Result "SKIP" $Path
    }
    return
  }
  $Content | Set-Content -LiteralPath $Path -Encoding UTF8
  Add-Result "OK" $Path
}

$manifestContent = @(
  '{',
  '  "schema_version": 1,',
  '  "project": "ai-session-notes",',
  '  "updated_local": "2026-01-16",',
  '  "skills": [',
  '    { "slug": "session", "title": "Load session commands", "summary": "Loads repo helper commands into THIS PowerShell window.", "doc": "SKILLS/session.md" },',
  '    { "slug": "sb",      "title": "Supabase CLI shortcut", "summary": "Runs Supabase CLI via npx: sb <args>", "doc": "SKILLS/sb.md" },',
  '    { "slug": "dbg",     "title": "Build a filled debug prompt", "summary": "Creates tools/prompts/debug_filled.md with repo+git+env context.", "doc": "SKILLS/dbg.md" },',
  '    { "slug": "lm",      "title": "Ask LM Studio from the repo", "summary": "Calls tools/lm_ask.ps1 against LM Studio server.", "doc": "SKILLS/lm.md" }',
  '  ]',
  '}'
) -join "`n"

$readmeContent = @(
  '# SKILLS Registry',
  '',
  'This folder is the repo source-of-truth for what skills exist.',
  '',
  '- manifest.json = machine-readable index',
  '- *.md = human instructions per skill',
  '',
  'Add a skill:',
  '1) Create SKILLS/<slug>.md',
  '2) Add entry to SKILLS/manifest.json (slug/title/summary/doc)',
  '3) Reload: . .\start.ps1',
  '4) Verify: skills then skill <slug>'
) -join "`n"

$sessionDoc = @(
  '# session',
  '',
  'Use `. .\start.ps1` (dot-space) to load repo commands into the current PowerShell window.',
  'Dot-sourcing runs the script in the current scope so functions stay available after it finishes.'
) -join "`n"

$dbgDoc = @(
  '# dbg',
  '',
  'Create a filled debug prompt, then ask LM Studio:',
  '',
  '```',
  'dbg "cmd" "error" -Files "path1","path2"',
  'lm .\tools\prompts\debug_filled.md',
  '```'
) -join "`n"

$sbDoc = @(
  '# sb',
  '',
  'Common Supabase CLI shortcuts:',
  '',
  '```',
  'sb --version',
  'sb init',
  'sb start',
  'sb db reset',
  '```'
) -join "`n"

$lmDoc = @(
  '# lm',
  '',
  'LM Studio Local Server should be running at `http://127.0.0.1:1234`.',
  '',
  'Sanity check:',
  '',
  '```',
  'Invoke-RestMethod http://127.0.0.1:1234/v1/models',
  '```',
  '',
  'Usage:',
  '',
  '```',
  'lm .\tools\prompts\debug_filled.md',
  '```'
) -join "`n"

$startPs1 = @(
  'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force',
  '',
  '$repoRoot = $PSScriptRoot',
  'if (-not $repoRoot) { $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }',
  'if (-not $repoRoot) { throw "Could not resolve repo root from start.ps1 path." }',
  '',
  'Set-Location $repoRoot',
  '. "$repoRoot\tools\session.ps1"'
) -join "`n"

$startCmd = @(
  '@echo off',
  'set "REPO=%~dp0"',
  'powershell -NoLogo -NoExit -ExecutionPolicy Bypass -Command "Set-Location ''%REPO%''; . ''.\start.ps1''"'
) -join "`n"

Write-IfDifferent (Join-Path $skillsDir "manifest.json") $manifestContent
Write-IfDifferent (Join-Path $skillsDir "README.md") $readmeContent
Write-IfMissing (Join-Path $skillsDir "session.md") $sessionDoc
Write-IfMissing (Join-Path $skillsDir "dbg.md") $dbgDoc
Write-IfMissingOrSmall (Join-Path $skillsDir "sb.md") $sbDoc
Write-IfMissingOrSmall (Join-Path $skillsDir "lm.md") $lmDoc
Write-IfDifferent (Join-Path $repoRoot "start.ps1") $startPs1
Write-IfDifferentAscii (Join-Path $repoRoot "start.cmd") $startCmd

Write-Host ""
Write-Host "Results:"
$script:Results | ForEach-Object { Write-Host $_ }
if ($script:Backups.Count -gt 0) {
  Write-Host ""
  Write-Host "Backups:"
  $script:Backups | ForEach-Object { Write-Host $_ }
}
