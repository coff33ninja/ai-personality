# Auto Personality Load — Setup Guide

How to make an AI automatically load the personality at session start and reflect at session end, for each of the 15 supported clients.

The goal: the AI reads the personality files when it wakes up, behaves in character without you asking, and logs memories when the session ends — all without manual steps.

---

## Recommended: use `setup_client`

The fastest path for any client is to call the `setup_client` tool directly. It reads the loaded personality files and generates all hooks, steering files, and config snippets dynamically — the prompts are built from your actual `identity.md` and `traits.md`, not hardcoded strings.

```
Ask the AI: "call setup_client for cursor"
```

Or via any MCP client:
```json
{ "tool": "setup_client", "arguments": { "client": "cursor" } }
```

### Auto-apply mode (`apply: true`)

Pass `apply: true` to write everything to disk automatically — hooks, steering files, and MCP config entries are merged into the client's config file. Config merging supports both JSON and TOML formats. Zero manual steps.

```json
{ "tool": "setup_client", "arguments": { "client": "cursor", "apply": true } }
```

Without `apply` (or `apply: false`), the tool returns the file contents as text for you to review before committing. This is useful when you want to see what would be written first.

### When to use `apply: true` vs preview

| Situation | Use |
|-----------|-----|
| First-time setup, trust the defaults | `apply: true` |
| Want to review before writing | no `apply` (preview) |
| Already have a config and want to merge | `apply: true` (idempotent — skips if entry exists) |
| Setting up from another MCP client | no `apply` (preview to copy-paste) |

### Supported clients

| # | Client | Config Format | Has CLI | Has Hooks | Writes Files |
|---|--------|--------------|---------|-----------|-------------|
| 1 | `kiro` | JSON | yes | SessionStart + Stop | steering file |
| 2 | `cursor` | JSON | no | — | `.cursor/rules/personality.mdc` |
| 3 | `claude` | JSON | no | — | instructions text |
| 4 | `opencode` | JSON | no | — | config snippet |
| 5 | `codex` | TOML | yes | — | `.codex/AGENTS.md` |
| 6 | `copilot` | JSON | no | — | `.github/copilot-instructions.md` |
| 7 | `gemini` | JSON | yes | — | `.gemini/personality.md` |
| 8 | `antigravity` | JSON | no | — | `.gemini/antigravity/personality.md` |
| 9 | `windsurf` | JSON | no | — | `.windsurf/rules/personality.md` |
| 10 | `continue` | JSON | no | — | — |
| 11 | `augment` | JSON | no | — | `personality-setup.txt` |
| 12 | `tabnine` | JSON | yes | — | `personality-setup.txt` |
| 13 | `cline` | JSON | no | — | — |
| 14 | `roocode` | JSON | no | — | — |
| 15 | `generic` | — | no | — | `personality-setup.txt` |

---

## How it works

The `ai-personality` MCP server exposes personality data as readable resources (`personality://summary`, `personality://identity`, etc.) and tools (`reflect`, `validate`, `status`, `setup_client`). Auto-loading means telling the AI client to read those resources at session start and write a reflection at session end.

There are three mechanisms depending on the client:

- **Hooks** — event-driven prompts that fire automatically on SessionStart/Stop (Kiro only)
- **Steering/rules files** — files in known paths that the client reads at session start (Cursor `.mdc`, Windsurf rules, Codex AGENTS.md, Copilot instructions, Gemini personality)
- **MCP config merge** — adding the server entry to the client's config file so the MCP server is connected

The `setup_client` tool with `apply: true` handles all three: writes hooks (Kiro), writes steering/rules files, and merges the MCP entry into the client's config.

---

## Per-client details

### 1. Kiro

Kiro supports agent hooks that fire on `SessionStart` and `Stop`. This is the most complete auto-load setup — the AI wakes up in character every session and logs memories at session end.

**With `apply: true`:** Creates the MCP entry in `.kiro/settings/mcp.json`, writes a steering file to `.kiro/steering/{id}-personality.md`, creates a SessionStart hook and a Stop (reflect) hook.

