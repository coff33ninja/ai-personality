import os
import time
import sqlite3
import struct
import threading
from pathlib import Path

from . import personality

_RAG_DIR = None
_DB: sqlite3.Connection | None = None
_MODEL = None
_WATCHER_THREAD: threading.Thread | None = None
_WATCHER_STOP = threading.Event()
_WATCHER_MTIMES: dict[str, float] = {}


def _get_rag_dir() -> Path:
    global _RAG_DIR
    if _RAG_DIR is not None:
        return _RAG_DIR
    env = os.environ.get("AI_PERSONALITY_DIR")
    if env:
        _RAG_DIR = Path(env).resolve().parent / "rag"
    else:
        _RAG_DIR = Path.home() / ".ai-personality" / "rag"
    _RAG_DIR.mkdir(parents=True, exist_ok=True)
    return _RAG_DIR


def _get_db() -> sqlite3.Connection:
    global _DB
    if _DB is not None:
        return _DB
    db_path = _get_rag_dir() / "vector.db"
    _DB = sqlite3.connect(str(db_path))
    _DB.execute(
        "CREATE TABLE IF NOT EXISTS chunks ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  filename TEXT NOT NULL,"
        "  heading TEXT,"
        "  content TEXT NOT NULL,"
        "  embedding BLOB NOT NULL,"
        "  type TEXT NOT NULL"
        ")"
    )
    return _DB


def _get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from fastembed import TextEmbedding

    _MODEL = TextEmbedding("BAAI/bge-small-en-v1.5")
    return _MODEL


def _chunk_content(filename: str, type_name: str, body: str) -> list[dict]:
    lines = body.split("\n")
    chunks: list[dict] = []
    current_heading = ""
    current_lines: list[str] = []

    for line in lines:
        m = __import__("re").match(r"^(#{2,3})\s+(.+)", line)
        if m:
            if current_lines:
                chunks.append(
                    {
                        "filename": filename,
                        "heading": current_heading,
                        "content": "\n".join(current_lines).strip(),
                        "type": type_name,
                    }
                )
            current_heading = m.group(2).strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines:
        chunks.append(
            {
                "filename": filename,
                "heading": current_heading,
                "content": "\n".join(current_lines).strip(),
                "type": type_name,
            }
        )

    return chunks


def _float32_to_blob(vec: list[float]) -> bytes:
    return struct.pack(f"{len(vec)}f", *vec)


def _blob_to_float32(blob: bytes) -> list[float]:
    return list(struct.unpack(f"{len(blob) // 4}f", blob))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = na = nb = 0.0
    for i in range(len(a)):
        dot += a[i] * b[i]
        na += a[i] * a[i]
        nb += b[i] * b[i]
    return dot / ((na ** 0.5) * (nb ** 0.5))


def build_index() -> int:
    db = _get_db()
    db.execute("DELETE FROM chunks")

    model = _get_model()
    files = personality.read_all_personality_files()
    total = 0

    for f in files:
        chunks = _chunk_content(f["filename"], f["frontmatter"].get("type", "?"), f["body"])
        texts = [c["content"][:512] for c in chunks]

        for chunk, embedding in zip(chunks, model.embed(texts)):
            blob = _float32_to_blob(list(embedding))
            db.execute(
                "INSERT INTO chunks (filename, heading, content, embedding, type) VALUES (?, ?, ?, ?, ?)",
                (chunk["filename"], chunk["heading"], chunk["content"], blob, chunk["type"]),
            )
            total += 1

    db.commit()
    print(f"Indexed {total} chunks", file=__import__("sys").stderr)
    return total


def search(query: str, top_k: int = 5) -> list[dict]:
    db = _get_db()
    rows = db.execute("SELECT * FROM chunks").fetchall()
    if not rows:
        return []

    model = _get_model()
    query_emb = list(next(model.embed([query])))
    columns = [desc[0] for desc in db.execute("SELECT * FROM chunks").description]

    scored: list[tuple[dict, float]] = []
    for row in rows:
        chunk = dict(zip(columns, row))
        stored = _blob_to_float32(chunk["embedding"])
        score = _cosine_similarity(query_emb, stored)
        scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [
        {
            "filename": chunk["filename"],
            "heading": chunk["heading"],
            "content": chunk["content"],
            "type": chunk["type"],
            "score": score,
        }
        for chunk, score in scored[:top_k]
    ]


def _watcher_loop():
    dir_path = personality.PERSONALITY_DIR

    while not _WATCHER_STOP.is_set():
        if dir_path.exists():
            for fname in personality.FILE_NAMES:
                fp = dir_path / fname
                if fp.exists():
                    mtime = fp.stat().st_mtime
                    prev = _WATCHER_MTIMES.get(fname)
                    if prev is not None and mtime != prev:
                        print(f"Personality file changed: {fname}, reindexing...", file=__import__("sys").stderr)
                        try:
                            n = build_index()
                            print(f"Reindexed {n} chunks after change to {fname}", file=__import__("sys").stderr)
                        except Exception as e:
                            print(f"Reindex failed: {e}", file=__import__("sys").stderr)
                    _WATCHER_MTIMES[fname] = mtime
        _WATCHER_STOP.wait(2.0)


def start_watcher():
    global _WATCHER_THREAD
    if _WATCHER_THREAD is not None:
        return

    dir_path = personality.PERSONALITY_DIR
    if dir_path.exists():
        for fname in personality.FILE_NAMES:
            fp = dir_path / fname
            if fp.exists():
                _WATCHER_MTIMES[fname] = fp.stat().st_mtime

    _WATCHER_STOP.clear()
    _WATCHER_THREAD = threading.Thread(target=_watcher_loop, daemon=True)
    _WATCHER_THREAD.start()


def stop_watcher():
    _WATCHER_STOP.set()
    global _WATCHER_THREAD
    if _WATCHER_THREAD:
        _WATCHER_THREAD.join(timeout=3)
        _WATCHER_THREAD = None


def close():
    stop_watcher()
    global _DB
    if _DB:
        _DB.close()
        _DB = None
