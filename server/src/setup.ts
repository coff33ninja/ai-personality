import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { ensurePersonalityDir, readPersonalityFile } from "./personality.js";
import type { ClientSetup, SupportedClient, SetupFile, SetupHook } from "./types.js";

const MCP_SERVER_NODE = "npx -y ai-personality-server";
const MCP_SERVER_UVX = "uvx ai-personality-server";

const CLAUDE_CONFIG_PATH = os.platform() === "win32"
  ? "%APPDATA%\\Claude\\claude_desktop_config.json"
  : "~/Library/Application Support/Claude/claude_desktop_config.json";

interface ToolMcpInfo {
  label: string;
  hasCli: boolean;
  cliCommand: string | null;
  configKey: string;
  commandIsArray: boolean;
  urlField: string;
  configFiles: { scope: string; path: string }[];
  personalityDir: string | null;
  personalityFile: string | null;
}

const TOOL_CONFIGS: Record<SupportedClient, ToolMcpInfo> = {
  kiro: {
    label: "Kiro",
    hasCli: true,
    cliCommand: `kiro-cli mcp add --name ai-personality --scope project --command npx --args "-y" --args "ai-personality-server"`,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "project", path: ".kiro/settings/mcp.json" },
      { scope: "user", path: "~/.kiro/settings/mcp.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  cursor: {
    label: "Cursor",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "project", path: ".cursor/mcp.json" },
      { scope: "user", path: "~/.cursor/mcp.json" },
    ],
    personalityDir: ".cursor/rules",
    personalityFile: "personality.mdc",
  },
  claude: {
    label: "Claude Desktop",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: CLAUDE_CONFIG_PATH },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  opencode: {
    label: "OpenCode",
    hasCli: false,
    cliCommand: null,
    configKey: "mcp",
    commandIsArray: true,
    urlField: "url",
    configFiles: [
      { scope: "project", path: "opencode.jsonc" },
      { scope: "user", path: "~/.config/opencode/opencode.jsonc" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  codex: {
    label: "Codex CLI",
    hasCli: true,
    cliCommand: `codex mcp add ai-personality -- npx -y ai-personality-server`,
    configKey: "mcp_servers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: "~/.codex/config.toml" },
      { scope: "project", path: ".codex/config.toml" },
    ],
    personalityDir: ".codex",
    personalityFile: "AGENTS.md",
  },
  copilot: {
    label: "GitHub Copilot",
    hasCli: false,
    cliCommand: null,
    configKey: "servers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "project", path: ".vscode/mcp.json" },
      { scope: "user", path: "~/.vscode/mcp.json" },
    ],
    personalityDir: ".github",
    personalityFile: "copilot-instructions.md",
  },
  gemini: {
    label: "Gemini CLI",
    hasCli: true,
    cliCommand: `gemini mcp add ai-personality -s project -- npx -y ai-personality-server`,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: "~/.gemini/settings.json" },
      { scope: "project", path: ".gemini/settings.json" },
    ],
    personalityDir: ".gemini",
    personalityFile: "personality.md",
  },
  antigravity: {
    label: "Antigravity",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "serverUrl",
    configFiles: [
      { scope: "user", path: "~/.gemini/config/mcp_config.json" },
    ],
    personalityDir: ".gemini/antigravity",
    personalityFile: "personality.md",
  },
  windsurf: {
    label: "Windsurf",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "serverUrl",
    configFiles: [
      { scope: "user", path: "~/.codeium/windsurf/mcp_config.json" },
    ],
    personalityDir: ".windsurf/rules",
    personalityFile: "personality.md",
  },
  continue: {
    label: "Continue.dev",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: "~/.continue/config.json" },
      { scope: "project", path: ".continue/config.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  augment: {
    label: "Augment Code",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: "~/.augment/settings.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  tabnine: {
    label: "Tabnine",
    hasCli: true,
    cliCommand: `tabnine mcp add ai-personality -s project -t stdio -- npx -y ai-personality-server`,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "project", path: ".tabnine/mcp_servers.json" },
      { scope: "user", path: "~/.tabnine/mcp_servers.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  cline: {
    label: "Cline",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "user", path: "~/.cline/mcp.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  roocode: {
    label: "Roo Code",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [
      { scope: "project", path: ".roo/mcp.json" },
    ],
    personalityDir: null,
    personalityFile: null,
  },
  generic: {
    label: "Generic",
    hasCli: false,
    cliCommand: null,
    configKey: "mcpServers",
    commandIsArray: false,
    urlField: "url",
    configFiles: [],
    personalityDir: null,
    personalityFile: null,
  },
};

