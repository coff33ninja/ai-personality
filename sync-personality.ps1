#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Auto-detect AI clients in the current project and configure them to use ai-personality MCP server.
.DESCRIPTION
    Scans known config file locations for each supported AI client, detects whether
    ai-personality is already configured, and generates the needed config snippets,
    CLI commands, and personality files.
#>

$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }

$ToolConfigs = @{
    kiro        = @{ configKey = "mcpServers"; hasCli = $true;  configFiles = @(".kiro/settings/mcp.json",                                     [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".kiro", "settings", "mcp.json")) }
    cursor      = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @(".cursor/mcp.json",                                             [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".cursor", "mcp.json")) }
    claude      = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @([IO.Path]::Combine([Environment]::GetFolderPath("ApplicationData"), "Claude", "claude_desktop_config.json")) }
    opencode    = @{ configKey = "mcp";        hasCli = $false; configFiles = @("opencode.json",                                                [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".config", "opencode", "opencode.json")) }
    codex       = @{ configKey = "mcp_servers"; hasCli = $true; configFiles = @(".codex/config.toml",                                          [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".codex", "config.toml")) }
    copilot     = @{ configKey = "servers";    hasCli = $false; configFiles = @(".vscode/mcp.json",                                            [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".vscode", "mcp.json")) }
    gemini      = @{ configKey = "mcpServers"; hasCli = $true;  configFiles = @(".gemini/settings.json",                                      [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".gemini", "settings.json")) }
    antigravity = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @([IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".gemini", "config", "mcp_config.json")) }
    windsurf    = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @([IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".codeium", "windsurf", "mcp_config.json")) }
    continue    = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @(".continue/config.json",                                      [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".continue", "config.json")) }
    augment     = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @([IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".augment", "settings.json")) }
    tabnine     = @{ configKey = "mcpServers"; hasCli = $true;  configFiles = @(".tabnine/mcp_servers.json",                                  [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".tabnine", "mcp_servers.json")) }
    cline       = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @([IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), ".cline", "mcp.json")) }
    roocode     = @{ configKey = "mcpServers"; hasCli = $false; configFiles = @(".roo/mcp.json") }
}

$StdioEntry = @{
    command = "npx"
    args    = @("-y", "ai-personality-server")
}

$StdioEntryArray = @{
    command = @("npx", "-y", "ai-personality-server")
}

$CliCommands = @{
    kiro    = 'kiro-cli mcp add --name ai-personality --scope project --command npx --args "-y" --args "ai-personality-server"'
    codex   = "codex mcp add ai-personality -- npx -y ai-personality-server"
    gemini  = "gemini mcp add ai-personality -s project -- npx -y ai-personality-server"
    tabnine = 'tabnine mcp add ai-personality -s project -t stdio -- npx -y ai-personality-server'
}

$PersonalityDirMap = @{
    cursor   = @{ dir = ".cursor/rules";      file = "personality.mdc" }
    codex    = @{ dir = ".codex";              file = "AGENTS.md" }
    copilot  = @{ dir = ".github";             file = "copilot-instructions.md" }
    gemini   = @{ dir = ".gemini";             file = "personality.md" }
    windsurf = @{ dir = ".windsurf/rules";     file = "personality.md" }
}

function Resolve-PathSafe {
    param([string]$Path)
    if ($Path.StartsWith("~/")) {
        return [IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), $Path.Substring(2))
    }
    if ([IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return [IO.Path]::Combine($ProjectRoot, $Path)
}

function Test-ConfigHasPersonality {
    param([string]$ConfigPath, [string]$ConfigKey)
    if (-not (Test-Path -LiteralPath $ConfigPath)) { return $false }
    try {
        $json = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $servers = $json.$ConfigKey
        return $null -ne $servers -and ($servers.PSObject.Properties.Name -contains "ai-personality")
    } catch {
        return $false
    }
}

function Get-ConfigSnippet {
    param([string]$ConfigKey)
    $entry = if ($ConfigKey -eq "mcp") { $StdioEntryArray } else { $StdioEntry }
    if ($ConfigKey -eq "servers") { $entry["type"] = "stdio" }
    $snippet = @{ $ConfigKey = @{ "ai-personality" = $entry } }
    if ($ConfigKey -eq "mcp") { $snippet[$ConfigKey]["ai-personality"]["enabled"] = $true }
    return ($snippet | ConvertTo-Json -Depth 10)
}

Write-Host "=== ai-personality Sync ===" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot`n"

$Found = 0
$NotConfigured = 0
$Configured = 0

foreach ($client in $ToolConfigs.Keys | Sort-Object) {
    $cfg = $ToolConfigs[$client]
    $configFilesExist = $false
    $anyConfigured = $false
    $foundPaths = @()

    foreach ($cf in $cfg.configFiles) {
        $resolved = Resolve-PathSafe -Path $cf
        if (Test-Path -LiteralPath $resolved -PathType Leaf) {
            $configFilesExist = $true
            $foundPaths += $resolved
            if (Test-ConfigHasPersonality -ConfigPath $resolved -ConfigKey $cfg.configKey) {
                $anyConfigured = $true
            }
        }
    }

    if (-not $configFilesExist) { continue }
    $Found++

    if ($anyConfigured) {
        Write-Host "[$([Char]0x2713)] $client — already configured" -ForegroundColor Green
        $Configured++
        continue
    }

    $NotConfigured++
    Write-Host "[$([Char]0x2717)] $client — not configured" -ForegroundColor Yellow
    Write-Host "   Config file(s):" -ForegroundColor Gray
    foreach ($fp in $foundPaths) {
        Write-Host "     $fp" -ForegroundColor Gray
    }

    if ($cfg.hasCli -and $CliCommands.ContainsKey($client)) {
        Write-Host "   CLI command:" -ForegroundColor Gray
        Write-Host "     $($CliCommands[$client])" -ForegroundColor White
    }

    $snippet = Get-ConfigSnippet -ConfigKey $cfg.configKey
    Write-Host "   Config snippet:" -ForegroundColor Gray
    $snippet.Split("`n") | ForEach-Object { Write-Host "     $_" -ForegroundColor White }

    if ($PersonalityDirMap.ContainsKey($client)) {
        $pd = $PersonalityDirMap[$client]
        $personalityFile = [IO.Path]::Combine($ProjectRoot, $pd.dir, $pd.file)
        Write-Host "   Personality file: $personalityFile" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Clients detected: $Found"
Write-Host "Already configured: $Configured"
Write-Host "Needs setup: $NotConfigured" -ForegroundColor $(if ($NotConfigured -gt 0) { "Yellow" } else { "Green" })

if ($NotConfigured -gt 0) {
    Write-Host "`nTo configure manually, pick one of these methods per client:" -ForegroundColor Cyan
    Write-Host "  A) Run the CLI command shown above (for kiro, codex, gemini, tabnine)" -ForegroundColor Gray
    Write-Host "  B) Merge the config snippet into the config file listed" -ForegroundColor Gray
    Write-Host "  C) Use the MCP server's setup_client tool from within your AI client" -ForegroundColor Gray
}
