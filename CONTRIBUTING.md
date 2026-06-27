# Contributing

## Development setup

See [SETUP.md](SETUP.md) for environment setup instructions.

## Project conventions

### Code style

- **TypeScript**: `tsc` compiles; follow existing patterns in `server/src/`
- **Python**: follow existing patterns in `server-py/src/ai_personality/`
- No semicolons in Python; semicolons required in TypeScript
- Async/await for I/O; sync for file operations in personality modules
- Exported functions are the public API — keep signatures stable

### Dual-implementation rule

Changes to MCP resources, tools, or prompts must be mirrored in both:

- `server/src/index.ts` (Node.js)
- `server-py/src/ai_personality/server.py`

Changes to personality or skills business logic must be mirrored in both:

- `server/src/personality.ts` (Node.js)
- `server-py/src/ai_personality/personality.py`

Type definitions go in `server/src/types.ts` and their Python equivalents inline in `personality.py`.

### Build and test

```powershell
# Node.js
cd server
npm run build

# Python
cd server-py
uv sync
```

The server starts on stdio. Test with any MCP client or pipe JSON-RPC messages directly.

### Commit guidelines

Follow conventional commits:

- `feat:` for new resources, tools, or capabilities
- `fix:` for bug fixes
- `docs:` for documentation changes
- `refactor:` for code restructuring
- `chore:` for build/config changes

Keep commits atomic — one concern per commit.

### Documentation

- Update README.md when adding or changing resources/tools
- Add ADRs in `docs/adr/` for architectural decisions
- Update CHANGELOG.md per release
- Keep SETUP.md current with any setup step changes

## Pull request process

1. Open an issue describing the change
2. Implement in both server variants (Node.js + Python)
3. Build and verify both compile
4. Update docs (README, CHANGELOG, ADRs if applicable)
5. Open PR with a clear description of what changed and why
