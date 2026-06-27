import json
import os
import re
import subprocess
from pathlib import Path

import yaml


SKILLS_REPO = "https://github.com/coff33ninja/ai-skills"
SKILLS_CLONE_DIR = Path.home() / ".ai-personality" / "skills"


def resolve_skills_dir() -> Path:
    nested = SKILLS_CLONE_DIR / "skills"
    if nested.exists():
        return nested
    return SKILLS_CLONE_DIR


def ensure_skills_dir() -> None:
    if SKILLS_CLONE_DIR.exists():
        return
    SKILLS_CLONE_DIR.parent.mkdir(parents=True, exist_ok=True)
    print(f"Cloning ai-skills to {SKILLS_CLONE_DIR}...", file=__import__("sys").stderr)
    subprocess.run(
        ["git", "clone", SKILLS_REPO, str(SKILLS_CLONE_DIR)],
        check=True,
        timeout=60,
        capture_output=True,
    )
    print("ai-skills cloned successfully.", file=__import__("sys").stderr)


def sync_skills() -> dict:
    ensure_skills_dir()
    try:
        subprocess.run(
            ["git", "-C", str(SKILLS_CLONE_DIR), "pull", "--ff-only"],
            check=True,
            timeout=30,
            capture_output=True,
        )
        return {"ok": True, "message": "Skills synced from remote."}
    except subprocess.CalledProcessError as e:
        return {
            "ok": False,
            "message": f"Sync failed: {e.stderr.decode() if e.stderr else str(e)}",
        }


def _find_skill_dirs() -> list[str]:
    ensure_skills_dir()
    base = resolve_skills_dir()
    dirs = []
    for entry in base.iterdir():
        if entry.is_dir() and not entry.name.startswith("."):
            if (entry / "SKILL.md").exists():
                dirs.append(entry.name)
    return sorted(dirs)


def _parse_skill_frontmatter(raw: str) -> tuple[dict, str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)", raw, re.DOTALL)
    if not m:
        return {}, raw.strip()
    data = yaml.safe_load(m.group(1)) or {}
    return data, m.group(2).strip()


def get_skills_catalog() -> list[dict]:
    skills = []
    for name in _find_skill_dirs():
        base = resolve_skills_dir()
        skill_path = base / name / "SKILL.md"
        raw = skill_path.read_text("utf-8")
        fm, body = _parse_skill_frontmatter(raw)
        files = [
            f.name
            for f in (base / name).iterdir()
            if f.is_file() and not f.name.startswith(".") and f.name != "SKILL.md"
        ]
        skills.append(
            {
                "name": name,
                "description": fm.get("description", ""),
                "fileCount": len(files),
                "bodyPreview": body[:200],
            }
        )
    return skills


def get_skill_files(name: str) -> list[dict]:
    base = resolve_skills_dir()
    skill_dir = base / name
    skill_md = skill_dir / "SKILL.md"
    if not skill_dir.exists() or not skill_md.exists():
        raise ValueError(f'Skill "{name}" not found in {base}')
    files = []
    for entry in skill_dir.iterdir():
        if entry.is_file() and not entry.name.startswith("."):
            files.append({"filename": entry.name, "content": entry.read_text("utf-8")})
    return files


def search_skills(query: str) -> list[dict]:
    q = query.lower()
    base = resolve_skills_dir()
    results = []
    for name in _find_skill_dirs():
        skill_path = base / name / "SKILL.md"
        raw = skill_path.read_text("utf-8")
        fm, body = _parse_skill_frontmatter(raw)
        haystack = f"{name} {json.dumps(fm)} {body}".lower()
        if q in haystack:
            files = [
                f.name
                for f in (base / name).iterdir()
                if f.is_file() and not f.name.startswith(".") and f.name != "SKILL.md"
            ]
            results.append(
                {
                    "name": name,
                    "description": fm.get("description", ""),
                    "fileCount": len(files),
                    "bodyPreview": body[:200],
                }
            )
    return results
