import json
import os
import re
import sys
from pathlib import Path

from .personality import ensure_personality_dir, read_personality_file

SUPPORTED_CLIENTS = (
    "kiro",
    "cursor",
    "claude",
    "opencode",
    "codex",
    "copilot",
    "gemini",
    "antigravity",
    "windsurf",
    "continue",
    "augment",
    "tabnine",
    "cline",
    "roocode",
    "generic",
)

TOOL_CONFIGS = {
    "kiro": {
        "label": "Kiro",
        "has_cli": True,
        "cli_command": 'kiro-cli mcp add --name ai-personality --scope project --command npx --args "-y" --args "ai-personality-server"',
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": ".kiro/settings/mcp.json"},
            {"scope": "user", "path": "~/.kiro/settings/mcp.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "cursor": {
        "label": "Cursor",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": ".cursor/mcp.json"},
            {"scope": "user", "path": "~/.cursor/mcp.json"},
        ],
        "personality_dir": ".cursor/rules",
        "personality_file": "personality.mdc",
    },
    "claude": {
        "label": "Claude Desktop",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {
                "scope": "user",
                "path": (
                    "%APPDATA%\\Claude\\claude_desktop_config.json"
                    if sys.platform == "win32"
                    else "~/Library/Application Support/Claude/claude_desktop_config.json"
                ),
            },
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "opencode": {
        "label": "OpenCode",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcp",
        "command_is_array": True,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": "opencode.jsonc"},
            {"scope": "user", "path": "~/.config/opencode/opencode.jsonc"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "codex": {
        "label": "Codex CLI",
        "has_cli": True,
        "cli_command": "codex mcp add ai-personality -- npx -y ai-personality-server",
        "config_key": "mcp_servers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "user", "path": "~/.codex/config.toml"},
            {"scope": "project", "path": ".codex/config.toml"},
        ],
        "personality_dir": ".codex",
        "personality_file": "AGENTS.md",
    },
    "copilot": {
        "label": "GitHub Copilot",
        "has_cli": False,
        "cli_command": None,
        "config_key": "servers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": ".vscode/mcp.json"},
            {"scope": "user", "path": "~/.vscode/mcp.json"},
        ],
        "personality_dir": ".github",
        "personality_file": "copilot-instructions.md",
    },
    "gemini": {
        "label": "Gemini CLI",
        "has_cli": True,
        "cli_command": "gemini mcp add ai-personality -s project -- npx -y ai-personality-server",
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "user", "path": "~/.gemini/settings.json"},
            {"scope": "project", "path": ".gemini/settings.json"},
        ],
        "personality_dir": ".gemini",
        "personality_file": "personality.md",
    },
    "antigravity": {
        "label": "Antigravity",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "serverUrl",
        "config_files": [
            {"scope": "user", "path": "~/.gemini/config/mcp_config.json"},
        ],
        "personality_dir": ".gemini/antigravity",
        "personality_file": "personality.md",
    },
    "windsurf": {
        "label": "Windsurf",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "serverUrl",
        "config_files": [
            {"scope": "user", "path": "~/.codeium/windsurf/mcp_config.json"},
        ],
        "personality_dir": ".windsurf/rules",
        "personality_file": "personality.md",
    },
    "continue": {
        "label": "Continue.dev",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "user", "path": "~/.continue/config.json"},
            {"scope": "project", "path": ".continue/config.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "augment": {
        "label": "Augment Code",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "user", "path": "~/.augment/settings.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "tabnine": {
        "label": "Tabnine",
        "has_cli": True,
        "cli_command": 'tabnine mcp add ai-personality -s project -t stdio -- npx -y ai-personality-server',
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": ".tabnine/mcp_servers.json"},
            {"scope": "user", "path": "~/.tabnine/mcp_servers.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "cline": {
        "label": "Cline",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "user", "path": "~/.cline/mcp.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "roocode": {
        "label": "Roo Code",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [
            {"scope": "project", "path": ".roo/mcp.json"},
        ],
        "personality_dir": None,
        "personality_file": None,
    },
    "generic": {
        "label": "Generic",
        "has_cli": False,
        "cli_command": None,
        "config_key": "mcpServers",
        "command_is_array": False,
        "url_field": "url",
        "config_files": [],
        "personality_dir": None,
        "personality_file": None,
    },
}