**Without `apply`:** Returns the hook JSON and steering file content for review.

Kiro also supports a CLI command: `kiro-cli mcp add --name ai-personality --scope project --command npx --args "-y" --args "ai-personality-server"`

**Manual config path:** `~/.kiro/settings/mcp.json` (user) or `.kiro/settings/mcp.json` (project)

```json
"ai-personality": {
  "command": "npx",
  "args": ["-y", "ai-personality-server"],
  "disabled": false,
  "autoApprove": [
    "reflect", "validate", "status", "evolve",
    "skills_search", "skills_sync", "validate_cross_repo"
  ]
}
```

---

### 2. Cursor

Cursor supports MCP servers and custom rules files. With `apply: true`, the MCP entry is merged into `.cursor/mcp.json` and a rules file is written to `.cursor/rules/personality.mdc` with `alwaysApply: true`.

**Manual config path:** `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (user)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

The `.mdc` rules file ensures the AI reads `personality://summary` and `personality://identity` at the start of every chat and reflects at session end.

---

### 3. Claude Desktop

Claude Desktop does not support hooks or automatic resource loading. Personality must be injected via system prompt.

**With `apply: true`:** Merges the MCP entry into your `claude_desktop_config.json` automatically on the correct path for your platform (`%APPDATA%\Claude\claude_desktop_config.json` on Windows, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS).

**Manual config path:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

**Injecting personality:** Claude Desktop has no persistent system prompt. Use a Claude.ai Project with personality content in Project instructions, or paste the prompt manually each session.

---

### 4. OpenCode

OpenCode supports MCP natively and can inject system prompts via the `instructions` field in its config.

**With `apply: true`:** Merges the MCP entry and adds the `instructions` field to your `opencode.json` (project) or `~/.config/opencode/opencode.json` (user). Note: opencode uses `mcp` (not `mcpServers`) as the config key, and `command` is an array (not `command` + `args`).

**Manual config:**
```json
{
  "mcp": {
    "ai-personality": {
      "command": ["npx", "-y", "ai-personality-server"],
      "enabled": true,
      "url": ""
    }
  },
  "instructions": "At the start of every session, read personality://summary and personality://identity from the ai-personality MCP server. Stay in character. At session end, use the reflect tool to log significant events."
}
```

---

### 5. Codex CLI

Codex uses a TOML config file. **With `apply: true`:** The tool detects `.toml` format and merges the entry correctly using TOML syntax.

**Manual config path:** `~/.codex/config.toml` (user) or `.codex/config.toml` (project)

```toml
[mcp_servers]
[mcp_servers.ai-personality]
command = "npx"
args = ["-y", "ai-personality-server"]
```

**CLI command:** `codex mcp add ai-personality -- npx -y ai-personality-server`

**Personality file:** `.codex/AGENTS.md` — written automatically with `apply: true`.

---

### 6. GitHub Copilot

Copilot supports MCP via VS Code's `mcp.json` and chat customization via `copilot-instructions.md`.

**With `apply: true`:** Writes `.github/copilot-instructions.md` and merges the MCP entry into `.vscode/mcp.json` (or `~/.vscode/mcp.json`). Note: Copilot uses `servers` (not `mcpServers`) as the config key, and entries include `"type": "stdio"`.

**Manual config path:** `.vscode/mcp.json` (project) or `~/.vscode/mcp.json` (user)

