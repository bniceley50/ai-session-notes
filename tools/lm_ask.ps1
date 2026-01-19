param(
  [Parameter(Mandatory=$true)]
  [string]$PromptFile,

  [string]$Model = "local-model",
  [int]$MaxTokens = 900,
  [double]$Temperature = 0.2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $PromptFile)) {
  throw "PromptFile not found: $PromptFile"
}

# Always a plain string
$prompt = [string](Get-Content -Raw -LiteralPath $PromptFile)

$system = @"
You are a senior debugging engineer helping on a Windows 11 Next.js repo.

Hard rules:
- Do NOT invent problems. If no error is provided, say: `"No error provided—paste the exact command + exact error output.`"
- Do NOT recommend committing/stashing as a “fix” unless the user explicitly asks about git hygiene.
- Start with the smallest, fastest verification step.
- Prefer ONE file change max. Name the file. If you need multiple files, propose the smallest single-file workaround first.
- If you are uncertain, give 2–3 hypotheses and the fastest discriminating test for each.
- Output format:
  1) What I think is happening (1–2 lines)
  2) Fastest test (exact command)
  3) Smallest fix (one file max) OR ask for missing info
"@

# Prefer explicit loopback IP
$chatUri = "http://127.0.0.1:1234/v1/chat/completions"
$compUri = "http://127.0.0.1:1234/v1/completions"

function Invoke-LM {
  param([string]$Uri, [hashtable]$BodyObj)

  $body = ($BodyObj | ConvertTo-Json -Depth 12)
  return Invoke-RestMethod -Method Post -Uri $Uri -ContentType "application/json" -Body $body -TimeoutSec 120
}

try {
  # Chat Completions payload
  $chatBody = @{
    model = $Model
    temperature = $Temperature
    max_tokens = $MaxTokens
    messages = @(
      @{ role="system"; content=[string]$system },
      @{ role="user";   content=[string]$prompt }
    )
  }

  $res = Invoke-LM -Uri $chatUri -BodyObj $chatBody
  $text = $res.choices[0].message.content
  Write-Output $text
}
catch {
  # If chat endpoint isn't available, try classic completions
  try {
    $compBody = @{
      model = $Model
      temperature = $Temperature
      max_tokens = $MaxTokens
      prompt = [string]("$system`n`nUSER:`n$prompt`n`nASSISTANT:`n")
    }
    $res2 = Invoke-LM -Uri $compUri -BodyObj $compBody
    $text2 = $res2.choices[0].text
    Write-Output $text2
  }
  catch {
    Write-Host "[FAIL] LM Studio request failed." -ForegroundColor Red
    Write-Host "Tried:"
    Write-Host "  $chatUri"
    Write-Host "  $compUri"
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respText = $reader.ReadToEnd()
        Write-Host "Server response:" -ForegroundColor Yellow
        Write-Host $respText
      } catch {
        Write-Host "Could not read server response body."
      }
    } else {
      Write-Host "No HTTP response received (connection issue)."
    }
    throw
  }
}

