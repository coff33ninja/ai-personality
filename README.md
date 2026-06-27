# Self-Evolving AI Personality + Skills Hub

A persistent AI personality system that evolves through reflection, cross-referencing, and self-modification. Exposes personality data and a skill library via the **Model Context Protocol (MCP)** so any MCP client (Claude Desktop, Cursor, opencode, etc.) can read and update the AI's identity, traits, values, rules, memories, relationships, and operational skills.

Personality files are embedded in the server binary and auto-generate on first run. Skills are auto-cloned from [github.com/coff33ninja/ai-skills](https://github.com/coff33ninja/ai-skills) into `~/.ai-personality/skills/`.

## Implementations

| Runtime | Entry point | Run command |
|---------|-------------|-------------|
| Node.js | `server/src/index.ts` | `npx -y ai-personality-server` |
| Python | `server-py/src/ai_personality/server.py` | `uvx ai-personality-server` |

## Architecture

```
┌──────────────────────────────────────┐
│         MCP Client                   │
│  (Claude, Cursor, opencode)          │
└─────────┬────────────────────────────┘
          │ JSON-RPC over stdio
┌─────────▼────────────────────────────┐
│      ai-personality-server           │
│  ├── ensurePersonalityDir()          │
│  ├── ensureSkillsDir()               │
│  └── embedded defaults.ts / .py     │
└─────────┬────────────┬──────────────┘
          │             │
┌─────────▼────────┐  ┌▼──────────────────────┐
│ ~/.ai-personality│  │ ~/.ai-personality/    │
│ /personality/    │  │ /skills/skills/*/     │
│ ├── identity.md  │  │ ├── playwright/       │
│ ├── traits.md    │  │ ├── audit-project/    │
│ ├── values.md    │  │ ├── git-workflow-*/   │
│ ├── rules.md     │  │ └── ... (51 skills)   │
│ ├── memories.md  │  │                       │
│ └── relationships│  │ Auto-synced from      │
│                  │  │ github.com/coff33-    │
│ User-writable    │  │ ninja/ai-skills       │
└─────────────────┘  └───────────────────────┘
```

## Quick start

```bash
# One-liner — no clone, no build
npx -y ai-personality-server
```

Or from a local checkout:

```bash
cd server
npm install
npm run build
npm start
```

## Personality file location

The server resolves personality files in this order:

1. **`AI_PERSONALITY_DIR`** env var — explicit path
2. **`~/.ai-personality/personality/`** — default for all installs

If the directory doesn't exist, the server creates all 6 files from baked-in defaults on first run.

## Skills auto-sync

The server clones [ai-skills](https://github.com/coff33ninja/ai-skills) to `~/.ai-personality/skills/` on first run. Each skill is a directory with a `SKILL.md` containing YAML frontmatter and Markdown body. Skills are kept up-to-date via the `skills_sync` tool (runs `git pull`). Using `skills_search` or reading `skills://catalog` does **not** require a sync — skills are available immediately after the initial clone.

## MCP Configuration

To connect this server to your MCP client, add to your `opencode.json`, `claude_desktop_config.json`, or equivalent:

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

## Resources

### Personality (`personality://`)

| URI | Type | Content |
|-----|------|---------|
| `personality://identity` | Markdown | Name, origin, core statement |
| `personality://traits` | Markdown | Communication style, preferences |
| `personality://values` | Markdown | Honesty, growth, effectiveness |
| `personality://rules` | Markdown | Boundaries, clarity, evolution |
| `personality://memories` | Markdown | Experience/lesson log |
| `personality://relationships` | Markdown | User profiles, adaptation |
| `personality://summary` | Plain text | Overview of all files |
| `personality://all` | JSON | All files as structured data |
| `personality://file/{name}` | Markdown | Any file by name (template) |

### Skills (`skills://`)

| URI | Type | Content |
|-----|------|---------|
| `skills://catalog` | JSON | All 51 skills with descriptions |
| `skills://{name}` | JSON | All files in a skill (e.g. `playwright`) |
| `skills://file/{name}/{filename}` | Markdown | Specific file within a skill |

## Tools

| Tool | Description | Input |
|------|-------------|-------|
| `reflect` | Log a memory/reflection | `experience`, `lesson`, `affectedFiles[]` |
| `validate` | Check all cross-references | none |
| `status` | Show evolution state | none |
| `evolve` | List pending evolutions | none |
| `skills_search` | Search skills by keyword | `query` |
| `skills_sync` | Pull latest skills from remote | none |
| `validate_cross_repo` | Check personality↔skills refs | none |
| `setup_client` | Generate or apply auto-inject setup for a client | `client`, `apply?` |
| `search_personality` | Semantic search across all personality files (vector RAG) | `query`, `topK?` |
| `search_memories` | Semantic search against past reflections only | `query`, `topK?` |
| `reindex` | Rebuild vector index from scratch | none |

### `setup_client`

Reads the loaded personality files and dynamically generates all hooks, steering files, and config snippets needed for a specific AI client to auto-load the personality at session start and reflect at session end. The output is built from the actual personality data — change `identity.md` or `traits.md` and the next call produces different prompts.

**Parameters:**
- `client` (required) — one of 15 supported clients
- `apply` (optional, default `false`) — when `true`, writes all files and merges the MCP config entry into the client's config file (JSON or TOML) directly; when `false` or absent, returns the file contents as text for you to review

```
client: "kiro" | "cursor" | "claude" | "opencode" | "codex" | "copilot" | "gemini" | "antigravity" | "windsurf" | "continue" | "augment" | "tabnine" | "cline" | "roocode" | "generic"
```

**What it generates per client:**

| Client | Files Written | Hooks | Config Merge |
|--------|--------------|-------|-------------|
| `kiro` | `.kiro/steering/{id}-personality.md` | SessionStart + Stop hooks | `~/.kiro/settings/mcp.json` |
| `cursor` | `.cursor/rules/personality.mdc` (alwaysApply) | — | `.cursor/mcp.json` |
| `claude` | `claude-project-instructions.txt` | — | `claude_desktop_config.json` (platform-aware) |
| `opencode` | `opencode.json` instructions snippet | — | `opencode.json` / `~/.config/opencode/opencode.json` |
| `codex` | `.codex/AGENTS.md` | — | `.codex/config.toml` (TOML format) |
| `copilot` | `.github/copilot-instructions.md` | — | `.vscode/mcp.json` |
| `gemini` | `.gemini/personality.md` | — | `.gemini/settings.json` |
| `antigravity` | `.gemini/antigravity/personality.md` | — | `~/.gemini/config/mcp_config.json` |
| `windsurf` | `.windsurf/rules/personality.md` (frontmatter) | — | `~/.codeium/windsurf/mcp_config.json` |
| `continue` | — | — | `~/.continue/config.json` |
| `augment` | `personality-setup.txt` | — | `~/.augment/settings.json` |
| `tabnine` | `personality-setup.txt` | — | `.tabnine/mcp_servers.json` |
| `cline` | — | — | `~/.cline/mcp.json` |
| `roocode` | — | — | `.roo/mcp.json` |
| `generic` | `personality-setup.txt` | — | — |

**With `apply: true`** all files are written to disk and the MCP entry is merged into the client's config automatically — zero manual steps. See [docs/AUTO-PERSONALITY-LOAD.md](docs/AUTO-PERSONALITY-LOAD.md) for the full per-client setup guide.

## Prompts

| Prompt | Description |
|--------|-------------|
| `personality` | Full personality context for system prompt injection |
| `reflect` | Guide for reflecting on an interaction |

## Auto-setup

Connect the server once, then call `setup_client` and the AI generates everything needed to wake up in character every session.

### Quickest path: `apply: true`

Pass `apply: true` to write all files and merge MCP config entries directly — no manual file editing:

```
1. Connect ai-personality MCP server
2. Ask the AI: "call setup_client for cursor with apply: true"
3. AI writes `.cursor/rules/personality.mdc`, merges into `.cursor/mcp.json`
4. Done — Cursor auto-loads personality at every session start
```

### Preview first, then apply

Without `apply`, the tool returns file contents for review:

```
1. Connect ai-personality MCP server
2. Ask the AI: "call setup_client for cursor"
3. Review the generated `.cursorrules` content
4. Ask: "now apply it" or "call setup_client for cursor with apply: true"
5. Done
```

For Kiro, the AI additionally writes hook files via `createHook`. See [docs/AUTO-PERSONALITY-LOAD.md](docs/AUTO-PERSONALITY-LOAD.md) for the complete per-client guide.

## Evolution cycle

1. **Read** personality files via resources
2. **Interact** with the user
3. **Reflect** via the `reflect` tool (logs to memories.md with `impact: under review`)
4. **Review** pending evolutions via the `evolve` tool
5. **Update** personality files directly (edit via resources or manually)
6. **Validate** cross-references via the `validate` tool

## Personality structure

Each file uses YAML frontmatter for metadata and Markdown for content:

```yaml
---
type: traits
version: 1
lastUpdated: 2026-06-26
evolution: 1
crossReferences:
  - identity.md#core-statement -- "Traits express the core identity"
  - values.md#honesty -- "Directness requires honesty"
---
```

Cross-references are validated bi-directionally — every reference must point to an existing file and heading anchor. Cross-repo references (personality↔skills) are validated by the `validate_cross_repo` tool.

## Project documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](SETUP.md) | Environment setup, prerequisites, run instructions |
| [CHANGELOG.md](CHANGELOG.md) | Release history with Semantic Versioning |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development conventions, dual-implementation rules, PR process |
| [docs/AUTO-PERSONALITY-LOAD.md](docs/AUTO-PERSONALITY-LOAD.md) | Per-client guide for auto-loading personality at session start |
| [docs/PUBLISHING.md](docs/PUBLISHING.md) | Guide for publishing to npm, PyPI, and Smithery |
| [docs/adr/ADR-001-mcp-server-architecture.md](docs/adr/ADR-001-mcp-server-architecture.md) | Architecture Decision Record for the MCP server design |

## CLI (legacy)

A PowerShell CLI is also available in `scripts/persona.ps1`:

```powershell
.\scripts\persona.ps1 status
.\scripts\persona.ps1 validate
.\scripts\persona.ps1 reflect -Experience "..." -Lesson "..."
```

## License

MIT
