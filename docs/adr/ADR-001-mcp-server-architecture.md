# ADR-001: MCP Server Architecture

## Status

Accepted

## Context

We need a way for AI clients (Claude Desktop, Cursor, opencode) to read and update the AI's persistent personality — identity, traits, values, rules, memories, and relationships — across sessions. The solution must:

- Work with any MCP-compatible client out of the box
- Be trivial to run (no complex setup, no cloud dependencies)
- Support a growing library of operational skills alongside personality data
- Be implementable in both Node.js (for `npx`) and Python (for `uvx`) without API divergence
- Keep user data editable (plain Markdown files), not locked in a database

## Decision

We built a **dual-implementation MCP server** using the stdio transport. The server:

1. **Serves personality files as MCP resources** (`personality://identity`, etc.) — read-only, with `personality://file/{name}` template for direct access
2. **Exposes personality operations as MCP tools** (`reflect`, `validate`, `status`, `evolve`)
3. **Auto-clones skills** from a GitHub repo on first run, served under `skills://` resources
4. **Embeds default personality templates** in the binary — no external files needed to start
5. **Supports two runtimes** with identical APIs (Node.js for `npx`, Python for `uvx`)

Key design choices:

- **Stdio transport** over HTTP — simpler for MCP clients, no port conflicts, no networking setup
- **Flat Markdown files with YAML frontmatter** — user-editable, git-trackable, no database
- **Embedded defaults** — the server is self-contained; personality files are created only if missing
- **Configurable personality directory** — env var `AI_PERSONALITY_DIR` takes precedence, otherwise always resolves to `~/.ai-personality/personality/`
- **Skills as a git clone** — independent versioning from personality, synced on demand via `skills_sync` tool
- **Cross-repo validation** — validates references going both directions (personality→skills and skills→personality)

## Consequences

### Easier

- Users run one command (`npx -y ai-personality-server`) and get a full personality system
- No database, no config file editing, no cloud service
- Personality is portable — copy the `personality/` directory to move it
- Skills are auto-discoverable — no manual install per skill
- Two runtimes mean wider compatibility (any platform with Node or Python)
- Personality directory is always `~/.ai-personality/personality/` — no ambiguity about which files are being used when running from a repo checkout
- `setup_client` tool with `apply: true` auto-configures 15 AI clients — MCP config entry, hooks, steering files all written to disk in one call

### Harder

- Two implementations must be kept in sync — changes to resources/tools require edits in both `server/` and `server-py/`
- Git operations introduce a runtime dependency on Git being installed
- Stdio transport means only one client at a time (no multi-process access to the same server)
- No access control — the server trusts the MCP client completely
- Skills sync is pull-only — no mechanism to push local skill changes back upstream
