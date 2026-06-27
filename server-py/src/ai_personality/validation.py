import re
from pathlib import Path

from .personality import read_all_personality_files, get_personality_dir
from .skills import resolve_skills_dir


def _extract_headings(body: str) -> list[str]:
    return [
        m.group(1).lower().replace(" ", "-")
        for m in re.finditer(r"^## (.+)", body, re.MULTILINE)
    ]


def validate_cross_references() -> list[dict]:
    files = read_all_personality_files()
    anchor_map: dict[str, list[str]] = {}
    for f in files:
        anchor_map[f["filename"]] = _extract_headings(f["body"])

    results = []
    for f in files:
        for ref in f["frontmatter"].get("crossReferences", []):
            m = re.match(r"^(\w+\.md)#(\S+)\s*--\s*(.+)$", ref)
            if not m:
                results.append(
                    {
                        "sourceFile": f["filename"],
                        "targetFile": "?",
                        "targetAnchor": "?",
                        "description": ref,
                        "valid": False,
                        "error": "Malformed cross-reference",
                    }
                )
                continue
            target_file, target_anchor, desc = m.groups()
            headings = anchor_map.get(target_file)
            if headings is None:
                results.append(
                    {
                        "sourceFile": f["filename"],
                        "targetFile": target_file,
                        "targetAnchor": target_anchor,
                        "description": desc,
                        "valid": False,
                        "error": f"File {target_file} not found",
                    }
                )
            elif target_anchor not in headings:
                results.append(
                    {
                        "sourceFile": f["filename"],
                        "targetFile": target_file,
                        "targetAnchor": target_anchor,
                        "description": desc,
                        "valid": False,
                        "error": f"Anchor #{target_anchor} not found in {target_file}",
                    }
                )
            else:
                results.append(
                    {
                        "sourceFile": f["filename"],
                        "targetFile": target_file,
                        "targetAnchor": target_anchor,
                        "description": desc,
                        "valid": True,
                    }
                )
    return results


def validate_cross_repo_references(
    personality_dir: Path | str | None = None,
    skills_dir: Path | str | None = None,
) -> list[dict]:
    p_dir = Path(personality_dir) if personality_dir else get_personality_dir()
    s_dir = Path(skills_dir) if skills_dir else resolve_skills_dir()
    results = []

    if p_dir.exists():
        for pf in p_dir.iterdir():
            if not pf.name.endswith(".md") or not pf.is_file():
                continue
            raw = pf.read_text("utf-8")
            for m in re.finditer(r"skills:(\w+)", raw):
                skill_name = m.group(1)
                skill_path = s_dir / skill_name / "SKILL.md"
                exists = skill_path.exists()
                results.append(
                    {
                        "source": f"personality:{pf.name}",
                        "target": f"skills:{skill_name}",
                        "valid": exists,
                        "error": (
                            None
                            if exists
                            else f'Skill "{skill_name}" not found in skills repo'
                        ),
                    }
                )

    if s_dir.exists():
        for entry in s_dir.iterdir():
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            skill_md = entry / "SKILL.md"
            if not skill_md.exists():
                continue
            raw = skill_md.read_text("utf-8")
            for m in re.finditer(r"personality:(\w+\.md)", raw):
                p_file = m.group(1)
                p_path = p_dir / p_file
                exists = p_path.exists()
                results.append(
                    {
                        "source": f"skills:{entry.name}/SKILL.md",
                        "target": f"personality:{p_file}",
                        "valid": exists,
                        "error": (
                            None if exists else f'Personality file "{p_file}" not found'
                        ),
                    }
                )

    return results
