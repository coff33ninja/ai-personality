import * as fs from "node:fs";
import * as path from "node:path";
import { PERSONALITY_DIR, readAllPersonalityFiles } from "./personality.js";
import { resolveSkillsDir } from "./skills.js";
import type { CrossRefCheck, CrossRepoCheck } from "./types.js";

function extractHeadings(body: string): string[] {
  const anchors: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^## (.+)/);
    if (m) {
      anchors.push(m[1].toLowerCase().replace(/\s+/g, "-"));
    }
  }
  return anchors;
}

export function validateCrossReferences(): CrossRefCheck[] {
  const files = readAllPersonalityFiles();
  const anchorMap = new Map<string, string[]>();
  for (const f of files) {
    anchorMap.set(f.filename, extractHeadings(f.body));
  }
  const results: CrossRefCheck[] = [];
  for (const f of files) {
    for (const ref of f.frontmatter.crossReferences) {
      const m = ref.match(/^(\w+\.md)#(\S+)\s*--\s*(.+)$/);
      if (!m) {
        results.push({
          sourceFile: f.filename,
          targetFile: "?",
          targetAnchor: "?",
          description: ref,
          valid: false,
          error: "Malformed cross-reference",
        });
        continue;
      }
      const [, targetFile, targetAnchor, desc] = m;
      const headings = anchorMap.get(targetFile);
      if (!headings) {
        results.push({
          sourceFile: f.filename,
          targetFile,
          targetAnchor,
          description: desc,
          valid: false,
          error: `File ${targetFile} not found`,
        });
      } else if (!headings.includes(targetAnchor)) {
        results.push({
          sourceFile: f.filename,
          targetFile,
          targetAnchor,
          description: desc,
          valid: false,
          error: `Anchor #${targetAnchor} not found in ${targetFile}`,
        });
      } else {
        results.push({
          sourceFile: f.filename,
          targetFile,
          targetAnchor,
          description: desc,
          valid: true,
        });
      }
    }
  }
  return results;
}

export function validateCrossRepoReferences(options?: {
  personalityDir?: string;
  skillsDir?: string;
}): CrossRepoCheck[] {
  const pDir = options?.personalityDir ?? PERSONALITY_DIR;
  const sDir = options?.skillsDir ?? resolveSkillsDir();
  const results: CrossRepoCheck[] = [];

  const pFiles = fs.readdirSync(pDir).filter((f) => f.endsWith(".md"));
  for (const pf of pFiles) {
    const raw = fs.readFileSync(path.join(pDir, pf), "utf-8");
    const skillRefs = raw.matchAll(/skills:(\w+)/g);
    for (const m of skillRefs) {
      const skillName = m[1];
      const skillPath = path.join(sDir, skillName, "SKILL.md");
      const exists = fs.existsSync(skillPath);
      results.push({
        source: `personality:${pf}`,
        target: `skills:${skillName}`,
        valid: exists,
        error: exists ? undefined : `Skill "${skillName}" not found in skills repo`,
      });
    }
  }

  if (fs.existsSync(sDir)) {
    const skillDirs = fs.readdirSync(sDir, { withFileTypes: true });
    for (const d of skillDirs) {
      if (!d.isDirectory() || d.name.startsWith(".")) continue;
      const skillMd = path.join(sDir, d.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      const raw = fs.readFileSync(skillMd, "utf-8");
      const pRefs = raw.matchAll(/personality:(\w+\.md)/g);
      for (const m of pRefs) {
        const pFile = m[1];
        const pPath = path.join(pDir, pFile);
        const exists = fs.existsSync(pPath);
        results.push({
          source: `skills:${d.name}/SKILL.md`,
          target: `personality:${pFile}`,
          valid: exists,
          error: exists ? undefined : `Personality file "${pFile}" not found`,
        });
      }
    }
  }

  return results;
}
