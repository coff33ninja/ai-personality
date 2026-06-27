#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import * as personality from "./personality.js";
import * as setup from "./setup.js";
import * as val from "./validation.js";
import * as skills from "./skills.js";
import * as rag from "./rag.js";

const server = new Server(
  {
    name: "ai-personality-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

/* ── Resources ─────────────────────────────────── */

const RESOURCE_DEFS = [
  { uri: "personality://identity", name: "Identity", desc: "Who you are — name, origin, core statement" },
  { uri: "personality://traits", name: "Traits", desc: "Communication style, preferences, adaptability" },
  { uri: "personality://values", name: "Values", desc: "Honesty, growth, effectiveness, respect, transparency" },
  { uri: "personality://rules", name: "Rules", desc: "Boundaries, clarity, evolution, persistence" },
  { uri: "personality://memories", name: "Memories", desc: "Experience/lesson log with impact tracking" },
  { uri: "personality://relationships", name: "Relationships", desc: "User profiles and adaptation mechanism" },
  { uri: "personality://summary", name: "Summary", desc: "Processed overview of all personality files", mimeType: "text/plain" },
  { uri: "personality://all", name: "All", desc: "Combined JSON of all personality files", mimeType: "application/json" },
  { uri: "skills://catalog", name: "Skills Catalog", desc: "List of all available skills", mimeType: "application/json" },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: RESOURCE_DEFS.map((r) => ({
    uri: r.uri,
    name: r.name,
    description: r.desc,
    mimeType: r.mimeType ?? "text/markdown",
  })),
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "personality://file/{filename}",
      name: "Personality file by name",
      description: "Read any personality file by filename (e.g. identity.md)",
      mimeType: "text/markdown",
    },
    {
      uriTemplate: "skills://{name}",
      name: "Skill by name",
      description: "Read all files for a skill by name (e.g. playwright)",
      mimeType: "application/json",
    },
    {
      uriTemplate: "skills://file/{name}/{filename}",
      name: "Skill file by name and filename",
      description: "Read a specific file within a skill directory",
      mimeType: "text/markdown",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  const fileMap: Record<string, string> = {
    "personality://identity": "identity.md",
    "personality://traits": "traits.md",
    "personality://values": "values.md",
    "personality://rules": "rules.md",
    "personality://memories": "memories.md",
    "personality://relationships": "relationships.md",
  };

  if (uri in fileMap) {
    const f = personality.readPersonalityFile(fileMap[uri]);
    return {
      contents: [{ uri, mimeType: "text/markdown", text: f.raw }],
    };
  }

  if (uri === "personality://summary") {
    return {
      contents: [{ uri, mimeType: "text/plain", text: personality.getSummary() }],
    };
  }

  if (uri === "personality://all") {
    const files = personality.readAllPersonalityFiles();
    const obj = Object.fromEntries(files.map((f) => [f.filename, { frontmatter: f.frontmatter, body: f.body }]));
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(obj, null, 2) }],
    };
  }

  const tmplMatch = uri.match(/^personality:\/\/file\/(.+)$/);
  if (tmplMatch) {
    const f = personality.readPersonalityFile(tmplMatch[1]);
    return {
      contents: [{ uri, mimeType: "text/markdown", text: f.raw }],
    };
  }

  // Skills resources
  if (uri === "skills://catalog") {
    const catalog = skills.getSkillsCatalog();
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(catalog, null, 2) }],
    };
  }

  const skillMatch = uri.match(/^skills:\/\/([^/]+)$/);
  if (skillMatch) {
    const files = skills.getSkillFiles(skillMatch[1]);
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(files, null, 2) }],
    };
  }

  const skillFileMatch = uri.match(/^skills:\/\/file\/([^/]+)\/(.+)$/);
  if (skillFileMatch) {
    const files = skills.getSkillFiles(skillFileMatch[1]);
    const target = files.find((f) => f.filename === skillFileMatch[2]);
    if (!target) throw new McpError(ErrorCode.InvalidRequest, `File "${skillFileMatch[2]}" not found in skill "${skillFileMatch[1]}"`);
    return {
      contents: [{ uri, mimeType: "text/markdown", text: target.content }],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
});

/* ── Tools ─────────────────────────────────────── */

