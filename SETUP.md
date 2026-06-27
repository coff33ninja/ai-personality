# Setup

Instructions for setting up the ai-personality project from scratch.

## Prerequisites

- **Node.js** >= 18 (for the primary MCP server)
- **npm** >= 9 (ships with Node.js)
- **Python** >= 3.10 (for the Python server variant)
- **uv** >= 0.5 (for Python server — `pip install uv` or `winget install astral.uv`)
- **Git** (for skills auto-sync and version tracking)

## Clone the repository

```powershell
git clone https://github.com/coff33ninja/ai-personality.git
cd ai-personality
```

## Node.js server

```powershell
cd server
npm install
npm run build
npm start
```

The server starts on stdio and waits for MCP client connections. On first run it:

1. Creates `~/.ai-personality/personality/` with 6 default files
2. Clones `ai-skills` to `~/.ai-personality/skills/` (51 skills)
3. Prints status messages to stderr, MCP protocol on stdout

## Python server

```powershell
cd server-py
uv sync
uv run ai-personality-server
```

Same behavior as the Node.js server — identical API, resources, and tools.

## Verify it works

The server speaks JSON-RPC over stdio. To test:

```powershell
# In one terminal, start the server:
npm start

# In another terminal, send a test message:
@'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
'@ | node build/index.js
```

Or configure an MCP client (see README.md).

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_PERSONALITY_DIR` | Override personality file location | `~/.ai-personality/personality/` |

## Directory layout

```
ai-personality/
├── server/                  # Node.js MCP server
│   └── src/
│       ├── index.ts         # Server entry point (resources, tools, prompts)
│       ├── setup.ts         # Client setup logic (TOOL_CONFIGS, applySetup, 15 clients)
│       ├── personality.ts   # File I/O, validation, reflection, skills
│       ├── types.ts         # TypeScript type definitions
│       └── defaults.ts      # Embedded personality file templates
├── server-py/               # Python MCP server (identical API)
│   └── src/ai_personality/
│       ├── server.py        # Server entry point
│       ├── setup.py         # Client setup logic (TOOL_CONFIGS, apply_setup, 15 clients)
│       ├── personality.py   # File I/O, validation, reflection, skills
│       └── defaults.py      # Embedded personality file templates
├── personality/             # Local personality files (for dev)
├── scripts/
│   ├── persona.ps1          # Legacy CLI for personality management
│   └── sync-personality.ps1 # Auto-detect + configure MCP for 15 client configs
├── docs/
│   ├── AUTO-PERSONALITY-LOAD.md  # Per-client setup guide
│   └── adr/                 # Architecture Decision Records
├── SETUP.md                 # This file
├── README.md                # Project overview
├── CHANGELOG.md             # Release history
└── CONTRIBUTING.md          # Contribution guidelines
```
