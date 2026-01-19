Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$repoRoot = $PSScriptRoot
if (-not $repoRoot) { $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $repoRoot) { throw "Could not resolve repo root from start.ps1 path." }

Set-Location $repoRoot
. "$repoRoot\tools\session.ps1"
