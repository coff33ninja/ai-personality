import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as yaml from "js-yaml";
import type { SkillInfo, SkillFile } from "./types.js";

const SKILLS_REPO = "https://github.com/coff33ninja/ai-skills";
const SKILLS_CLONE_DIR = path.join(os.homedir(), ".ai-personality", "skills");

export function resolveSkillsDir(): string {
  const nested = path.join(SKILLS_CLONE_DIR, "skills");
  if (fs.existsSync(nested)) return nested;
  return SKILLS_CLONE_DIR;
}

export function ensureSkillsDir(): void {
  if (fs.existsSync(SKILLS_CLONE_DIR)) return;
  const parent = path.dirname(SKILLS_CLONE_DIR);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  console.error(`Cloning ai-skills to ${SKILLS_CLONE_DIR}...`);
  execSync(`git clone ${SKILLS_REPO} "${SKILLS_CLONE_DIR}"`, { stdio: "ignore", timeout: 60000 });
  console.error("ai-skills cloned successfully.");
}

export function syncSkills(): { ok: boolean; message: string } {
  ensureSkillsDir();
  try {
    execSync(`git -C "${SKILLS_CLONE_DIR}" pull --ff-only`, { stdio: "ignore", timeout: 30000 });
    return { ok: true, message: "Skills synced from remote." };
  } catch (e) {
    return { ok: false, message: `Sync failed: ${(e as Error).message}` };
  }
}

function findSkillDirs(): string[] {
  ensureSkillsDir();
  const dir = resolveSkillsDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dirs: string[] = [];
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith(".")) {
      const skillMd = path.join(dir, e.name, "SKILL.md");
      if (fs.existsSync(skillMd)) dirs.push(e.name);
    }
  }
  return dirs.sort();
}

function parseSkillFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const data = yaml.load(match[1]) as Record<string, unknown> ?? {};
  return { frontmatter: data, body: match[2].trim() };
}

export function getSkillsCatalog(): SkillInfo[] {
  const dirs = findSkillDirs();
  const base = resolveSkillsDir();
  const skills: SkillInfo[] = [];
  for (const name of dirs) {
    const skillPath = path.join(base, name, "SKILL.md");
    const raw = fs.readFileSync(skillPath, "utf-8");
    const { frontmatter, body } = parseSkillFrontmatter(raw);
    const files = fs.readdirSync(path.join(base, name)).filter((f) => f !== "SKILL.md" && !f.startsWith("."));
    skills.push({
      name,
      description: (frontmatter.description as string) ?? "",
      fileCount: files.length,
      bodyPreview: body.slice(0, 200),
    });
  }
  return skills;
}

export function getSkillFiles(name: string): SkillFile[] {
  const base = resolveSkillsDir();
  const skillDir = path.join(base, name);
  if (!fs.existsSync(skillDir) || !fs.existsSync(path.join(skillDir, "SKILL.md"))) {
    throw new Error(`Skill "${name}" not found in ${base}`);
  }
  const entries = fs.readdirSync(skillDir, { withFileTypes: true });
  const files: SkillFile[] = [];
  for (const e of entries) {
    if (e.isFile() && !e.name.startsWith(".")) {
      const fp = path.join(skillDir, e.name);
      files.push({ filename: e.name, content: fs.readFileSync(fp, "utf-8") });
    }
  }
  return files;
}

export function searchSkills(query: string): SkillInfo[] {
  const q = query.toLowerCase();
  const dirs = findSkillDirs();
  const base = resolveSkillsDir();
  const results: SkillInfo[] = [];
  for (const name of dirs) {
    const skillPath = path.join(base, name, "SKILL.md");
    const raw = fs.readFileSync(skillPath, "utf-8");
    const { frontmatter, body } = parseSkillFrontmatter(raw);
    const haystack = `${name} ${JSON.stringify(frontmatter)} ${body}`.toLowerCase();
    if (haystack.includes(q)) {
      const files = fs.readdirSync(path.join(base, name)).filter((f) => f !== "SKILL.md" && !f.startsWith("."));
      results.push({
        name,
        description: (frontmatter.description as string) ?? "",
        fileCount: files.length,
        bodyPreview: body.slice(0, 200),
      });
    }
  }
  return results;
}