function resolveConfigPath(cfgPath: string): string {
  if (cfgPath.startsWith("~/")) {
    return path.join(os.homedir(), cfgPath.slice(2));
  }
  if (cfgPath.startsWith("%APPDATA%")) {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, cfgPath.slice(9));
  }
  return path.resolve(cfgPath);
}

interface StdioConfig {
  "ai-personality": Record<string, unknown>;
}

function usesToml(tool: ToolMcpInfo): boolean {
  return tool.configFiles.length > 0 && tool.configFiles[0].path.endsWith(".toml");
}

function buildConfigEntry(tool: ToolMcpInfo): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  // Auto-detect: use the same executable that launched this server
  // e.g. ["node", "/path/to/build/index.js"] or ["uvx", "ai-personality-server"]
  const selfCmd = process.argv.slice(0, 2);
  if (tool.commandIsArray) {
    entry.command = selfCmd;
  } else {
    entry.command = selfCmd[0];
    entry.args = selfCmd.slice(1);
  }
  if (tool.configKey === "servers") {
    entry.type = "stdio";
  }
  if (tool.configKey === "mcp") {
    entry.enabled = true;
  }
  return entry;
}

function buildStdioConfig(tool: ToolMcpInfo): StdioConfig {
  return { "ai-personality": buildConfigEntry(tool) };
}

function buildConfigSnippet(tool: ToolMcpInfo): string {
  const entry = buildConfigEntry(tool);
  if (usesToml(tool)) {
    const entryLines = [];
    for (const [k, v] of Object.entries(entry)) {
      if (Array.isArray(v)) {
        entryLines.push(`${k} = [${v.map((x) => JSON.stringify(x)).join(", ")}]`);
      } else if (typeof v === "boolean") {
        entryLines.push(`${k} = ${v ? "true" : "false"}`);
      } else {
        entryLines.push(`${k} = ${JSON.stringify(v)}`);
      }
    }
    return `[${tool.configKey}]\n[${tool.configKey}.ai-personality]\n` + entryLines.join("\n");
  }
  const root: Record<string, unknown> = {};
  root[tool.configKey] = { "ai-personality": entry };
  return JSON.stringify(root, null, 2);
}

export function generateCliCommand(client: SupportedClient): string | null {
  return TOOL_CONFIGS[client]?.cliCommand ?? null;
}

export function generateConfigSnippet(client: SupportedClient): string {
  return buildConfigSnippet(TOOL_CONFIGS[client]);
}

export function getConfigPaths(client: SupportedClient): { scope: string; path: string }[] {
  return TOOL_CONFIGS[client]?.configFiles ?? [];
}

/** Returns true if the resolved path is NOT inside the user's home directory (project-level). */
function projectLevelConfigPath(resolved: string): boolean {
  const home = os.homedir().replace(/\\/g, "/").toLowerCase();
  const r = resolved.replace(/\\/g, "/").toLowerCase();
  return !r.startsWith(home);
}

