import os
import re
from pathlib import Path

import yaml

from .defaults import generate_default_files

FILE_NAMES = [
    "identity.md",
    "traits.md",
    "values.md",
    "rules.md",
    "memories.md",
    "relationships.md",
]


def get_personality_dir() -> Path:
    env = os.environ.get("AI_PERSONALITY_DIR")
    if env:
        return Path(env).resolve()
    return Path.home() / ".ai-personality" / "personality"


PERSONALITY_DIR = get_personality_dir()
_init_done = False


def ensure_personality_dir() -> None:
    global _init_done
    if _init_done:
        return
    _init_done = True
    PERSONALITY_DIR.mkdir(parents=True, exist_ok=True)
    print(
        f"Created personality directory: {PERSONALITY_DIR}",
        file=__import__("sys").stderr,
    )
    for filename, content in generate_default_files().items():
        fp = PERSONALITY_DIR / filename
        if not fp.exists():
            fp.write_text(content, encoding="utf-8")
            print(f"Created {filename}", file=__import__("sys").stderr)


def _parse_frontmatter(raw: str) -> tuple[dict | None, str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)", raw, re.DOTALL)
    if not m:
        return None, raw
    data = yaml.safe_load(m.group(1))
    return data or {}, m.group(2).strip()


def _read_file(filename: str) -> dict:
    ensure_personality_dir()
    fp = PERSONALITY_DIR / filename
    raw = fp.read_text("utf-8")
    fm, body = _parse_frontmatter(raw)
    return {
        "filename": filename,
        "frontmatter": fm or {},
        "body": body,
        "raw": raw,
    }


def _load_memory_entries(raw: str) -> list[dict]:
    marker = "<!-- entries -->"
    idx = raw.find(marker)
    if idx == -1:
        return []
    after = raw[idx + len(marker) :]
    m = re.search(r"```yaml\n(.*?)```", after, re.DOTALL)
    if not m:
        return []
    entries = yaml.safe_load(m.group(1))
    if not entries:
        return []
    return entries if isinstance(entries, list) else [entries]


def _dump_yaml(data) -> str:
    out = yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False)
    out = re.sub(r"['\"](\d{4}-\d{2}-\d{2})['\"]", r"\1", out)
    return out


def read_personality_file(filename: str) -> dict:
    if filename not in FILE_NAMES:
        raise ValueError(f"Unknown personality file: {filename}")
    return _read_file(filename)


def read_all_personality_files() -> list[dict]:
    return [_read_file(f) for f in FILE_NAMES]


def get_summary() -> str:
    parts = []
    for f in read_all_personality_files():
        name = f["filename"].replace(".md", "")
        fm = f["frontmatter"]
        preview = f["body"][:300]
        if len(f["body"]) > 300:
            preview += "..."
        parts.append(
            f"=== {name} ({fm.get('type', '?')}, evolution {fm.get('evolution', 0)}, {len(fm.get('crossReferences', []))} refs) ===\n{preview}"
        )
    return "\n\n".join(parts)


def reflect(
    experience: str, lesson: str, affected_files: list[str] | None = None
) -> dict:
    from datetime import date

    fp = PERSONALITY_DIR / "memories.md"
    raw = fp.read_text("utf-8")
    today_str = date.today().isoformat()
    new_entry = {
        "date": today_str,
        "experience": experience,
        "lesson": lesson,
        "impact": "under review",
        "affectedFiles": affected_files or [],
    }
    marker = "<!-- entries -->"
    idx = raw.find(marker)
    if idx == -1:
        raw += f"\n\n{marker}\n\n```yaml\n{_dump_yaml([new_entry])}```\n"
    else:
        after = raw[idx + len(marker) :]
        ym = re.search(r"```yaml\n(.*?)```", after, re.DOTALL)
        if ym:
            abs_start = idx + len(marker) + ym.start()
            abs_end = abs_start + len(ym.group(0))
            existing = yaml.safe_load(ym.group(1)) or []
            if not isinstance(existing, list):
                existing = [existing]
            existing.append(new_entry)
            raw = (
                raw[:abs_start]
                + "```yaml\n"
                + _dump_yaml(existing)
                + "```"
                + raw[abs_end:]
            )
        else:
            insert = idx + len(marker)
            raw = (
                raw[:insert]
                + f"\n\n```yaml\n{_dump_yaml([new_entry])}```\n"
                + raw[insert:]
            )

    fp.write_text(raw, "utf-8")
    entries = _load_memory_entries(raw)
    return {"date": today_str, "entries": entries}


def get_status() -> dict:
    files = []
    total_evo = 0
    for f in read_all_personality_files():
        fm = f["frontmatter"]
        files.append(
            {
                "name": f["filename"],
                "evolution": fm.get("evolution", 0),
                "lastUpdated": str(fm.get("lastUpdated", "?")),
                "refCount": len(fm.get("crossReferences", [])),
            }
        )
        total_evo += fm.get("evolution", 0)

    mem = _read_file("memories.md")
    entries = _load_memory_entries(mem["raw"])
    last_ref = entries[-1]["date"] if entries else None
    pending = sum(1 for e in entries if e.get("impact") == "under review")

    return {
        "files": files,
        "totalEvolutions": total_evo,
        "lastReflection": last_ref,
        "pendingCount": pending,
    }


def get_pending_evolutions() -> list[dict]:
    mem = _read_file("memories.md")
    entries = _load_memory_entries(mem["raw"])
    return [e for e in entries if e.get("impact") == "under review"]
