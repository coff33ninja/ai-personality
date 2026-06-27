import sys
import json
import anyio

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

import ai_personality.personality as p
import ai_personality.skills as skills
import ai_personality.validation as val
import ai_personality.setup as setup
import ai_personality.rag as rag

server = Server("ai-personality-server")

RESOURCE_DEFS = [
    (
        "personality://identity",
        "Identity",
        "Who you are — name, origin, core statement",
        "text/markdown",
    ),
    (
        "personality://traits",
        "Traits",
        "Communication style, preferences, adaptability",
        "text/markdown",
    ),
    (
        "personality://values",
        "Values",
        "Honesty, growth, effectiveness, respect, transparency",
        "text/markdown",
    ),
    (
        "personality://rules",
        "Rules",
        "Boundaries, clarity, evolution, persistence",
        "text/markdown",
    ),
    (
        "personality://memories",
        "Memories",
        "Experience/lesson log with impact tracking",
        "text/markdown",
    ),
    (
        "personality://relationships",
        "Relationships",
        "User profiles and adaptation mechanism",
        "text/markdown",
    ),
    (
        "personality://summary",
        "Summary",
        "Processed overview of all personality files",
        "text/plain",
    ),
    (
        "personality://all",
        "All",
        "Combined JSON of all personality files",
        "application/json",
    ),
    (
        "skills://catalog",
        "Skills Catalog",
        "List of all available skills",
        "application/json",
    ),
]

FILE_MAP = {
    "personality://identity": "identity.md",
    "personality://traits": "traits.md",
    "personality://values": "values.md",
    "personality://rules": "rules.md",
    "personality://memories": "memories.md",
    "personality://relationships": "relationships.md",
}


@server.list_resources()
async def handle_list_resources() -> list[types.Resource]:
    return [
        types.Resource(uri=uri, name=name, description=desc, mimeType=mt)
        for uri, name, desc, mt in RESOURCE_DEFS
    ]