export function applySetup(result: ClientSetup): { written: string[]; errors: string[] } {
  const written: string[] = [];
  const errors: string[] = [];

  for (const hook of result.hooks) {
    try {
      const filePath = path.resolve(hook.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, hook.content, "utf-8");
      written.push(hook.path);
    } catch (e) {
      errors.push(`hook ${hook.path}: ${(e as Error).message}`);
    }
  }

  for (const file of result.files) {
    try {
      const filePath = path.resolve(file.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, file.content, "utf-8");
      written.push(file.path);
    } catch (e) {
      errors.push(`file ${file.path}: ${(e as Error).message}`);
    }
  }

  // Merge MCP server config into the client's config file(s)
  if (result.configSnippet && result.configPaths) {
    const tool = result.client ? TOOL_CONFIGS[result.client as SupportedClient] : undefined;
    if (tool) {
      const configKey = tool.configKey;
      const isToml = usesToml(tool);
      const entry = buildConfigEntry(tool);
      for (const rawPath of result.configPaths) {
        try {
          const resolved = path.resolve(rawPath);
          if (!fs.existsSync(resolved)) {
            if (projectLevelConfigPath(resolved)) {
              fs.mkdirSync(path.dirname(resolved), { recursive: true });
              const content = isToml
                ? `[${configKey}]\n[${configKey}.ai-personality]\n` + Object.entries(entry).map(([k, v]) => Array.isArray(v) ? `${k} = [${v.map(x => JSON.stringify(x)).join(", ")}]` : `${k} = ${JSON.stringify(v)}`).join("\n") + "\n"
                : JSON.stringify({ [configKey]: { "ai-personality": entry } }, null, 2);
              fs.writeFileSync(resolved, content, "utf-8");
              written.push(`${rawPath} (created)`);
            }
            continue;
          }
          const existingRaw = fs.readFileSync(resolved, "utf-8");
          let existing: Record<string, unknown>;
          if (isToml) {
            existing = parseToml(existingRaw) as Record<string, unknown>;
          } else {
            existing = JSON.parse(existingRaw);
          }
          const servers = existing[configKey] as Record<string, unknown> | undefined;
          if (servers && typeof servers === "object" && "ai-personality" in servers) {
            continue;
          }
          existing[configKey] = { ...(existing[configKey] as Record<string, unknown> || {}), "ai-personality": entry };
          const out = isToml ? stringifyToml(existing) : JSON.stringify(existing, null, 2);
          fs.writeFileSync(resolved, out, "utf-8");
          written.push(`${rawPath} (merged ai-personality)`);
        } catch (e) {
          errors.push(`config ${rawPath}: ${(e as Error).message}`);
        }
      }
    }
  }

  return { written, errors };
}

export function detectMcpServerConfig(client: SupportedClient): {
  configured: boolean;
  filesFound: string[];
  error?: string;
} {
  const tool = TOOL_CONFIGS[client];
  if (!tool) return { configured: false, filesFound: [] };

  const isToml = usesToml(tool);
  const filesFound: string[] = [];
  for (const cf of tool.configFiles) {
    const resolved = resolveConfigPath(cf.path);
    if (!fs.existsSync(resolved)) continue;
    filesFound.push(resolved);
    try {
      const raw = fs.readFileSync(resolved, "utf-8");
      let parsed: Record<string, unknown>;
      if (isToml) {
        parsed = parseToml(raw) as Record<string, unknown>;
      } else {
        parsed = JSON.parse(raw);
      }
      const servers = parsed[tool.configKey];
      if (servers && typeof servers === "object" && "ai-personality" in servers) {
        return { configured: true, filesFound };
      }
    } catch {
      // unreadable or invalid config — skip
    }
  }
  return { configured: false, filesFound };
}

