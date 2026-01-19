param(
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
  [switch]$NoClipboard
)

function Find-RepoRoot {
  $dir = (Resolve-Path ".").Path
  while ($true) {
    if (Test-Path (Join-Path $dir ".git")) { return $dir }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  throw "Could not find repo root (.git). Run this from inside the repo."
}

function Ensure-File($path, $template) {
  if (!(Test-Path $path)) {
    $template | Set-Content -Encoding UTF8 $path
    Write-Host "[WARN] Created missing file: $path"
  }
}

$root = Find-RepoRoot

$contextPath   = Join-Path $root "CONTEXT.md"
$nextPath      = Join-Path $root "NEXT.md"
$decisionsPath = Join-Path $root "DECISIONS.md"
$journalDir    = Join-Path $root "JOURNAL"
$journalPath   = Join-Path $journalDir "$Date.md"

Ensure-File $contextPath @"
# CONTEXT
Project: AI Session Notes MVP (internal tool)
Goal: Reduce time-to-note by 20%+.
Stack: Next.js + Supabase + Vercel, transcription vendor TBD.
Current state: (update this)
Constraints: No PHI in logs. No PHI committed to GitHub.
"@

Ensure-File $nextPath @"
# NEXT (pick 1-3)
- [ ] Next step 1
- [ ] Next step 2
- [ ] Next step 3
"@

Ensure-File $decisionsPath @"
# DECISIONS (PHI-free)
- YYYY-MM-DD: Decision -> Why -> Tradeoff
"@

Ensure-File $journalPath @"
# JOURNAL $Date (PHI-free)
- What I tried:
- What worked:
- What broke:
- Commands I ran:
- Files changed:
- Lessons learned:
"@

$context   = Get-Content -Raw $contextPath
$next      = Get-Content -Raw $nextPath
$decisions = Get-Content -Raw $decisionsPath
$journal   = Get-Content -Raw $journalPath

$outPath = Join-Path $journalDir "_wrapup_prompt_$Date.md"

$prompt = @"
You are the "Build Journal Wrap-Up" skill.

TASK:
Create a Build Journal Wrap-Up Pack based on the inputs below.

OUTPUT (exactly these 4 sections, with headings):
1) Facebook-friendly story version
   - short, upbeat, real
   - NO tech overload
   - NO PHI, NO names, NO org identifiers, NO keys
   - 6-12 sentences max

2) Technical changelog version
   - bullets, practical
   - include: commands run, files touched, what changed, what we learned
   - mention blockers + how we fixed/avoided them
   - keep it scannable

3) Next Session Kickoff checklist (3 steps max)
   - only the next 3 moves
   - each step should be executable and concrete

4) Codex task prompt (ONE change only)
   - exactly ONE change
   - exactly ONE file max
   - include: file path, what to change, acceptance criteria, and ONE gate command to run after
   - do NOT suggest additional changes

STYLE RULES:
- Assume builder is doing this to prove they can finish a real build.
- Keep it forward-moving.
- If there's uncertainty, be explicit and pick a reasonable default.

INPUTS:

[CONTEXT.md]
$context

[NEXT.md]
$next

[DECISIONS.md]
$decisions

[JOURNAL/$Date.md]
$journal
"@

$prompt | Set-Content -Encoding UTF8 $outPath

if (-not $NoClipboard) {
  try {
    Set-Clipboard -Value $prompt
    Write-Host "[OK] Copied wrap-up prompt to clipboard."
  } catch {
    Write-Host "[WARN] Could not copy to clipboard. Prompt still written to file."
  }
}

Write-Host "[OK] Wrote: $outPath"
Write-Host ""
Write-Host "Next: Paste the clipboard contents into ChatGPT (or Codex) to generate today's Wrap-Up Pack."
