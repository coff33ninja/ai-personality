# ai-personality-server (Python)

MCP server for self-evolving AI personality and memory. **Python edition** — install via `uvx`, `pip`, or `uv tool install`.

## Install

### uvx (recommended)
```bash
# Run directly — no install needed
uvx ai-personality-server
```

### pip
```bash
pip install ai-personality-server
ai-personality-server
```

### Local development
```bash
cd server-py
uv venv
uv pip install -e .
ai-personality-server
```

## MCP Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "uvx",
      "args": ["ai-personality-server"]
    }
  }
}
```

Or via `pip`:

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "ai-personality-server"
    }
  }
}
```

## What it exposes

Same as the TypeScript version:

- **Resources**: `personality://identity`, `traits`, `values`, `rules`, `memories`, `relationships`, `summary`, `all`, `file/{name}`
- **Tools**: `reflect`, `validate`, `status`, `evolve`, `setup_client`
- **Prompts**: `personality`, `reflect`

### `setup_client` tool

Auto-configures any of **15 AI clients** to load the personality automatically. Pass `{ client: "cursor" }` for a preview, or `{ client: "cursor", apply: true }` to write hooks, steering files, and MCP config entries to disk directly. Supports JSON and TOML config formats.

Supported clients: `kiro`, `cursor`, `claude`, `opencode`, `codex`, `copilot`, `gemini`, `antigravity`, `windsurf`, `continue`, `augment`, `tabnine`, `cline`, `roocode`, `generic`.

Personality files auto-create at `~/.ai-personality/personality/` on first run. Set `AI_PERSONALITY_DIR` to override.