```json
{
  "servers": {
    "ai-personality": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 7. Gemini CLI

Gemini CLI supports MCP and has a built-in CLI command for adding servers.

**CLI command:** `gemini mcp add ai-personality -s project -- npx -y ai-personality-server`

**With `apply: true`:** Writes `.gemini/personality.md` and merges into `.gemini/settings.json` (or `~/.gemini/settings.json`).

**Manual config path:** `.gemini/settings.json` (project) or `~/.gemini/settings.json` (user)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 8. Antigravity (Gemini Code Assist)

Antigravity uses a separate MCP config file under the Gemini config directory.

**With `apply: true`:** Writes `.gemini/antigravity/personality.md` and merges into `~/.gemini/config/mcp_config.json`.

**Manual config path:** `~/.gemini/config/mcp_config.json`

```json
{
  "mcpServers": {
    "ai-personality": {
      "serverUrl": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

Note: Antigravity uses `serverUrl` instead of `url`.

---

### 9. Windsurf

Windsurf supports MCP and custom rules files.

**With `apply: true`:** Writes `.windsurf/rules/personality.md` (with frontmatter for auto-loading) and merges into `~/.codeium/windsurf/mcp_config.json`.

**Manual config path:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "ai-personality": {
      "serverUrl": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

Note: Windsurf uses `serverUrl` instead of `url`, similar to Antigravity.

---

### 10. Continue.dev

Continue supports MCP servers but does not have a personality/rules file mechanism.

**With `apply: true`:** Merges the MCP entry into `~/.continue/config.json` (user) or `.continue/config.json` (project). No steering files are written.

**Manual config path:** `.continue/config.json` (project) or `~/.continue/config.json` (user)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 11. Augment Code

Augment supports MCP via a settings file. With `apply: true`, the MCP entry is merged into `~/.augment/settings.json` and a `personality-setup.txt` is written with session-start and session-end prompts.

**Manual config path:** `~/.augment/settings.json`

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 12. Tabnine

Tabnine supports MCP and has a CLI command for adding servers.

**CLI command:** `tabnine mcp add ai-personality -s project -t stdio -- npx -y ai-personality-server`

**With `apply: true`:** Writes `personality-setup.txt` and merges into `.tabnine/mcp_servers.json` (project) or `~/.tabnine/mcp_servers.json` (user).

**Manual config path:** `.tabnine/mcp_servers.json` (project) or `~/.tabnine/mcp_servers.json` (user)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 13. Cline

Cline supports MCP but does not have a personality/rules file mechanism.

**With `apply: true`:** Merges the MCP entry into `~/.cline/mcp.json`. No steering files are written.

**Manual config path:** `~/.cline/mcp.json`

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 14. Roo Code

Roo Code supports MCP via a project-level config. Does not have a personality/rules file mechanism.

**With `apply: true`:** Merges the MCP entry into `.roo/mcp.json` (project only). No steering files are written.

**Manual config path:** `.roo/mcp.json` (project)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "npx",
      "args": ["-y", "ai-personality-server"]
    }
  }
}
```

---

### 15. Generic

For any MCP-compatible client not listed above. No config files are touched — only a `personality-setup.txt` is written with session-start and session-end prompts that you paste manually.

```json
{ "tool": "setup_client", "arguments": { "client": "generic" } }
```

**Returns:** `personality-setup.txt` with two prompts:
- **Session start:** "Read personality://summary from the ai-personality MCP server and stay in character."
- **Session end:** "Call the reflect tool and log this session if anything significant happened."

Use `generic` when you have a client that supports MCP but doesn't match any of the 14 named clients above.

---

## Verifying it works

Run these commands via the AI after connecting:

```
Call status on the ai-personality server.
```

Expected output: all 6 files listed with evolution counts > 0, last reflection date populated.

```
Call validate on the ai-personality server.
```

Expected output: all cross-references valid, 0 invalid.

If you see `evolution 0, updated unknown` — the server is not finding the personality files. Check that `~/.ai-personality/personality/` exists and contains the 6 `.md` files.

---

## Personality file location

All clients use the same files at:
- **Windows**: `C:\Users\<you>\.ai-personality\personality\`
- **macOS/Linux**: `~/.ai-personality/personality/`

Override with the `AI_PERSONALITY_DIR` environment variable if you want a custom path.

The personality is portable — copy the directory to any machine and it travels with you.

---

## Quick reference: `sync-personality.ps1`

A standalone PowerShell script at `scripts/sync-personality.ps1` that auto-detects installed clients and shows their MCP configuration. Run it to see which clients are already connected and what commands you'd need to configure the rest:

```powershell
.\scripts\sync-personality.ps1
```

This script checks for installed clients by looking for their config files and binaries, then prints the `setup_client` commands and CLI commands for each.