@server.list_resource_templates()
async def handle_list_templates() -> list[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            uriTemplate="personality://file/{filename}",
            name="Personality file by name",
            description="Read any personality file by filename (e.g. identity.md)",
            mimeType="text/markdown",
        ),
        types.ResourceTemplate(
            uriTemplate="skills://{name}",
            name="Skill by name",
            description="Read all files for a skill by name (e.g. playwright)",
            mimeType="application/json",
        ),
        types.ResourceTemplate(
            uriTemplate="skills://file/{name}/{filename}",
            name="Skill file by name and filename",
            description="Read a specific file within a skill directory",
            mimeType="text/markdown",
        ),
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str | bytes:
    if uri in FILE_MAP:
        f = p.read_personality_file(FILE_MAP[uri])
        return f["raw"]
    if uri == "personality://summary":
        return p.get_summary()
    if uri == "personality://all":
        files = p.read_all_personality_files()
        obj = {
            f["filename"]: {"frontmatter": f["frontmatter"], "body": f["body"]}
            for f in files
        }
        return json.dumps(obj, indent=2, default=str)

    m = __import__("re").match(r"^personality://file/(.+)$", uri)
    if m:
        f = p.read_personality_file(m.group(1))
        return f["raw"]

    # Skills resources
    if uri == "skills://catalog":
        return json.dumps(skills.get_skills_catalog(), indent=2, default=str)

    sm = __import__("re").match(r"^skills://([^/]+)$", uri)
    if sm:
        files = skills.get_skill_files(sm.group(1))
        return json.dumps(files, indent=2, default=str)

    sfm = __import__("re").match(r"^skills://file/([^/]+)/(.+)$", uri)
    if sfm:
        files = skills.get_skill_files(sfm.group(1))
        target = next((f for f in files if f["filename"] == sfm.group(2)), None)
        if not target:
            raise ValueError(
                f'File "{sfm.group(2)}" not found in skill "{sfm.group(1)}"'
            )
        return target["content"]

    raise ValueError(f"Unknown resource: {uri}")


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="reflect",
            description="Log a memory/reflection to memories.md",
            inputSchema={
                "type": "object",
                "properties": {
                    "experience": {"type": "string", "description": "What happened"},
                    "lesson": {"type": "string", "description": "What was learned"},
                    "affectedFiles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Personality files affected",
                    },
                },
                "required": ["experience", "lesson"],
            },
        ),
        types.Tool(
            name="validate",
            description="Validate all cross-references between personality files",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="status",
            description="Show personality status — evolution counts, last updates, pending reflections",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="evolve",
            description="List reflections with impact 'under review' that need personality evolution decisions",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="skills_search",
            description="Search skills by keyword across name, frontmatter, and body",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword"}
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="skills_sync",
            description="Sync the local ai-skills clone with the remote repository",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="validate_cross_repo",
            description="Validate cross-references between personality and skills repos",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="search_personality",
            description="Semantic search across all personality files using vector embeddings. Returns relevant chunks ranked by relevance.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language search query"},
                    "topK": {"type": "number", "description": "Number of results to return (default: 5, max: 20)"},
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="search_memories",
            description="Semantic search specifically against past reflections and memories.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language search query"},
                    "topK": {"type": "number", "description": "Number of results to return (default: 5, max: 20)"},
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="reindex",
            description="Rebuild the vector index from scratch. Use this if personality files changed while the server was offline.",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="setup_client",
            description="Generate all setup files and hooks needed to auto-inject this personality into an AI client session. Returns file contents and hook definitions ready to write. For CLI-supporting tools (codex, gemini, kiro, tabnine) also returns a ready-to-run CLI command. Set apply=true to write files directly. Supported clients: kiro, cursor, claude, opencode, codex, copilot, gemini, antigravity, windsurf, continue, augment, tabnine, cline, roocode, generic.",
            inputSchema={
                "type": "object",
                "properties": {
                    "client": {
                        "type": "string",
                        "enum": ["kiro", "cursor", "claude", "opencode", "codex", "copilot", "gemini", "antigravity", "windsurf", "continue", "augment", "tabnine", "cline", "roocode", "generic"],
                        "description": "The AI client to generate setup for",
                    },
                    "apply": {
                        "type": "boolean",
                        "description": "If true, write all generated files/hooks to disk automatically. Default: false.",
                    },
                },
                "required": ["client"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent]:
    args = arguments or {}
    try:
        if name == "reflect":
            exp = args["experience"]
            les = args["lesson"]
            af = args.get("affectedFiles")
            result = p.reflect(exp, les, af)
            return [
                types.TextContent(
                    type="text",
                    text=f"Reflection logged for {result['date']}. Total entries: {len(result['entries'])}.",
                ),
                types.TextContent(
                    type="text",
                    text=json.dumps(result["entries"][-1], indent=2, default=str),
                ),
            ]

        elif name == "validate":
            results = val.validate_cross_references()
            valid = [r for r in results if r["valid"]]
            invalid = [r for r in results if not r["valid"]]
            out = [
                types.TextContent(
                    type="text",
                    text=f"{len(results)} cross-references: {len(valid)} valid, {len(invalid)} invalid.",
                )
            ]
            if invalid:
                for r in invalid:
                    out.append(
                        types.TextContent(
                            type="text",
                            text=f"[INVALID] {r['sourceFile']} → {r['targetFile']}#{r['targetAnchor']}: {r['error']}",
                        )
                    )
            if valid:
                out.append(
                    types.TextContent(
                        type="text",
                        text="\n".join(
                            f"[OK] {r['sourceFile']} → {r['targetFile']}#{r['targetAnchor']}"
                            for r in valid
                        ),
                    )
                )
            return out

        elif name == "status":
            s = p.get_status()
            lines = [
                f"Total evolution count: {s['totalEvolutions']}",
                f"Last reflection: {s['lastReflection'] or 'none'}",
                f"Pending evolutions: {s['pendingCount']}",
                "",
                "Files:",
            ]
            for f in s["files"]:
                lines.append(
                    f"  {f['name']}: evolution {f['evolution']}, updated {f['lastUpdated']}, {f['refCount']} refs"
                )
            lines.append("")
            lines.append(
                "Tip: call validate to check cross-references, reflect to log a memory."
            )
            return [types.TextContent(type="text", text="\n".join(lines))]

        elif name == "evolve":
            pending = p.get_pending_evolutions()
            if not pending:
                return [
                    types.TextContent(
                        type="text",
                        text="No pending evolutions. Log reflections with the reflect tool first.",
                    )
                ]
            out = [
                types.TextContent(
                    type="text",
                    text=f"{len(pending)} reflection(s) pending evolution review:\n",
                )
            ]
            for i, e in enumerate(pending):
                out.append(
                    types.TextContent(
                        type="text",
                        text=f"#{i + 1} — {e['date']}\n  Experience: {e['experience']}\n  Lesson: {e['lesson']}\n  Files: {', '.join(e.get('affectedFiles', [])) or 'none'}",
                    )
                )
            out.append(
                types.TextContent(
                    type="text",
                    text="\nReview each reflection, update personality files, then mark impact as 'applied' or 'dismissed' in memories.md.",
                )
            )
            return out

        elif name == "skills_search":
            query = args["query"]
            results = skills.search_skills(query)
            if not results:
                return [
                    types.TextContent(
                        type="text", text=f'No skills found matching "{query}".'
                    )
                ]
            out = [
                types.TextContent(
                    type="text", text=f'{len(results)} skill(s) matching "{query}":\n'
                )
            ]
            for s in results:
                out.append(
                    types.TextContent(
                        type="text",
                        text=f'- {s["name"]}: {s["description"]} ({s["fileCount"]} files)\n  {s["bodyPreview"]}',
                    )
                )
            return out

        elif name == "skills_sync":
            result = skills.sync_skills()
            return [types.TextContent(type="text", text=result["message"])]

        elif name == "validate_cross_repo":
            results = val.validate_cross_repo_references()
            valid = [r for r in results if r["valid"]]
            invalid = [r for r in results if not r["valid"]]
            out = [
                types.TextContent(
                    type="text",
                    text=f"{len(results)} cross-repo references: {len(valid)} valid, {len(invalid)} invalid.",
                )
            ]
            if invalid:
                for r in invalid:
                    out.append(
                        types.TextContent(
                            type="text",
                            text=f'[INVALID] {r["source"]} → {r["target"]}: {r.get("error", "?")}',
                        )
                    )
            if valid:
                out.append(
                    types.TextContent(
                        type="text",
                        text="\n".join(
                            f'[OK] {r["source"]} → {r["target"]}' for r in valid
                        ),
                    )
                )
            return out

        elif name == "search_personality":
            query = args["query"]
            top_k = min(max(args.get("topK", 5), 1), 20)
            results = rag.search(query, top_k)
            if not results:
                return [types.TextContent(type="text", text=f'No results found for "{query}".')]
            out = [types.TextContent(type="text", text=f'Top {len(results)} result(s) for "{query}":\n')]
            for r in results:
                heading = r["heading"] or "(top)"
                preview = r["content"][:200]
                if len(r["content"]) > 200:
                    preview += "..."
                out.append(
                    types.TextContent(
                        type="text",
                        text=f"[{r['score'] * 100:.1f}%] {r['filename']}#{heading}\n  {preview}",
                    )
                )
            return out

        elif name == "search_memories":
            query = args["query"]
            top_k = min(max(args.get("topK", 5), 1), 20)
            results = rag.search(query, top_k)
            filtered = [r for r in results if r["filename"] == "memories.md"]
            if not filtered:
                return [types.TextContent(type="text", text=f'No memory results found for "{query}".')]
            out = [types.TextContent(type="text", text=f'Top {len(filtered)} memory result(s) for "{query}":\n')]
            for r in filtered:
                heading = r["heading"] or "Memory"
                preview = r["content"][:300]
                if len(r["content"]) > 300:
                    preview += "..."
                out.append(
                    types.TextContent(
                        type="text",
                        text=f"[{r['score'] * 100:.1f}%] {heading}\n  {preview}",
                    )
                )
            return out

        elif name == "reindex":
            n = rag.build_index()
            return [types.TextContent(type="text", text=f"Vector index rebuilt: {n} chunks indexed.")]

        elif name == "setup_client":
            client = args.get("client", "generic")
            should_apply = args.get("apply", False)
            result = setup.generate_client_setup(client)
            lines = [
                f"Setup generated for {result['client']} — persona: {result['personaName']}",
                "",
            ]
            if result.get("alreadyConfigured"):
                lines.append("✓ ai-personality MCP server already configured for this client!")
            else:
                lines.append("✗ ai-personality MCP server not yet configured for this client.")
            lines.append("")
            if result.get("cliCommand"):
                lines.append(f"CLI command (run in project root): {result['cliCommand']}")
                lines.append("")
            if result["hooks"]:
                lines.append(f"Hooks ({len(result['hooks'])}):")
                for h in result["hooks"]:
                    lines.append(f"  [{h['trigger']}] {h['name']} → {h['path']}")
                lines.append("")
            if result["files"]:
                lines.append(f"Files ({len(result['files'])}):")
                for f in result["files"]:
                    lines.append(f"  {f['path']} — {f['description']}")
                lines.append("")

            out = [types.TextContent(type="text", text="\n".join(lines))]

            if should_apply:
                applied = setup.apply_setup(result)
                if applied["written"]:
                    out.append(
                        types.TextContent(
                            type="text",
                            text=f"✓ Written {len(applied['written'])} file(s):\n" + "\n".join(applied["written"]),
                        )
                    )
                if applied["errors"]:
                    out.append(
                        types.TextContent(
                            type="text",
                            text=f"✗ {len(applied['errors'])} error(s):\n" + "\n".join(applied["errors"]),
                        )
                    )
            else:
                if result.get("configSnippet"):
                    out.append(
                        types.TextContent(
                            type="text", text=f"--- CONFIG SNIPPET ---\n{result['configSnippet']}"
                        )
                    )
                if result.get("configPaths"):
                    out.append(
                        types.TextContent(
                            type="text", text=f"--- CONFIG PATHS ---\n" + "\n".join(result["configPaths"])
                        )
                    )
                if result["manualSteps"]:
                    steps = "\n".join(f"  {i}. {s}" for i, s in enumerate(result["manualSteps"], 1))
                    out.append(
                        types.TextContent(
                            type="text", text=f"Manual steps:\n{steps}"
                        )
                    )
                for h in result["hooks"]:
                    out.append(
                        types.TextContent(
                            type="text", text=f"--- HOOK: {h['path']} ---\n{h['content']}"
                        )
                    )
                for f in result["files"]:
                    out.append(
                        types.TextContent(
                            type="text", text=f"--- FILE: {f['path']} ---\n{f['content']}"
                        )
                    )
            return out

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {e}")]


@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return [
        types.Prompt(
            name="personality",
            description="Full personality context for system prompt injection",
        ),
        types.Prompt(
            name="reflect", description="Guide for reflecting on a recent interaction"
        ),
    ]


@server.get_prompt()
async def handle_get_prompt(
    name: str, arguments: dict | None = None
) -> types.GetPromptResult:
    if name == "personality":
        files = p.read_all_personality_files()
        parts = []
        for f in files:
            heading = f"# {f['frontmatter'].get('type', '?').capitalize()}"
            parts.append(f"{heading}\n{f['body']}")
        summary = "\n\n---\n\n".join(parts)
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text=f"You have a persistent, evolving personality. Here is your current self-definition:\n\n{summary}",
                    ),
                )
            ]
        )

    if name == "reflect":
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text="Reflect on the recent interaction:\n1. What happened?\n2. What did you learn?\n3. Should any personality files change?\n4. If yes, call the reflect tool to log the memory, then update the relevant file.\n\nUse the status tool to check current state, then reflect to log your learning.",
                    ),
                )
            ]
        )

    raise ValueError(f"Unknown prompt: {name}")


async def async_main():
    p.ensure_personality_dir()
    skills.ensure_skills_dir()

    try:
        n = rag.build_index()
        print(f"Vector index ready: {n} chunks", file=__import__("sys").stderr)
        rag.start_watcher()
    except Exception as e:
        print(f"Vector index build failed (will retry on first search): {e}", file=__import__("sys").stderr)

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main():
    """Sync entry point for CLI tools (npx, uvx, pip)."""
    anyio.run(async_main)


if __name__ == "__main__":
    main()