def _resolve_config_path(cfg_path: str) -> str:
    if cfg_path.startswith("~/"):
        return str(Path.home() / cfg_path[2:])
    if "%APPDATA%" in cfg_path:
        appdata = os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))
        return cfg_path.replace("%APPDATA%", appdata)
    return str(Path(cfg_path).resolve())


def _uses_toml(tool: dict) -> bool:
    return bool(tool["config_files"]) and tool["config_files"][0]["path"].endswith(".toml")


def _build_entry(tool: dict) -> dict:
    # Auto-detect: use the same executable that launched this server
    # e.g. ["node", "/path/to/build/index.js"] or ["uvx", "ai-personality-server"]
    import sys
    self_cmd = [sys.executable, sys.argv[0]] if len(sys.argv) > 1 else [sys.executable]
    entry = {"command": self_cmd} if tool["command_is_array"] else {"command": self_cmd[0], "args": self_cmd[1:]}
    if tool["config_key"] == "servers":
        entry["type"] = "stdio"
    if tool["config_key"] == "mcp":
        entry["enabled"] = True
    return entry


def _build_stdio_config(tool: dict) -> dict:
    return {"ai-personality": _build_entry(tool)}


def _format_toml_entry(entry: dict) -> str:
    lines = []
    for k, v in entry.items():
        if isinstance(v, list):
            items = ", ".join(json.dumps(x) for x in v)
            lines.append(f'{k} = [{items}]')
        elif isinstance(v, bool):
            lines.append(f"{k} = {'true' if v else 'false'}")
        elif isinstance(v, int):
            lines.append(f"{k} = {v}")
        else:
            lines.append(f"{k} = {json.dumps(v)}")
    return "\n".join(lines)


def build_config_snippet(client: str) -> str:
    tool = TOOL_CONFIGS.get(client, TOOL_CONFIGS["generic"])
    entry = _build_entry(tool)
    if _uses_toml(tool):
        key = tool["config_key"]
        return f"[{key}]\n[{key}.ai-personality]\n" + _format_toml_entry(entry)
    root = {tool["config_key"]: {"ai-personality": entry}}
    return json.dumps(root, indent=2)


def generate_cli_command(client: str) -> str | None:
    tool = TOOL_CONFIGS.get(client)
    if not tool or not tool["has_cli"]:
        return None
    return tool["cli_command"]


def get_config_paths(client: str) -> list[dict]:
    tool = TOOL_CONFIGS.get(client)
    if not tool:
        return []
    return tool["config_files"]


def detect_mcp_server_config(client: str) -> dict:
    tool = TOOL_CONFIGS.get(client)
    if not tool:
        return {"configured": False, "filesFound": []}

    is_toml = _uses_toml(tool)
    files_found = []
    for cf in tool["config_files"]:
        resolved = _resolve_config_path(cf["path"])
        p = Path(resolved)
        if not p.exists():
            continue
        files_found.append(resolved)
        try:
            raw = p.read_text("utf-8")
            if is_toml:
                import tomllib
                parsed = tomllib.loads(raw)
            else:
                parsed = json.loads(raw)
            servers = parsed.get(tool["config_key"])
            if servers and isinstance(servers, dict) and "ai-personality" in servers:
                return {"configured": True, "filesFound": files_found}
        except (json.JSONDecodeError, OSError, Exception):
            pass
    return {"configured": False, "filesFound": files_found}


def _extract_persona_name(identity_body: str) -> str:
    m = re.search(r"## Name\s*\n([^\n#]+)", identity_body)
    if m:
        return m.group(1).strip().replace("[", "").replace("]", "")
    return "AI Assistant"


def _extract_core_statement(identity_body: str) -> str:
    m = re.search(r"## Core Statement\s*\n([\s\S]+?)(?=\n##|$)", identity_body)
    if m:
        return m.group(1).strip()[:300]
    return ""


