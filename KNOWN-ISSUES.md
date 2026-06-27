# Known Issues

## 1. `npx -y ai-personality-server` fails (404 Not Found)

**Status:** Unresolved — requires npm publish

The `setup_client` tools generate commands like `npx -y ai-personality-server` but this package is **not published to npm**. Attempting to use it returns a 404 error.

**Workaround:** Use a local path instead:
```
node /path/to/server/build/index.js
```

The `buildConfigEntry` in both `server/src/setup.ts` and `server-py/src/ai_personality/setup.py` auto-detects from `process.argv`/`sys.argv` so it works regardless of how the server was launched (local node, npx, uvx, etc.).

**Resolution:** Publish the package to npm, then update the reference in `TOOL_CONFIGS` or let auto-detect handle it.

---

## 2. `opencode mcp add` does not support non-interactive flags

**Status:** Unresolved — upstream limitation (opencode v1.15.3)

The `opencode mcp add` command uses an interactive TUI wizard (`@clack/prompts`) and does **not** accept non-interactive arguments (no `--name`, `--command`, `--url` flags). Non-interactive CLI flags exist on the `dev` branch but are not yet released.

**Workaround:** Create/edit the config file directly:

**Global config** (`~/.config/opencode/opencode.jsonc`):
```jsonc
{
  "mcp": {
    "ai-personality": {
      "type": "local",
      "command": ["node", "E:\\SCRIPTS\\docs\\ai-personality\\server\\build\\index.js"],
      "enabled": true
    }
  }
}
```

**Project-level config** (`<project>/opencode.json`):
```json
{
  "mcp": {
    "ai-personality": {
      "type": "local",
      "command": ["node", "E:\\SCRIPTS\\docs\\ai-personality\\server\\build\\index.js"],
      "enabled": true
    }
  }
}
```

Key requirements:
- Must include `"type": "local"` (schema requirement, defaults to local if omitted)
- `command` must be an array of strings
- Global config uses `.jsonc` extension; project config uses `.json`

---

## 3. opencode desktop GUI — use interactive wizard, NOT manual config editing

**Status:** Resolved — the interactive wizard (`opencode mcp add`) is the correct path

The opencode desktop GUI does **not** pick up MCP server entries that are manually added to `opencode.jsonc`. The wizard (`opencode mcp add`) writes to `opencode.jsonc` AND syncs the entry into the desktop's internal state (`opencode.global.dat`). Manual edits to `opencode.jsonc` are invisible to the desktop GUI.

**Verified:** After running `opencode mcp add` interactively and replacing the command with a local path, the server appeared in the desktop GUI on session restart.

**Lesson:** Always use `opencode mcp add` from a real terminal — do not manually edit the config file for desktop use. Manual edits work for opencode CLI (non-desktop) but not for the desktop app.

---

## 4. opencode config file extension mismatch

**Status:** Documented

- **Global config:** `~/.config/opencode/opencode.jsonc` (`.jsonc` extension, supports comments)
- **Project config:** `<project>/opencode.json` (`.json` extension, no comments)

The `setup.ts` and `setup.py` tools were updated to use `.jsonc` for the global path and `.json` for project paths accordingly.

---

## 5. `instructions` field must be `string[]` for opencode

**Status:** Fixed

For opencode's config, the `instructions` field must be an array of exactly two strings:
- Index 0: Session-start prompt (loaded when a new session begins)
- Index 1: End-of-session reflection prompt

Concatenating them into a single string does not work. This was fixed in `setup.ts` and `setup.py`.

---

## 6. Server tools use `process.argv`/`sys.argv` for auto-detection

**Status:** Fixed

The original server code hardcoded `["npx", "-y", "ai-personality-server"]` as the MCP server command. This was changed to auto-detect from `process.argv.slice(0,2)` (TypeScript) and `[sys.executable, sys.argv[0]]` (Python), so the config entry always references whatever command was used to launch the setup tool.
