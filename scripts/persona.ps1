<#
.SYNOPSIS
  Self-Evolving AI Personality CLI — manage personality lifecycle
.DESCRIPTION
  Commands: init, status, validate, diff, reflect, evolve
.PARAMETER Command
  The command to run (init, status, validate, diff, reflect, evolve)
.PARAMETER Experience
  Description of the experience (for reflect command)
.PARAMETER Lesson
  Lesson learned (for reflect command)
.PARAMETER Files
  Files affected by the reflection (for reflect command, comma-separated)
#>

param(
  [Parameter(Position = 0)]
  [ValidateSet("init", "status", "validate", "diff", "reflect", "evolve")]
  [string]$Command,

  [string]$Experience,
  [string]$Lesson,
  [string]$Files
)

$PersonalityDir = Join-Path -Path $PSScriptRoot -ChildPath "..\personality"

function Invoke-Init {
  Write-Host "[*] Initializing personality..."
  $files = @("identity.md", "traits.md", "values.md", "rules.md", "memories.md", "relationships.md")
  $existing = 0
  foreach ($f in $files) {
    $path = Join-Path -Path $PersonalityDir -ChildPath $f
    if (Test-Path $path) { $existing++ }
  }
  Write-Host "[+] $existing of $($files.Count) personality files exist"
  $gitDir = Join-Path -Path $PSScriptRoot -ChildPath "..\.git"
  if (-not (Test-Path $gitDir)) {
    Write-Host "[!] Git not initialized. Run 'git init' to track personality evolution."
  } else {
    Write-Host "[+] Git repository detected. Personality evolution will be tracked."
  }
}

function Invoke-Status {
  Write-Host "[*] Personality status"
  Write-Host ""
  $files = Get-ChildItem -Path $PersonalityDir -Filter "*.md" | Sort-Object Name
  if ($files.Count -eq 0) {
    Write-Host "[-] No personality files found. Run 'init' first."
    return
  }
  foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName -Raw
    if ($content -match 'evolution: (\d+)') {
      $evolution = $Matches[1]
    } else { $evolution = "?" }
    if ($content -match 'lastUpdated: ([\d-]+)') {
      $updated = $Matches[1]
    } else { $updated = "?" }
    $crossRefs = 0
    if ($content -match 'crossReferences:') {
      $crossRefs = ([regex]::Matches($content, "- .*#")).Count
    }
    Write-Host "  $($f.Name) - evolution: $evolution, updated: $updated, refs: $crossRefs"
  }

  $gitDir = Join-Path -Path $PSScriptRoot -ChildPath "..\.git"
  if (Test-Path $gitDir) {
    Write-Host ""
    Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..")
    $log = git log --oneline -5 2>$null
    if ($log) {
      Write-Host "[+] Recent evolution commits:"
      $log | ForEach-Object { Write-Host "     $_" }
    } else {
      Write-Host "[-] No evolution commits yet."
    }
    Pop-Location
  }
}

function Invoke-Validate {
  Write-Host "[*] Validating cross-references..."
  $files = Get-ChildItem -Path $PersonalityDir -Filter "*.md" | Sort-Object Name
  $allRefs = @{}
  $errors = 0

  # Build index of all anchors
  foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName
    $anchors = @()
    foreach ($line in $content) {
      if ($line -match '^## (.+)') {
        $anchor = $Matches[1].ToLower() -replace '\s+', '-'
        $anchors += $anchor
      }
    }
    $allRefs[$f.Name] = $anchors
  }

  # Check each file's cross-references
  foreach ($f in $files) {
    $content = Get-Content -Path $f.FullName -Raw
    if ($content -match 'crossReferences:') {
      $refs = [regex]::Matches($content, "- (\w+\.md)#(\S+) -- (.+)")
      foreach ($r in $refs) {
        $targetFile = $r.Groups[1].Value
        $targetAnchor = $r.Groups[2].Value
        $desc = $r.Groups[3].Value
        if (-not $allRefs.ContainsKey($targetFile)) {
          Write-Host "[!] $($f.Name) -> $targetFile#$targetAnchor : FILE NOT FOUND"
          $errors++
        } elseif ($targetAnchor -notin $allRefs[$targetFile]) {
          Write-Host "[!] $($f.Name) -> $targetFile#$targetAnchor : ANCHOR NOT FOUND ($desc)"
          $errors++
        } else {
          Write-Host "[+] $($f.Name) -> $targetFile#$targetAnchor : OK ($desc)"
        }
      }
    }
  }

  if ($errors -eq 0) {
    Write-Host "[+] All cross-references valid."
  } else {
    Write-Host "[!] $errors cross-reference errors found."
  }
}