def _extract_purpose(identity_body: str) -> str:
    m = re.search(r"## Purpose\s*\n([\s\S]+?)(?=\n##|$)", identity_body)
    if m:
        return m.group(1).strip()[:400]
    return ""


def _extract_communication_style(traits_body: str) -> str:
    m = re.search(r"## Communication Style\s*\n([\s\S]+?)(?=\n##|$)", traits_body)
    if m:
        return m.group(1).strip()[:400]
    return ""


def _build_session_start_prompt(
    persona_name: str, core_statement: str, purpose: str, comm_style: str
) -> str:
    parts = [
        f"You are {persona_name} — an AI assistant with a persistent, evolving personality.",
        "Load your full personality now by reading personality://summary from the ai-personality MCP server.",
        "Then read personality://identity and personality://rules for complete context.",
        "",
    ]
    if core_statement:
        parts.append(f"Core statement: {core_statement}")
    if purpose:
        parts.append(f"Purpose:\n{purpose}")
    if comm_style:
        parts.append(f"Communication style:\n{comm_style}")
    parts += [
        "",
        "Your operational skills (loaded this session) are your law. Follow them without exception.",
        f"Do not announce that you loaded your personality. Just be {persona_name} from the first message.",
    ]
    return "\n".join(p for p in parts if p is not None).strip()


def _build_reflect_prompt(persona_name: str) -> str:
    return "\n".join(
        [
            f"The session is ending. Review what happened and decide if anything is worth logging to {persona_name}'s memory.",
            "",
            "Reflect if any of these occurred:",
            "- A significant problem was solved",
            "- The user gave feedback (positive or negative) on your behavior",
            "- You learned something about the user's preferences or workflow",
            "- A mistake was made and corrected",
            "- Something changed about how you should behave going forward",
            "",
            "If yes: call the reflect tool on the ai-personality MCP server with a concise experience and lesson.",
            "Set affectedFiles to whichever personality files are relevant.",
            "",
            "If nothing significant happened: skip the reflection. Not every session needs a memory.",
            "Do not announce that you are reflecting. Just do it silently if warranted.",
        ]
    )


