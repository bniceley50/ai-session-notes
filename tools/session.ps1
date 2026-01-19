param(
  [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Resolve repo root based on this script's location (portable across drive letters) ---
$script:repoRoot = $null
try {
  $scriptDir = $PSScriptRoot
  if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
  if (-not $scriptDir) { throw "Could not determine session.ps1 directory." }

  # session.ps1 lives in <repo>\tools\session.ps1  -> repo root is one level up
  $script:repoRoot = Resolve-Path (Join-Path $scriptDir "..")
  Set-Location $script:repoRoot
} catch {
  throw ("Failed to resolve repo root from session.ps1 location. Error: " + $_.Exception.Message)
}

function repo { return $script:repoRoot.Path }

# --- Supabase shortcut (always uses npx supabase@latest) ---
function sb { npx -y supabase@latest @args }

# --- LM Studio helpers ---
function Get-LMDefaultModel {
  try {
    $models = Invoke-RestMethod "http://127.0.0.1:1234/v1/models" -TimeoutSec 5
    return $models.data[0].id
  } catch {
    throw "LM Studio server not reachable on http://127.0.0.1:1234. Open LM Studio and enable the Local Server."
  }
}

function lm {
  param(
    [Parameter(Mandatory=$true)][string]$PromptFile,
    [string]$Model,
    [int]$MaxTokens = 900,
    [double]$Temperature = 0.2
  )

  $ask = Join-Path (repo) "tools\lm_ask.ps1"
  if (!(Test-Path -LiteralPath $ask)) { throw "Missing script: $ask" }
  if (!(Test-Path -LiteralPath $PromptFile)) { throw "PromptFile not found: $PromptFile" }

  if (-not $Model) { $Model = Get-LMDefaultModel }

  & $ask -PromptFile $PromptFile -Model $Model -MaxTokens $MaxTokens -Temperature $Temperature
}

# --- Build a filled debug prompt you can feed to LM Studio (repo-aware) ---
function dbg {
  param(
    [Parameter(Mandatory=$true)][string]$WhatIRan,
    [Parameter(Mandatory=$true)][string]$ErrorOutput,
    [string[]]$Files
  )

  $outDir  = Join-Path (repo) "tools\prompts"
  $outFile = Join-Path $outDir "debug_filled.md"
  New-Item -ItemType Directory -Force $outDir | Out-Null

  $nodeVer = try { node -v } catch { "(unknown)" }
  $pnpmVer = try { pnpm -v } catch { "(unknown)" }
  $head    = try { git rev-parse --short HEAD } catch { "(no git head)" }
  $status  = try { git status --porcelain=v1 } catch { "(git status failed)" }
  $diff    = try { git diff --stat } catch { "(git diff --stat failed)" }
  $ts      = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

  $body = @"
# DEBUG REQUEST

## Timestamp
$ts

## Repo
$(repo)

## Environment
- Windows 11
- Node: $nodeVer
- pnpm: $pnpmVer
- Git HEAD: $head

## What I ran
$WhatIRan

## Error output
$ErrorOutput

## Git status (porcelain)
$status

## Git diff --stat
$diff
"@

  if ($Files -and $Files.Count -gt 0) {
    $body += "`n## Relevant files (snippets)`n"
    foreach ($f in $Files) {
      $p = $f
      if (-not [System.IO.Path]::IsPathRooted($p)) { $p = Join-Path (repo) $f }

      $body += "`n### $f`n"
      if (Test-Path -LiteralPath $p) {
        $snippet = (Get-Content -LiteralPath $p -TotalCount 240) -join "`n"
        $body += "```text`n$snippet`n```n"
      } else {
        $body += "(not found: $p)`n"
      }
    }
  }

  $body | Set-Content -LiteralPath $outFile -Encoding UTF8
  Write-Host "[OK] Wrote $outFile"
  Write-Host "Next: lm .\tools\prompts\debug_filled.md"
}

function lm_debug {
  param(
    [Parameter(Mandatory=$true)][string]$WhatIRan,
    [Parameter(Mandatory=$true)][string]$ErrorOutput,
    [string[]]$Files
  )
  dbg -WhatIRan $WhatIRan -ErrorOutput $ErrorOutput -Files $Files
  lm  (Join-Path (repo) "tools\prompts\debug_filled.md")
}

# --- Skills registry helpers ---
function Get-SkillsManifestPath { return (Join-Path (repo) "SKILLS\manifest.json") }

function Get-SkillsManifest {
  $p = Get-SkillsManifestPath
  if (!(Test-Path -LiteralPath $p)) { throw "Skills manifest not found: $p" }
  try { return (Get-Content -Raw -LiteralPath $p | ConvertFrom-Json) }
  catch { throw "Could not parse skills manifest JSON: $p" }
}

function skills {
  param([switch]$Json)
  $m = Get-SkillsManifest
  if ($Json) { ($m | ConvertTo-Json -Depth 10); return }
  $m.skills | Select-Object slug,title,summary,doc | Sort-Object slug | Format-Table -AutoSize
}

function skill {
  param([Parameter(Mandatory=$true)][string]$Slug)

  $m = Get-SkillsManifest
  $hit = $m.skills | Where-Object { $_.slug -eq $Slug }

  if (!$hit) {
    Write-Host "[FAIL] Unknown skill: $Slug" -ForegroundColor Red
    Write-Host "Available:" -ForegroundColor Yellow
    ($m.skills | Sort-Object slug | ForEach-Object { "  - " + $_.slug }) | Write-Host
    return
  }

  $docRel = [string]$hit.doc
  $docAbs = if ([System.IO.Path]::IsPathRooted($docRel)) { $docRel } else { Join-Path (repo) $docRel }

  if (!(Test-Path -LiteralPath $docAbs)) {
    Write-Host "[FAIL] Skill doc missing: $docAbs" -ForegroundColor Red
    return
  }

  Write-Host ""
  Write-Host ("=== skill: " + $hit.slug + " ===") -ForegroundColor Cyan
  Write-Host ($hit.title) -ForegroundColor Cyan
  Write-Host ""
  Get-Content -LiteralPath $docAbs
  Write-Host ""
}

# --- Mini session banner / reminders ---
if (-not $Quiet) {
  Write-Host ""
  Write-Host "=== SESSION LOADED ==="
  Write-Host ("Repo: " + (repo))
  try { Write-Host ("Git:  " + (git status -sb)) } catch {}
  try { Write-Host ("Node: " + (node -v) + " | pnpm: " + (pnpm -v)) } catch {}
  Write-Host ""
  Write-Host "Commands now available in THIS PowerShell window:"
  Write-Host "  sb <args>                              (supabase cli via npx)"
  Write-Host "  dbg '<cmd you ran>' '<error text>' [-Files path1,path2]"
  Write-Host "  lm  .\tools\prompts\debug_filled.md     (asks LM Studio; auto-picks first model)"
  Write-Host "  repo                                   (prints repo root)"
  Write-Host "  skills                                 (list available /skills)"
  Write-Host "  skill <slug>                            (show one skill doc)"
  Write-Host ""
  Write-Host "Discipline: ONE change at a time. Gate after. No wandering."
  Write-Host ""
}