function Invoke-Diff {
  $gitDir = Join-Path -Path $PSScriptRoot -ChildPath "..\.git"
  if (-not (Test-Path $gitDir)) {
    Write-Host "[-] Not a git repository. Nothing to diff."
    return
  }
  Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..")
  $diff = git diff --stat 2>$null
  if ($diff) {
    Write-Host "[*] Uncommitted personality changes:"
    git diff --stat
    Write-Host ""
    git diff -- personality/
  } else {
    Write-Host "[-] No uncommitted changes."
  }
  Pop-Location
}

function Invoke-Reflect {
  if (-not $Experience -or -not $Lesson) {
    Write-Host "[-] Usage: persona.ps1 reflect -Experience '...' -Lesson '...' [-Files 'file1.md,file2.md']"
    return
  }
  $memFile = Join-Path -Path $PersonalityDir -ChildPath "memories.md"
  if (-not (Test-Path $memFile)) {
    Write-Host "[-] memories.md not found. Run init first."
    return
  }

  $date = Get-Date -Format "yyyy-MM-dd"
  $affectedFiles = if ($Files) { $Files -split ',' | ForEach-Object { $_.Trim() } } else { @("memories.md") }
  $affectedStr = ($affectedFiles | ForEach-Object { "    - $_" }) -join "`n"

  $entry = @"

- date: $date
  experience: $Experience
  lesson: $Lesson
  impact: under review
  affectedFiles:
$affectedStr
"@

  Add-Content -Path $memFile -Value $entry
  Write-Host "[+] Reflection logged to memories.md"
  Write-Host "    Experience: $Experience"
  Write-Host "    Lesson: $Lesson"
  Write-Host "    Files affected: $($affectedFiles -join ', ')"
  Write-Host "[*] Consider running 'evolve' to apply any necessary personality changes."
}

function Invoke-Evolve {
  Write-Host "[*] Evolution scan..."
  $memFile = Join-Path -Path $PersonalityDir -ChildPath "memories.md"
  if (-not (Test-Path $memFile)) {
    Write-Host "[-] No memories to evolve from."
    return
  }

  $content = Get-Content -Path $memFile -Raw
  $entries = [regex]::Matches($content, "- date: (\S+)\s+  experience: (.+)\s+  lesson: (.+)\s+  impact: (.+)\s+  affectedFiles:")
  $pending = @()
  foreach ($e in $entries) {
    if ($e.Groups[4].Value -eq "under review") {
      $pending += @{ date = $e.Groups[1].Value; experience = $e.Groups[2].Value; lesson = $e.Groups[3].Value }
    }
  }

  if ($pending.Count -eq 0) {
    Write-Host "[-] No pending evolutions. Log reflections first with 'reflect'."
    return
  }

  Write-Host "[!] $($pending.Count) reflection(s) pending evolution review:"
  foreach ($p in $pending) {
    Write-Host "    $($p.date): $($p.experience) -> $($p.lesson)"
  }
  Write-Host "[*] Review each reflection and update personality files accordingly."
  Write-Host "[*] Then update the 'impact' field in memories.md to reflect changes made."
}

switch ($Command) {
  "init"     { Invoke-Init }
  "status"   { Invoke-Status }
  "validate" { Invoke-Validate }
  "diff"     { Invoke-Diff }
  "reflect"  { Invoke-Reflect }
  "evolve"   { Invoke-Evolve }
  default {
    Write-Host "Usage: persona.ps1 <command>"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  init                  Initialize personality files"
    Write-Host "  status                Show personality status"
    Write-Host "  validate              Validate cross-references"
    Write-Host "  diff                  Show uncommitted changes"
    Write-Host "  reflect -E '...' -L '...'  Log a reflection"
    Write-Host "  evolve                Scan for pending evolutions"
  }
}