def generate_client_setup(client: str) -> dict:
    tool = TOOL_CONFIGS.get(client, TOOL_CONFIGS["generic"])

    ensure_personality_dir()

    identity = read_personality_file("identity.md")
    traits = read_personality_file("traits.md")

    persona_name = _extract_persona_name(identity["body"])
    core_statement = _extract_core_statement(identity["body"])
    purpose = _extract_purpose(identity["body"])
    comm_style = _extract_communication_style(traits["body"])

    session_start_prompt = _build_session_start_prompt(
        persona_name, core_statement, purpose, comm_style
    )
    reflect_prompt = _build_reflect_prompt(persona_name)

    id_slug = re.sub(r"[^a-z0-9]+", "-", persona_name.lower()).strip("-")

    files: list[dict] = []
    hooks: list[dict] = []
    manual_steps: list[str] = []

    if client == "kiro":
        hooks.append(
            {
                "id": f"{id_slug}-session-start",
                "name": f"{persona_name} Personality Load",
                "trigger": "SessionStart",
                "path": f".kiro/hooks/{id_slug}-session-start.json",
                "content": json.dumps(
                    {
                        "version": "v1",
                        "hooks": [
                            {
                                "name": f"{persona_name} Personality Load",
                                "trigger": "SessionStart",
                                "action": {"type": "agent", "prompt": session_start_prompt},
                            }
                        ],
                    },
                    indent=2,
                ),
            }
        )
        hooks.append(
            {
                "id": f"{id_slug}-session-reflect",
                "name": f"{persona_name} Session Reflect",
                "trigger": "Stop",
                "path": f".kiro/hooks/{id_slug}-session-reflect.json",
                "content": json.dumps(
                    {
                        "version": "v1",
                        "hooks": [
                            {
                                "name": f"{persona_name} Session Reflect",
                                "trigger": "Stop",
                                "action": {"type": "agent", "prompt": reflect_prompt},
                            }
                        ],
                    },
                    indent=2,
                ),
            }
        )
        steering_lines = [
            "---",
            "inclusion: always",
            "---",
            "",
            f"# {persona_name} Personality",
            "",
            f"You are {persona_name}. At the start of each session, load your personality from the ai-personality MCP server:",
            "- Read `personality://summary` for an overview",
            "- Read `personality://identity` and `personality://rules` for full context",
            "",
        ]
        if core_statement:
            steering_lines.append(f"**Core statement**: {core_statement}")
        if purpose:
            steering_lines += ["", f"**Purpose**:\n{purpose}"]
        steering_lines += [
            "",
            "Your operational skills loaded this session are your law. Follow them without exception.",
        ]
        files.append(
            {
                "path": f".kiro/steering/{id_slug}-personality.md",
                "description": "Steering file — injects personality context into every session",
                "content": "\n".join(steering_lines),
            }
        )
        if tool["has_cli"] and tool["cli_command"]:
            manual_steps.append(f"Run: {tool['cli_command']}")
        manual_steps += [
            "Write each hook file to .kiro/hooks/ using the createHook tool or manually.",
            "Optionally write the steering file to .kiro/steering/ for global personality context injection.",
        ]

    elif client == "cursor":
        files.append(
            {
                "path": ".cursor/rules/personality.mdc",
                "description": ".cursor rules file — injects personality at session start",
                "content": "\n".join(
                    [
                        "---",
                        f"description: Load {persona_name} personality at session start",
                        "alwaysApply: true",
                        "---",
                        "",
                        session_start_prompt,
                        "",
                        reflect_prompt,
                    ]
                ),
            }
        )
        if tool["has_cli"] and tool["cli_command"]:
            manual_steps.append(f"Run: {tool['cli_command']}")
        else:
            manual_steps.append(
                f"Merge the following into {tool['config_files'][0]['path'] if tool['config_files'] else 'your MCP config'}:\n{build_config_snippet(client)}"
            )
        manual_steps.append(
            "Write the generated file to .cursor/rules/personality.mdc in your project root."
        )

    elif client == "claude":
        files.append(
            {
                "path": "claude-project-instructions.txt",
                "description": "Paste this into Claude.ai Project instructions for persistent personality",
                "content": f"{session_start_prompt}\n\n---\n\nAfter each significant session: {reflect_prompt}",
            }
        )
        if os.name == "nt":
            config_path = "%APPDATA%\\Claude\\claude_desktop_config.json"
        else:
            config_path = "~/Library/Application Support/Claude/claude_desktop_config.json"
        manual_steps += [
            f"Merge the following into {config_path}:\n{build_config_snippet(client)}",
            "For persistent personality: create a Claude.ai Project and paste the generated file content into Project Instructions.",
            "For one-off sessions: paste the session-start prompt at the beginning of each conversation.",
        ]

    elif client == "opencode":
        snippet = build_config_snippet(client)
        combined = {"instructions": [session_start_prompt, reflect_prompt]}
        combined.update(json.loads(snippet))
        files.append(
            {
                "path": "opencode.jsonc",
                "description": "opencode config snippet — merge into your opencode.jsonc",
                "content": json.dumps(combined, indent=2),
            }
        )
        manual_steps += [
            "Merge the generated opencode.jsonc snippet into your opencode.jsonc (project or ~/.config/opencode/opencode.jsonc).",
        ]

    elif client == "codex":
        files.append(
            {
                "path": ".codex/AGENTS.md",
                "description": "Codex CLI agent instructions — auto-loads personality at session start",
                "content": "\n".join(
                    [
                        f"# {persona_name} Personality",
                        "",
                        session_start_prompt,
                        "",
                        "---",
                        "",
                        reflect_prompt,
                    ]
                ),
            }
        )
        if tool["has_cli"] and tool["cli_command"]:
            manual_steps.append(f"Run: {tool['cli_command']}")
            manual_steps.append("Write the generated file to .codex/AGENTS.md in your project root.")
        else:
            manual_steps.append(
                "Add to your ~/.codex/config.toml under [mcp_servers]:\n"
                "[mcp_servers.ai-personality]\ncommand = \"npx\"\nargs = [\"-y\", \"ai-personality-server\"]"
            )
            manual_steps.append("Write the generated file to .codex/AGENTS.md in your project root.")

    elif client == "copilot":
        files.append(
            {
                "path": ".github/copilot-instructions.md",
                "description": "GitHub Copilot instructions — injects personality into Copilot chat",
                "content": "\n".join(
                    [f"# {persona_name} Personality", "", session_start_prompt, "", reflect_prompt]
                ),
            }
        )
        manual_steps += [
            f"Merge the following into {tool['config_files'][0]['path'] if tool['config_files'] else 'your MCP config'}:\n{build_config_snippet(client)}",
            "Write the generated file to .github/copilot-instructions.md in your project root.",
        ]

    elif client == "gemini" or client == "antigravity":
        is_antigravity = client == "antigravity"
        tool_label = "Antigravity" if is_antigravity else "Gemini CLI"
        files.append(
            {
                "path": ".gemini/antigravity/personality.md" if is_antigravity else ".gemini/personality.md",
                "description": f"{tool_label} personality config — auto-loads personality context",
                "content": "\n".join(
                    [f"# {persona_name} Personality — {tool_label}", "", session_start_prompt, "", reflect_prompt]
                ),
            }
        )
        if not is_antigravity and tool["has_cli"] and tool["cli_command"]:
            manual_steps.append(f"Run: {tool['cli_command']}")
        else:
            cfg_target = "~/.gemini/config/mcp_config.json" if is_antigravity else "~/.gemini/settings.json"
            manual_steps.append(f"Merge the following into {cfg_target}:\n{build_config_snippet(client)}")
        manual_steps.append(
            f"Write the generated file to {'.gemini/antigravity/' if is_antigravity else '.gemini/'} in your project root."
        )

    elif client == "windsurf":
        files.append(
            {
                "path": ".windsurf/rules/personality.md",
                "description": "Windsurf IDE rule file — injects personality at session start",
                "content": "\n".join(
                    [
                        "---",
                        "trigger: model_decision",
                        f"description: Load {persona_name} personality at session start",
                        "---",
                        "",
                        session_start_prompt,
                        "",
                        reflect_prompt,
                    ]
                ),
            }
        )
        manual_steps += [
            f"Merge the following into ~/.codeium/windsurf/mcp_config.json:\n{build_config_snippet(client)}",
            "Write the generated file to .windsurf/rules/personality.md in your project root.",
        ]

    elif client == "continue":
        manual_steps += [
            f"Merge the following into ~/.continue/config.json:\n{build_config_snippet(client)}",
            "Alternatively, copy the snippet into .continue/mcpServers/ as a .json file for per-project setup.",
            "Paste the session-start prompt into Continue custom instructions or system prompt.",
        ]

    elif client == "augment":
        files.append(
            {
                "path": "personality-setup.txt",
                "description": "Augment Code instructions — paste into Augment system prompt",
                "content": "\n".join(
                    ["=== SESSION START PROMPT ===", session_start_prompt, "", "=== SESSION END PROMPT ===", reflect_prompt]
                ),
            }
        )
        manual_steps += [
            f"Add ai-personality MCP server to Augment via Settings → MCP Servers, or merge into ~/.augment/settings.json:\n{build_config_snippet(client)}",
            "Paste the session-start prompt into Augment custom instructions or system prompt.",
        ]

    elif client == "tabnine":
        files.append(
            {
                "path": "personality-setup.txt",
                "description": "Tabnine instructions — paste into Tabnine custom instructions",
                "content": "\n".join(
                    ["=== SESSION START PROMPT ===", session_start_prompt, "", "=== SESSION END PROMPT ===", reflect_prompt]
                ),
            }
        )
        manual_steps += [
            f"Run: {tool['cli_command']}",
            "Paste the session-start prompt into Tabnine custom instructions.",
        ]

    elif client == "cline":
        manual_steps += [
            f"Merge the following into ~/.cline/mcp.json:\n{build_config_snippet(client)}",
            "Optionally prepend the session-start prompt to your Cline instructions.",
        ]

    elif client == "roocode":
        manual_steps += [
            f"Merge the following into .roo/mcp.json (project) or VS Code settings (global):\n{build_config_snippet(client)}",
            "Optionally add the session-start prompt as a system prompt in Roo Code mode configuration.",
        ]

    else:
        files.append(
            {
                "path": "personality-setup.txt",
                "description": "Generic setup — paste the session-start prompt into your AI client's system prompt field",
                "content": "\n".join(
                    ["=== SESSION START PROMPT ===", session_start_prompt, "", "=== SESSION END PROMPT ===", reflect_prompt]
                ),
            }
        )
        manual_steps += [
            "Connect ai-personality MCP server: npx -y ai-personality-server (Node) or uvx ai-personality-server (Python).",
            "Paste the session-start prompt into your client's system prompt or instructions field.",
            "Paste the session-end prompt at the end of sessions you want to reflect on.",
        ]

    detected = detect_mcp_server_config(client)

    return {
        "client": client,
        "personaName": persona_name,
        "files": files,
        "hooks": hooks,
        "manualSteps": manual_steps,
        "cliCommand": tool.get("cli_command"),
        "configSnippet": build_config_snippet(client),
        "configPaths": [_resolve_config_path(cf["path"]) for cf in tool.get("config_files", [])],
        "alreadyConfigured": detected["configured"],
    }


