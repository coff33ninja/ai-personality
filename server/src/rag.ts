import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import Database from "better-sqlite3";
import * as personality from "./personality.js";

const RAG_DIR = process.env.AI_PERSONALITY_DIR
  ? path.resolve(process.env.AI_PERSONALITY_DIR, "..", "rag")
  : path.join(os.homedir(), ".ai-personality", "rag");

const DB_PATH = path.join(RAG_DIR, "vector.db");

interface ChunkRow {
  id: number;
  filename: string;
  heading: string;
  content: string;
  embedding: Buffer;
  type: string;
}

export interface SearchResult {
  filename: string;
  heading: string;
  content: string;
  type: string;
  score: number;
}

let _pipe: any = null;
let _db: Database.Database | null = null;
let _watcher: fs.FSWatcher | null = null;

async function getPipe() {
  if (!_pipe) {
    const { pipeline: p } = await import("@xenova/transformers");
    _pipe = await p("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return _pipe;
}

function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(RAG_DIR)) {
    fs.mkdirSync(RAG_DIR, { recursive: true });
  }
  _db = new Database(DB_PATH);
  _db.exec(`CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    heading TEXT,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    type TEXT NOT NULL
  )`);
  return _db;
}

function chunkContent(filename: string, type: string, body: string): Array<{ filename: string; heading: string; content: string; type: string }> {
  const lines = body.split("\n");
  const chunks: Array<{ filename: string; heading: string; content: string; type: string }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        chunks.push({ filename, heading: currentHeading, content: currentLines.join("\n").trim(), type });
      }
      currentHeading = headingMatch[2].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    chunks.push({ filename, heading: currentHeading, content: currentLines.join("\n").trim(), type });
  }
  return chunks;
}

export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getPipe();
  const result = await pipe(text, { pooling: "mean", normalize: true });
  return result.data as Float32Array;
}

export async function buildIndex(): Promise<number> {
  const db = getDb();
  db.exec("DELETE FROM chunks");

  const files = personality.readAllPersonalityFiles();
  const insert = db.prepare("INSERT INTO chunks (filename, heading, content, embedding, type) VALUES (?, ?, ?, ?, ?)");

  let total = 0;
  for (const f of files) {
    const chunks = chunkContent(f.filename, f.frontmatter.type, f.body);
    for (const chunk of chunks) {
      try {
        const emb = await embed(chunk.content.slice(0, 512));
        const buffer = Buffer.from(emb.buffer);
        insert.run(chunk.filename, chunk.heading, chunk.content, buffer, chunk.type);
        total++;
      } catch (err) {
        console.error(`Failed to embed chunk from ${f.filename}:`, err);
      }
    }
  }
  console.error(`Indexed ${total} chunks`);
  return total;
}

export async function search(query: string, topK: number = 5): Promise<SearchResult[]> {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM chunks").all() as ChunkRow[];
  if (rows.length === 0) return [];

  const queryEmb = await embed(query);
  const scored = rows.map((row) => {
    const storedEmb = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
    return { row, score: cosineSimilarity(queryEmb, storedEmb) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((r) => ({
    filename: r.row.filename,
    heading: r.row.heading,
    content: r.row.content,
    type: r.row.type,
    score: r.score,
  }));
}

export function searchWithEmbedding(queryEmb: Float32Array, topK: number = 5): SearchResult[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM chunks").all() as ChunkRow[];
  if (rows.length === 0) return [];

  const scored = rows.map((row) => {
    const storedEmb = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
    return { row, score: cosineSimilarity(queryEmb, storedEmb) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((r) => ({
    filename: r.row.filename,
    heading: r.row.heading,
    content: r.row.content,
    type: r.row.type,
    score: r.score,
  }));
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function startWatcher(): void {
  if (_watcher) return;
  const dir = personality.PERSONALITY_DIR;
  if (!fs.existsSync(dir)) return;

  _watcher = fs.watch(dir, (eventType, filename) => {
    if (filename && filename.endsWith(".md") && eventType === "change") {
      console.error(`Personality file changed: ${filename}, reindexing...`);
      buildIndex().then((n) => console.error(`Reindexed ${n} chunks after change to ${filename}`));
    }
  });
}

export function stopWatcher(): void {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
}

export function close(): void {
  stopWatcher();
  if (_db) {
    _db.close();
    _db = null;
  }
}