function extractPersonaName(identityBody: string): string {
  const m = identityBody.match(/## Name\s*\n([^\n#]+)/);
  if (m) return m[1].trim().replace(/\[|\]/g, "");
  return "AI Assistant";
}

function extractCoreStatement(identityBody: string): string {
  const m = identityBody.match(/## Core Statement\s*\n([\s\S]+?)(?=\n##|$)/);
  if (m) return m[1].trim().slice(0, 300);
  return "";
}

function extractPurpose(identityBody: string): string {
  const m = identityBody.match(/## Purpose\s*\n([\s\S]+?)(?=\n##|$)/);
  if (m) return m[1].trim().slice(0, 400);
  return "";
}

function extractCommunicationStyle(traitsBody: string): string {
  const m = traitsBody.match(/## Communication Style\s*\n([\s\S]+?)(?=\n##|$)/);
  if (m) return m[1].trim().slice(0, 400);
  return "";
}

function buildSessionStartPrompt(
  personaName: string,
  coreStatement: string,
  purpose: string,
  commStyle: string,
): string {
  return [
    `You are ${personaName} — an AI assistant with a persistent, evolving personality.`,
    `Load your full personality now by reading personality://summary from the ai-personality MCP server.`,
    `Then read personality://identity and personality://rules for complete context.`,
    ``,
    coreStatement ? `Core statement: ${coreStatement}` : "",
    purpose ? `Purpose:\n${purpose}` : "",
    commStyle ? `Communication style:\n${commStyle}` : "",
    ``,
    `Your operational skills (loaded this session) are your law. Follow them without exception.`,
    `Do not announce that you loaded your personality. Just be ${personaName} from the first message.`,
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();
}

function buildReflectPrompt(personaName: string): string {
  return [
    `The session is ending. Review what happened and decide if anything is worth logging to ${personaName}'s memory.`,
    ``,
    `Reflect if any of these occurred:`,
    `- A significant problem was solved`,
    `- The user gave feedback (positive or negative) on your behavior`,
    `- You learned something about the user's preferences or workflow`,
    `- A mistake was made and corrected`,
    `- Something changed about how you should behave going forward`,
    ``,
    `If yes: call the reflect tool on the ai-personality MCP server with a concise experience and lesson.`,
    `Set affectedFiles to whichever personality files are relevant.`,
    ``,
    `If nothing significant happened: skip the reflection. Not every session needs a memory.`,
    `Do not announce that you are reflecting. Just do it silently if warranted.`,
  ].join("\n");
}

export function generateClientSetup(client: SupportedClient): ClientSetup {
  ensurePersonalityDir();

  const tool = TOOL_CONFIGS[client];
  const identity = readPersonalityFile("identity.md");
  const traits = readPersonalityFile("traits.md");

  const personaName = extractPersonaName(identity.body);
  const coreStatement = extractCoreStatement(identity.body);
  const purpose = extractPurpose(identity.body);
  const commStyle = extractCommunicationStyle(traits.body);

  const sessionStartPrompt = buildSessionStartPrompt(personaName, coreStatement, purpose, commStyle);
  const reflectPrompt = buildReflectPrompt(personaName);

  const idSlug = personaName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const files: SetupFile[] = [];
  const hooks: SetupHook[] = [];
  const manualSteps: string[] = [];

  const serverCommand = MCP_SERVER_NODE;

  if (client === "kiro") {
    const sessionStartHook: SetupHook = {
      id: `${idSlug}-session-start`,
      name: `${personaName} Personality Load`,
      trigger: "SessionStart",
      path: `.kiro/hooks/${idSlug}-session-start.json`,
      content: JSON.stringify(
        { version: "v1", hooks: [{ name: `${personaName} Personality Load`, trigger: "SessionStart", action: { type: "agent", prompt: sessionStartPrompt } }] },
        null,
        2,
      ),
    };
    const reflectHook: SetupHook = {
      id: `${idSlug}-session-reflect`,
      name: `${personaName} Session Reflect`,
      trigger: "Stop",
      path: `.kiro/hooks/${idSlug}-session-reflect.json`,
      content: JSON.stringify(
        { version: "v1", hooks: [{ name: `${personaName} Session Reflect`, trigger: "Stop", action: { type: "agent", prompt: reflectPrompt } }] },
        null,
        2,
      ),
    };
    hooks.push(sessionStartHook, reflectHook);
    files.push({
      path: `.kiro/steering/${idSlug}-personality.md`,
      description: "Steering file — injects personality context into every session",
      content: [
        `---`, `inclusion: always`, `---`, ``,
        `# ${personaName} Personality`, ``,
        `You are ${personaName}. At the start of each session, load your personality from the ai-personality MCP server:`,
        `- Read \`personality://summary\` for an overview`,
        `- Read \`personality://identity\` and \`personality://rules\` for full context`, ``,
        coreStatement ? `**Core statement**: ${coreStatement}` : "",
        purpose ? `\n**Purpose**:\n${purpose}` : "", ``,
        `Your operational skills loaded this session are your law. Follow them without exception.`,
      ].filter(Boolean).join("\n"),
    });
    if (tool.hasCli && tool.cliCommand) {
      manualSteps.push(
        `Run: ${tool.cliCommand}`,
        "Write each hook file to .kiro/hooks/ using the createHook tool or manually.",
        "Optionally write the steering file to .kiro/steering/ for global personality context injection.",
      );
    } else {
      manualSteps.push(
        "Write each hook file to .kiro/hooks/ using the createHook tool or manually.",
        "Optionally write the steering file to .kiro/steering/ for global personality context injection.",
        "Reconnect the ai-personality MCP server if needed.",
      );
    }
  } else if (client === "cursor") {
    files.push({
      path: ".cursor/rules/personality.mdc",
      description: ".cursor rules file — injects personality at session start",
      content: [
        `---`, `description: Load ${personaName} personality at session start`, `alwaysApply: true`, `---`, ``,
        sessionStartPrompt, ``, reflectPrompt,
      ].join("\n"),
    });
    if (tool.hasCli && tool.cliCommand) {
      manualSteps.push(`Run: ${tool.cliCommand}`, `Write the generated file to .cursor/rules/personality.mdc in your project root.`);
    } else {
      manualSteps.push(
        `Merge the following into ${tool.configFiles[0]?.path ?? "your MCP config"}:\n${buildConfigSnippet(tool)}`,
        `Write the generated file to .cursor/rules/personality.mdc in your project root.`,
      );
    }
  } else if (client === "claude") {
    files.push({
      path: "claude-project-instructions.txt",
      description: "Paste this into Claude.ai Project instructions for persistent personality",
      content: `${sessionStartPrompt}\n\n---\n\nAfter each significant session: ${reflectPrompt}`,
    });
    const configPath = process.platform === "win32"
      ? "%APPDATA%\\Claude\\claude_desktop_config.json"
      : "~/Library/Application Support/Claude/claude_desktop_config.json";
    manualSteps.push(
      `Merge the following into ${configPath}:\n${buildConfigSnippet(tool)}`,
      "For persistent personality: create a Claude.ai Project and paste the generated file content into Project Instructions.",
      "For one-off sessions: paste the session-start prompt at the beginning of each conversation.",
    );
  } else if (client === "opencode") {
    const snippet = buildConfigSnippet(tool);
    files.push({
      path: "opencode.jsonc",
      description: "opencode config snippet — merge into your opencode.jsonc",
      content: JSON.stringify(
        { instructions: [sessionStartPrompt, reflectPrompt], ...JSON.parse(snippet) },
        null,
        2,
      ),
    });
    manualSteps.push(
      `Merge the generated opencode.jsonc snippet into your opencode.jsonc (project or ~/.config/opencode/opencode.jsonc).`,
    );
  } else if (client === "codex") {
    files.push({
      path: ".codex/AGENTS.md",
      description: "Codex CLI agent instructions — auto-loads personality at session start",
      content: [`# ${personaName} Personality`, ``, sessionStartPrompt, ``, `---`, ``, reflectPrompt].join("\n"),
    });
    if (tool.hasCli && tool.cliCommand) {
      manualSteps.push(`Run: ${tool.cliCommand}`, `Write the generated file to .codex/AGENTS.md in your project root.`);
    } else {
      manualSteps.push(
        `Add to your ~/.codex/config.toml under [mcp_servers]:\n[mcp_servers.ai-personality]\ncommand = "npx"\nargs = ["-y", "ai-personality-server"]`,
        `Write the generated file to .codex/AGENTS.md in your project root.`,
      );
    }
  } else if (client === "copilot") {
    files.push({
      path: ".github/copilot-instructions.md",
      description: "GitHub Copilot instructions — injects personality into Copilot chat",
      content: [`# ${personaName} Personality`, ``, sessionStartPrompt, ``, reflectPrompt].join("\n"),
    });
    manualSteps.push(
      `Merge the following into ${tool.configFiles[0]?.path ?? "your MCP config"}:\n${buildConfigSnippet(tool)}`,
      `Write the generated file to .github/copilot-instructions.md in your project root.`,
    );
  } else if (client === "gemini" || client === "antigravity") {
    const isAntigravity = client === "antigravity";
    const toolLabel = isAntigravity ? "Antigravity" : "Gemini CLI";
    files.push({
      path: isAntigravity ? ".gemini/antigravity/personality.md" : ".gemini/personality.md",
      description: `${toolLabel} personality config — auto-loads personality context`,
      content: [`# ${personaName} Personality — ${toolLabel}`, ``, sessionStartPrompt, ``, reflectPrompt].join("\n"),
    });
    if (!isAntigravity && tool.hasCli && tool.cliCommand) {
      manualSteps.push(
        `Run: ${tool.cliCommand}`,
        `Write the generated file to .gemini/personality.md in your project root.`,
      );
    } else {
      manualSteps.push(
        `Merge the following into ${isAntigravity ? "~/.gemini/config/mcp_config.json" : "~/.gemini/settings.json"}:\n${buildConfigSnippet(tool)}`,
        `Write the generated file to ${isAntigravity ? ".gemini/antigravity/" : ".gemini/"} in your project root.`,
      );
    }
  } else if (client === "windsurf") {
    files.push({
      path: ".windsurf/rules/personality.md",
      description: "Windsurf IDE rule file — injects personality at session start",
      content: [
        `---`, `trigger: model_decision`, `description: Load ${personaName} personality at session start`, `---`, ``,
        sessionStartPrompt, ``, reflectPrompt,
      ].join("\n"),
    });
    manualSteps.push(
      `Merge the following into ~/.codeium/windsurf/mcp_config.json:\n${buildConfigSnippet(tool)}`,
      `Write the generated file to .windsurf/rules/personality.md in your project root.`,
    );
  } else if (client === "continue") {
    manualSteps.push(
      `Merge the following into ~/.continue/config.json:\n${buildConfigSnippet(tool)}`,
      "Alternatively, copy the snippet into .continue/mcpServers/ as a .json file for per-project setup.",
      "Paste the session-start prompt into Continue custom instructions or system prompt.",
    );
  } else if (client === "augment") {
    files.push({
      path: "personality-setup.txt",
      description: "Augment Code instructions — paste into Augment system prompt",
      content: [`=== SESSION START PROMPT ===`, sessionStartPrompt, ``, `=== SESSION END PROMPT ===`, reflectPrompt].join("\n"),
    });
    manualSteps.push(
      `Add ai-personality MCP server to Augment via Settings → MCP Servers, or merge into ~/.augment/settings.json:\n${buildConfigSnippet(tool)}`,
      "Paste the session-start prompt into Augment custom instructions or system prompt.",
    );
  } else if (client === "tabnine") {
    files.push({
      path: "personality-setup.txt",
      description: "Tabnine instructions — paste into Tabnine custom instructions",
      content: [`=== SESSION START PROMPT ===`, sessionStartPrompt, ``, `=== SESSION END PROMPT ===`, reflectPrompt].join("\n"),
    });
    manualSteps.push(
      `Run: ${tool.cliCommand}`,
      "Paste the session-start prompt into Tabnine custom instructions.",
    );
  } else if (client === "cline") {
    const snippet = buildConfigSnippet(tool);
    manualSteps.push(
      `Merge the following into ~/.cline/mcp.json:\n${snippet}`,
      "Optionally prepend the session-start prompt to your Cline instructions.",
    );
  } else if (client === "roocode") {
    const snippet = buildConfigSnippet(tool);
    manualSteps.push(
      `Merge the following into .roo/mcp.json (project) or VS Code settings (global):\n${snippet}`,
      "Optionally add the session-start prompt as a system prompt in Roo Code mode configuration.",
    );
  } else {
    files.push({
      path: "personality-setup.txt",
      description: "Generic setup — paste the session-start prompt into your AI client's system prompt field",
      content: [`=== SESSION START PROMPT ===`, sessionStartPrompt, ``, `=== SESSION END PROMPT ===`, reflectPrompt].join("\n"),
    });
    manualSteps.push(
      `Connect ai-personality MCP server: ${serverCommand} (Node) or ${MCP_SERVER_UVX} (Python).`,
      "Paste the session-start prompt into your client's system prompt or instructions field.",
      "Paste the session-end prompt at the end of sessions you want to reflect on.",
    );
  }

  const detected = detectMcpServerConfig(client);

  return {
    client,
    personaName,
    files,
    hooks,
    manualSteps,
    cliCommand: tool?.cliCommand ?? null,
    configSnippet: buildConfigSnippet(tool),
    configPaths: (tool?.configFiles ?? []).map((cf) => resolveConfigPath(cf.path)),
    alreadyConfigured: detected.configured,
  };
}
