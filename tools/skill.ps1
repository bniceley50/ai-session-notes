param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet("journal-wrapup","help")]
  [string]$Command,

  [string]$Date
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

switch ($Command) {
  "journal-wrapup" {
    $script = Join-Path $here "journal_wrapup.ps1"
    if ($Date) { & $script -Date $Date } else { & $script }
  }
  "help" {
    Write-Host "Usage:"
    Write-Host "  .\tools\skill.ps1 journal-wrapup [-Date YYYY-MM-DD]"
  }
}
