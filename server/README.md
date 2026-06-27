# ai-personality-server

MCP server for self-evolving AI personality and memory.

## Install

### Local path (no npm publish required)

```json
{
  "mcpServers": {
    "ai-personality": {
      "command": "node",
      "args": ["D:\\scripts\\ai-personality\\server\\build\\index.js"]
    }
  }
}
```

### Via `mcp install` (local path)

```bash
npx @anthropic-ai/claude-code mcp install D:\scripts\ai-personality\server --name "ai-personality"
```

### Via `npx` (requires npm publish)

```bash
# Publish first
npm publish

# Then any client can reference:
npx -y ai-personality-server
```

Or in config:

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

### Via `mcp install` (from npm)

```bash
npx @anthropic-ai/claude-code mcp install ai-personality-server --name "ai-personality"
```

## Build

```bash
cd server
npm install
npm run build
```

## Run

```bash
npm start
```

## What it exposes

- **Resources**: `personality://identity`, `traits`, `values`, `rules`, `memories`, `relationships`, `summary`, `all`, `file/{name}`
- **Tools**: `reflect`, `validate`, `status`, `evolve`, `setup_client`
- **Prompts**: `personality`, `reflect`

### `setup_client` tool

Auto-configures any of **15 AI clients** to load the personality automatically. Pass `{ client: "cursor" }` for a preview, or `{ client: "cursor", apply: true }` to write hooks, steering files, and MCP config entries to disk directly. Supports JSON and TOML config formats.

Supported clients: `kiro`, `cursor`, `claude`, `opencode`, `codex`, `copilot`, `gemini`, `antigravity`, `windsurf`, `continue`, `augment`, `tabnine`, `cline`, `roocode`, `generic`.
