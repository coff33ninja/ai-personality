export interface PersonaFrontmatter {
  type: string;
  version: number;
  lastUpdated: string;
  evolution: number;
  crossReferences: string[];
}

export interface PersonaFile {
  filename: string;
  frontmatter: PersonaFrontmatter;
  body: string;
  raw: string;
}

export interface MemoryEntry {
  date: string;
  experience: string;
  lesson: string;
  impact: string;
  affectedFiles: string[];
}

export interface CrossRefCheck {
  sourceFile: string;
  targetFile: string;
  targetAnchor: string;
  description: string;
  valid: boolean;
  error?: string;
}

export interface FileStatus {
  name: string;
  evolution: number;
  lastUpdated: string;
  refCount: number;
}

export interface PersonaStatus {
  files: FileStatus[];
  totalEvolutions: number;
  lastReflection: string | null;
  pendingCount: number;
}

export interface SkillInfo {
  name: string;
  description: string;
  fileCount: number;
  bodyPreview: string;
}

export interface SkillFile {
  filename: string;
  content: string;
}

export interface CrossRepoCheck {
  source: string;
  target: string;
  valid: boolean;
  error?: string;
}

export type SupportedClient =
  | "kiro"
  | "cursor"
  | "claude"
  | "opencode"
  | "codex"
  | "copilot"
  | "gemini"
  | "antigravity"
  | "windsurf"
  | "continue"
  | "augment"
  | "tabnine"
  | "cline"
  | "roocode"
  | "generic";

export interface SetupFile {
  /** Relative or absolute path where this file should be written */
  path: string;
  /** File content */
  content: string;
  /** Human-readable description of what this file does */
  description: string;
}

export interface SetupHook {
  /** Hook id (used as filename stem for Kiro) */
  id: string;
  /** Human-readable hook name */
  name: string;
  /** Trigger event */
  trigger: string;
  /** Full hook JSON content ready to write */
  content: string;
  /** Target path relative to workspace root */
  path: string;
}

export interface ClientSetup {
  client: SupportedClient;
  /** Persona name extracted from identity.md */
  personaName: string;
  /** Files to create (steering files, .cursorrules, etc.) */
  files: SetupFile[];
  /** Hook definitions (Kiro only — write to .kiro/hooks/) */
  hooks: SetupHook[];
  /** Human-readable instructions for steps that cannot be automated */
  manualSteps: string[];
  /** CLI command to register the MCP server (null if tool has no CLI) */
  cliCommand?: string | null;
  /** JSON/TOML config snippet in the tool's config format */
  configSnippet?: string;
  /** Resolved config file paths for MCP server configuration */
  configPaths?: string[];
  /** Whether ai-personality MCP server is already in the config */
  alreadyConfigured?: boolean;
}
