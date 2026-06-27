import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { generateDefaultFiles } from "./defaults.js";
import type {
  PersonaFrontmatter,
  PersonaFile,
  MemoryEntry,
  FileStatus,
  PersonaStatus,
} from "./types.js";

const HOME_PATH = path.join(os.homedir(), ".ai-personality", "personality");
export const PERSONALITY_DIR = process.env.AI_PERSONALITY_DIR
  ? path.resolve(process.env.AI_PERSONALITY_DIR)
  : HOME_PATH;

const FILE_NAMES = [
  "identity.md",
  "traits.md",
  "values.md",
  "rules.md",
  "memories.md",
  "relationships.md",
];

let _initDone = false;

export function ensurePersonalityDir(): void {
  if (_initDone) return;
  _initDone = true;
  if (!fs.existsSync(PERSONALITY_DIR)) {
    fs.mkdirSync(PERSONALITY_DIR, { recursive: true });
    console.error(`Created personality directory: ${PERSONALITY_DIR}`);
  }
  const defaults = generateDefaultFiles(PERSONALITY_DIR);
  for (const f of defaults) {
    const fp = path.join(PERSONALITY_DIR, f.filename);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, f.content, "utf-8");
      console.error(`Created ${f.filename}`);
    }
  }
}

function yamlVal(v: unknown): string {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return (v as Date).toISOString().split("T")[0];
  }
  return String(v ?? "");
}

function parseFrontmatter(raw: string): { frontmatter: PersonaFrontmatter; body: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const data = yaml.load(match[1]) as Record<string, unknown>;
  return {
    frontmatter: {
      type: yamlVal(data.type),
      version: Number(data.version ?? 0),
      lastUpdated: yamlVal(data.lastUpdated),
      evolution: Number(data.evolution ?? 0),
      crossReferences: Array.isArray(data.crossReferences)
        ? (data.crossReferences as string[]).map((r) => String(r))
        : [],
    },
    body: match[2].trim(),
  };
}

function updateFrontmatterField(filename: string, field: string, value: unknown): void {
  const filePath = path.join(PERSONALITY_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Cannot parse frontmatter in ${filename}`);
  const data = yaml.load(match[1]) as Record<string, unknown>;
  data[field] = value;
  const newFm = dumpYaml(data);
  const newRaw = `---\n${newFm}---\n${match[2]}`;
  fs.writeFileSync(filePath, newRaw, "utf-8");
}

function readFile(filename: string): PersonaFile {
  ensurePersonalityDir();
  const filePath = path.join(PERSONALITY_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontmatter(raw);
  return {
    filename,
    frontmatter: parsed?.frontmatter ?? {
      type: "unknown",
      version: 0,
      lastUpdated: "unknown",
      evolution: 0,
      crossReferences: [],
    },
    body: parsed?.body ?? raw,
    raw,
  };
}

export function readPersonalityFile(filename: string): PersonaFile {
  if (!FILE_NAMES.includes(filename)) {
    throw new Error(`Unknown personality file: ${filename}. Valid: ${FILE_NAMES.join(", ")}`);
  }
  return readFile(filename);
}

export function readAllPersonalityFiles(): PersonaFile[] {
  return FILE_NAMES.map((f) => readFile(f));
}

export function getSummary(): string {
  const files = readAllPersonalityFiles();
  const parts = files.map((f) => {
    const name = f.filename.replace(".md", "");
    const type = f.frontmatter.type;
    const evo = f.frontmatter.evolution;
    const refs = f.frontmatter.crossReferences.length;
    let preview = f.body.slice(0, 300);
    if (f.body.length > 300) preview += "...";
    return `=== ${name} (${type}, evolution ${evo}, ${refs} refs) ===\n${preview}`;
  });
  return parts.join("\n\n");
}

export function reflect(
  experience: string,
  lesson: string,
  affectedFiles?: string[],
): { date: string; entries: MemoryEntry[] } {
  const filePath = path.join(PERSONALITY_DIR, "memories.md");
  let raw = fs.readFileSync(filePath, "utf-8");
  const date = new Date().toISOString().split("T")[0];
  const newEntry: MemoryEntry = {
    date,
    experience,
    lesson,
    impact: "under review",
    affectedFiles: affectedFiles ?? [],
  };
  const marker = "<!-- entries -->";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex === -1) {
    raw = `${raw}\n\n${marker}\n\n\`\`\`yaml\n${dumpYaml([newEntry])}\`\`\`\n`;
  } else {
    const afterMarker = raw.slice(markerIndex + marker.length);
    const yamlMatch = afterMarker.match(/```yaml\n([\s\S]*?)```/);
    if (yamlMatch) {
      const existing = cleanDates(yaml.load(yamlMatch[1])) as MemoryEntry[];
      existing.push(newEntry);
      const absStart = markerIndex + marker.length + yamlMatch.index!;
      const absEnd = absStart + yamlMatch[0].length;
      raw = raw.slice(0, absStart) + "```yaml\n" + dumpYaml(existing) + "```" + raw.slice(absEnd);
    } else {
      const insertPos = markerIndex + marker.length;
      raw = raw.slice(0, insertPos) + `\n\n\`\`\`yaml\n${dumpYaml([newEntry])}\`\`\`\n` + raw.slice(insertPos);
    }
  }
  fs.writeFileSync(filePath, raw, "utf-8");

  const entries = loadMemoryEntries(raw);
  return { date, entries };
}

function dumpYaml(data: unknown): string {
  const out = yaml.dump(data, { lineWidth: -1, noRefs: true });
  return out.replace(/['"](\d{4}-\d{2}-\d{2})['"]/g, "$1");
}

function cleanDates(v: unknown): unknown {
  if (Object.prototype.toString.call(v) === "[object Date]") return (v as Date).toISOString().split("T")[0];
  if (Array.isArray(v)) return v.map(cleanDates);
  if (v !== null && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = cleanDates(val);
    }
    return o;
  }
  return v;
}

function loadMemoryEntries(raw: string): MemoryEntry[] {
  const marker = "<!-- entries -->";
  const markerIndex = raw.indexOf(marker);
  if (markerIndex === -1) return [];
  const afterMarker = raw.slice(markerIndex + marker.length);
  const match = afterMarker.match(/```yaml\n([\s\S]*?)```/);
  if (!match) return [];
  return cleanDates(yaml.load(match[1])) as MemoryEntry[];
}

export function getStatus(): PersonaStatus {
  const files = readAllPersonalityFiles().map((f) => ({
    name: f.filename,
    evolution: f.frontmatter.evolution,
    lastUpdated: f.frontmatter.lastUpdated,
    refCount: f.frontmatter.crossReferences.length,
  }));

  const memFile = readFile("memories.md");
  const entries = loadMemoryEntries(memFile.raw);
  const lastReflection = entries.length > 0 ? entries[entries.length - 1].date : null;
  const pendingCount = entries.filter((e) => e.impact === "under review").length;
  const totalEvolutions = files.reduce((s, f) => s + f.evolution, 0);

  return { files, totalEvolutions, lastReflection, pendingCount };
}

export function getPendingEvolutions(): MemoryEntry[] {
  const memFile = readFile("memories.md");
  const entries = loadMemoryEntries(memFile.raw);
  return entries.filter((e) => e.impact === "under review");
}