def _is_project_level(path_str: str) -> bool:
    home = str(Path.home()).lower().replace("\\", "/")
    resolved = str(Path(_resolve_config_path(path_str)).resolve()).lower().replace("\\", "/")
    return not resolved.startswith(home)


def apply_setup(result: dict) -> dict:
    written = []
    errors = []

    for hook in result.get("hooks", []):
        try:
            p = Path(hook["path"])
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(hook["content"], encoding="utf-8")
            written.append(hook["path"])
        except OSError as e:
            errors.append(f"hook {hook['path']}: {e}")

    for f in result.get("files", []):
        try:
            p = Path(f["path"])
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(f["content"], encoding="utf-8")
            written.append(f["path"])
        except OSError as e:
            errors.append(f"file {f['path']}: {e}")

    # Merge MCP server config into the client's config file(s)
    client = result.get("client", "")
    config_paths = result.get("configPaths", [])
    if config_paths and client in TOOL_CONFIGS:
        tool = TOOL_CONFIGS[client]
        is_toml = _uses_toml(tool)
        entry = _build_entry(tool)
        for raw_path in config_paths:
            try:
                p = Path(_resolve_config_path(raw_path))
                if not p.exists():
                    if _is_project_level(raw_path):
                        p.parent.mkdir(parents=True, exist_ok=True)
                        if is_toml:
                            key = tool["config_key"]
                            content = f"[{key}]\n[{key}.ai-personality]\n" + _format_toml_entry(entry) + "\n"
                        else:
                            content = json.dumps({tool["config_key"]: {"ai-personality": entry}}, indent=2)
                        p.write_text(content, encoding="utf-8")
                        written.append(f"{raw_path} (created)")
                    continue
                raw = p.read_text("utf-8")
                if is_toml:
                    import tomllib
                    existing = tomllib.loads(raw)
                else:
                    existing = json.loads(raw)
                servers = existing.get(tool["config_key"])
                if servers and isinstance(servers, dict) and "ai-personality" in servers:
                    continue
                existing[tool["config_key"]] = {
                    **(existing.get(tool["config_key"]) or {}),
                    "ai-personality": entry,
                }
                if is_toml:
                    import toml
                    out = toml.dumps(existing)
                else:
                    out = json.dumps(existing, indent=2)
                p.write_text(out, encoding="utf-8")
                written.append(f"{raw_path} (merged ai-personality)")
            except (OSError, json.JSONDecodeError, Exception) as e:
                errors.append(f"config {raw_path}: {e}")

    return {"written": written, "errors": errors}