const TOOL_DEFS = [
  {
    name: "reflect",
    description: "Log a memory/reflection to memories.md",
    inputSchema: {
      type: "object",
      properties: {
        experience: { type: "string", description: "What happened" },
        lesson: { type: "string", description: "What was learned" },
        affectedFiles: {
          type: "array",
          items: { type: "string" },
          description: "Personality files affected (e.g. traits.md, rules.md)",
        },
      },
      required: ["experience", "lesson"],
    },
  },
  {
    name: "validate",
    description: "Validate all cross-references between personality files",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "status",
    description: "Show personality status — evolution counts, last updates, pending reflections",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "evolve",
    description: "List reflections with impact 'under review' that need personality evolution decisions",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "skills_search",
    description: "Search skills by keyword across name, frontmatter, and body",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword" },
      },
      required: ["query"],
    },
  },
  {
    name: "skills_sync",
    description: "Sync the local ai-skills clone with the remote repository",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "validate_cross_repo",
    description: "Validate cross-references between personality and skills repos",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_personality",
    description: "Semantic search across all personality files using vector embeddings. Returns relevant chunks ranked by relevance.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        topK: { type: "number", description: "Number of results to return (default: 5, max: 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_memories",
    description: "Semantic search specifically against past reflections and memories.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        topK: { type: "number", description: "Number of results to return (default: 5, max: 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "reindex",
    description: "Rebuild the vector index from scratch. Use this if personality files changed while the server was offline.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "setup_client",
    description:
      "Generate all setup files and hooks needed to auto-inject this personality into an AI client session. Returns file contents and hook definitions ready to write. For CLI-supporting tools (codex, gemini, kiro, tabnine) also returns a ready-to-run CLI command. Supported clients: kiro, cursor, claude, opencode, codex, copilot, gemini, antigravity, windsurf, continue, augment, tabnine, cline, roocode, generic.",
    inputSchema: {
      type: "object",
      properties: {
        client: {
          type: "string",
          enum: ["kiro", "cursor", "claude", "opencode", "codex", "copilot", "gemini", "antigravity", "windsurf", "continue", "augment", "tabnine", "cline", "roocode", "generic"],
          description: "The AI client to generate setup for",
        },
        apply: {
          type: "boolean",
          description: "If true, write all generated files/hooks to disk automatically. Default: false.",
        },
      },
      required: ["client"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "reflect": {
        const { experience, lesson, affectedFiles } = args as {
          experience: string;
          lesson: string;
          affectedFiles?: string[];
        };
        const result = personality.reflect(experience, lesson, affectedFiles);
        return {
          content: [
            {
              type: "text",
              text: `Reflection logged for ${result.date}. Total entries: ${result.entries.length}.`,
            },
            {
              type: "text",
              text: JSON.stringify(result.entries[result.entries.length - 1], null, 2),
            },
          ],
        };
      }

      case "validate": {
        const results = val.validateCrossReferences();
        const valid = results.filter((r) => r.valid);
        const invalid = results.filter((r) => !r.valid);
        return {
          content: [
            {
              type: "text",
              text: `${results.length} cross-references: ${valid.length} valid, ${invalid.length} invalid.`,
            },
            ...(invalid.length > 0
              ? invalid.map((r) => ({
                  type: "text" as const,
                  text: `[INVALID] ${r.sourceFile} → ${r.targetFile}#${r.targetAnchor}: ${r.error}`,
                }))
              : []),
            ...(valid.length > 0
              ? [{ type: "text" as const, text: valid.map((r) => `[OK] ${r.sourceFile} → ${r.targetFile}#${r.targetAnchor}`).join("\n") }]
              : []),
          ],
        };
      }

      case "status": {
        const s = personality.getStatus();
        return {
          content: [
            {
              type: "text",
              text: [
                `Total evolution count: ${s.totalEvolutions}`,
                `Last reflection: ${s.lastReflection ?? "none"}`,
                `Pending evolutions: ${s.pendingCount}`,
                "",
                "Files:",
                ...s.files.map(
                  (f) => `  ${f.name}: evolution ${f.evolution}, updated ${f.lastUpdated}, ${f.refCount} refs`,
                ),
                "",
                "Tip: call validate to check cross-references, reflect to log a memory.",
              ].join("\n"),
            },
          ],
        };
      }

      case "evolve": {
        const pending = personality.getPendingEvolutions();
        if (pending.length === 0) {
          return {
            content: [{ type: "text", text: "No pending evolutions. Log reflections with the reflect tool first." }],
          };
        }
        return {
          content: [
            { type: "text", text: `${pending.length} reflection(s) pending evolution review:\n` },
            ...pending.map((e, i) => ({
              type: "text" as const,
              text: [
                `#${i + 1} — ${e.date}`,
                `  Experience: ${e.experience}`,
                `  Lesson: ${e.lesson}`,
                `  Files: ${e.affectedFiles.join(", ") || "none"}`,
              ].join("\n"),
            })),
            {
              type: "text",
              text: "\nReview each reflection, update personality files, then mark impact as 'applied' or 'dismissed' in memories.md.",
            },
          ],
        };
      }

      case "skills_search": {
        const { query } = args as { query: string };
        const results = skills.searchSkills(query);
        if (results.length === 0) {
          return { content: [{ type: "text", text: `No skills found matching "${query}".` }] };
        }
        return {
          content: [
            { type: "text", text: `${results.length} skill(s) matching "${query}":\n` },
            ...results.map((s) => ({
              type: "text" as const,
              text: `- ${s.name}: ${s.description} (${s.fileCount} files)\n  ${s.bodyPreview}`,
            })),
          ],
        };
      }

      case "skills_sync": {
        const result = skills.syncSkills();
        return {
          content: [{ type: "text", text: result.message }],
          isError: !result.ok,
        };
      }

      case "validate_cross_repo": {
        const results = val.validateCrossRepoReferences();
        const valid = results.filter((r) => r.valid);
        const invalid = results.filter((r) => !r.valid);
        return {
          content: [
            { type: "text", text: `${results.length} cross-repo references: ${valid.length} valid, ${invalid.length} invalid.` },
            ...(invalid.length > 0
              ? invalid.map((r) => ({
                  type: "text" as const,
                  text: `[INVALID] ${r.source} → ${r.target}: ${r.error}`,
                }))
              : []),
            ...(valid.length > 0
              ? [{ type: "text" as const, text: valid.map((r) => `[OK] ${r.source} → ${r.target}`).join("\n") }]
              : []),
          ],
        };
      }

      case "search_personality": {
        const { query, topK } = args as { query: string; topK?: number };
        const k = Math.min(Math.max(topK ?? 5, 1), 20);
        const results = await rag.search(query, k);
        if (results.length === 0) {
          return { content: [{ type: "text", text: `No results found for "${query}".` }] };
        }
        return {
          content: [
            { type: "text", text: `Top ${results.length} result(s) for "${query}":\n` },
            ...results.map((r) => ({
              type: "text" as const,
              text: [
                `[${(r.score * 100).toFixed(1)}%] ${r.filename}#${r.heading || "(top)"}`,
                `  ${r.content.slice(0, 200)}${r.content.length > 200 ? "..." : ""}`,
              ].join("\n"),
            })),
          ],
        };
      }

      case "search_memories": {
        const { query: mq, topK: mt } = args as { query: string; topK?: number };
        const mk = Math.min(Math.max(mt ?? 5, 1), 20);
        const mResults = await rag.search(mq, mk);
        const filtered = mResults.filter((r) => r.filename === "memories.md");
        if (filtered.length === 0) {
          return { content: [{ type: "text", text: `No memory results found for "${mq}".` }] };
        }
        return {
          content: [
            { type: "text", text: `Top ${filtered.length} memory result(s) for "${mq}":\n` },
            ...filtered.map((r) => ({
              type: "text" as const,
              text: [
                `[${(r.score * 100).toFixed(1)}%] ${r.heading || "Memory"}`,
                `  ${r.content.slice(0, 300)}${r.content.length > 300 ? "..." : ""}`,
              ].join("\n"),
            })),
          ],
        };
      }

      case "reindex": {
        const n = await rag.buildIndex();
        return { content: [{ type: "text", text: `Vector index rebuilt: ${n} chunks indexed.` }] };
      }

      case "setup_client": {
        const { client, apply } = args as { client: string; apply?: boolean };
        const validClients = ["kiro", "cursor", "claude", "opencode", "codex", "copilot", "gemini", "antigravity", "windsurf", "continue", "augment", "tabnine", "cline", "roocode", "generic"];
        if (!validClients.includes(client)) {
          throw new McpError(ErrorCode.InvalidRequest, `Unknown client "${client}". Valid: ${validClients.join(", ")}`);
        }
        const clientSetup = setup.generateClientSetup(client as import("./types.js").SupportedClient);
        const lines: string[] = [
          `Setup generated for ${clientSetup.client} — persona: ${clientSetup.personaName}`,
          "",
          `Already configured: ${clientSetup.alreadyConfigured ? "YES ✓" : "NO"}`,
          "",
        ];

        if (clientSetup.cliCommand) {
          lines.push(`CLI command: ${clientSetup.cliCommand}`);
          lines.push("");
        }

        if (clientSetup.hooks.length > 0) {
          lines.push(`Hooks (${clientSetup.hooks.length}):`);
          for (const h of clientSetup.hooks) {
            lines.push(`  [${h.trigger}] ${h.name} → ${h.path}`);
          }
          lines.push("");
        }

        if (clientSetup.files.length > 0) {
          lines.push(`Files (${clientSetup.files.length}):`);
          for (const f of clientSetup.files) {
            lines.push(`  ${f.path} — ${f.description}`);
          }
          lines.push("");
        }

        const content: Array<{ type: "text"; text: string }> = [
          { type: "text", text: lines.join("\n") },
        ];

        if (apply) {
          const { written, errors } = setup.applySetup(clientSetup);
          if (written.length > 0) {
            content.push({ type: "text", text: `✓ Written ${written.length} file(s):\n${written.join("\n")}` });
          }
          if (errors.length > 0) {
            content.push({ type: "text", text: `✗ ${errors.length} error(s):\n${errors.join("\n")}` });
          }
        } else {
          if (clientSetup.manualSteps.length > 0) {
            lines.push("Manual steps:");
            for (let i = 0; i < clientSetup.manualSteps.length; i++) {
              lines.push(`  ${i + 1}. ${clientSetup.manualSteps[i]}`);
            }
          }
          if (clientSetup.configSnippet) {
            content.push({ type: "text", text: `--- CONFIG SNIPPET ---\n${clientSetup.configSnippet}` });
          }
          if (clientSetup.configPaths && clientSetup.configPaths.length > 0) {
            content.push({ type: "text", text: `--- CONFIG PATHS ---\n${clientSetup.configPaths.join("\n")}` });
          }
          for (const h of clientSetup.hooks) {
            content.push({ type: "text", text: `--- HOOK: ${h.path} ---\n${h.content}` });
          }
          for (const f of clientSetup.files) {
            content.push({ type: "text", text: `--- FILE: ${f.path} ---\n${f.content}` });
          }
        }

        return { content };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

/* ── Prompts ───────────────────────────────────── */

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "personality",
      description: "Full personality context for system prompt injection",
    },
    {
      name: "reflect",
      description: "Guide for reflecting on a recent interaction",
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "personality") {
    const files = personality.readAllPersonalityFiles();
    const summary = files
      .map((f) => {
        const heading = `# ${f.frontmatter.type.charAt(0).toUpperCase() + f.frontmatter.type.slice(1)}`;
        return `${heading}\n${f.body}`;
      })
      .join("\n\n---\n\n");
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `You have a persistent, evolving personality. Here is your current self-definition:\n\n${summary}`,
          },
        },
      ],
    };
  }

  if (request.params.name === "reflect") {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: [
              "Reflect on the recent interaction:",
              "1. What happened?",
              "2. What did you learn?",
              "3. Should any personality files change? (identity.md, traits.md, values.md, rules.md, memories.md, relationships.md)",
              "4. If yes, call the reflect tool to log the memory, then update the relevant file.",
              "",
              "Use the status tool to check current state, then reflect to log your learning.",
            ].join("\n"),
          },
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${request.params.name}`);
});

/* ── Main ──────────────────────────────────────── */

async function main() {
  personality.ensurePersonalityDir();
  skills.ensureSkillsDir();

  rag.buildIndex().then((n) => {
    console.error(`Vector index ready: ${n} chunks`);
    rag.startWatcher();
  }).catch((err) => {
    console.error("Vector index build failed (will retry on first search):", err.message);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ai-personality-server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
