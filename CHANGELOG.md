# Changelog

## [0.0.1-alpha] - 2026-06-27

### Added

- **MCP server** (Node.js/TypeScript) — 8 `personality://` resources, 11 tools, 2 prompts
- **MCP server** (Python) — identical API, run via `uvx ai-personality-server`
- **6 personality files**: `identity.md`, `traits.md`, `values.md`, `rules.md`, `memories.md`, `relationships.md` — YAML frontmatter with cross-references and evolution tracking
- **Embedded defaults** — personality files auto-generate on first run if missing
- **Configurable directory** — `AI_PERSONALITY_DIR` env var overrides default `~/.ai-personality/personality/`
- **Reflection system** — `reflect` tool logs experiences/lessons to `memories.md` with `impact: under review`
- **Evolution lifecycle** — `reflect` → `evolve` (list pending) → update → `validate`
- **Bi-directional validation** — `validate` tool checks cross-references between personality files
- **Skills auto-sync** — clones `ai-skills` repo to `~/.ai-personality/skills/` on first run, `skills_sync` pulls updates
- **Skills resources** — `skills://catalog`, `skills://{name}`, `skills://file/{name}/{filename}`
- **Skills tools** — `skills_search`, `skills_sync`, `validate_cross_repo`
- **`setup_client` tool** — auto-inject personality setup for 15 AI clients (kiro, cursor, claude, opencode, codex, copilot, gemini, antigravity, windsurf, continue, augment, tabnine, cline, roocode, generic)
  - `apply: true` mode writes hooks, steering files, and MCP config entries to disk
  - TOML config support (Codex CLI) via `smol-toml` (TS) and `toml` (Python)
  - Platform-aware paths (Windows `%APPDATA%`, macOS `~/Library/...`)
- **`setup_client` `apply` parameter** — when `true`, writes all files and merges MCP config entries without overwriting
- **RAG vector search** — `search_personality`, `search_memories`, `reindex` tools
  - TS: `@xenova/transformers` embeddings (`all-MiniLM-L6-v2`), `better-sqlite3` vector store, ONNX runtime
  - Python: `fastembed` embeddings (`BAAI/bge-small-en-v1.5`), built-in `sqlite3` vector store, ONNX runtime
  - Heading-based chunking preserves document structure
  - Auto-index on start, file watcher auto-reindexes on changes
- **Docs**: README.md, SETUP.md, CHANGELOG.md, CONTRIBUTING.md, KNOWN-ISSUES.md, ADR-001, AUTO-PERSONALITY-LOAD.md, PUBLISHING.md
- **`sync-personality.ps1`** — PowerShell CLI to auto-detect and configure all 15 clients
- **`smithery.yaml`** — Smithery MCP registry deployment config
