---
name: self-evolving-personality
description: A persistent AI personality system that evolves through reflection and cross-referencing. Exposes personality data via MCP server (resources, tools, prompts) and keeps personhood consistent across sessions.
---

# Self-Evolving AI Personality

A persistent personality system where the AI maintains its own character definition through structured files, cross-references, and periodic reflection. Served via **MCP** so any client can read/write the AI's personality.

## How it works

1. **MCP server** (`server/src/index.ts`) exposes personality data as resources, tools, and prompts
2. **Personality files** (`personality/*.md`) define who the AI is — traits, values, rules, memories
3. **Cross-references** link related personality aspects, validated bi-directionally
4. **Reflection tool** (`reflect`) logs experiences and lessons to memories.md
5. **Git tracking** provides version history of personality evolution

## Personality structure

```
personality/
├── identity.md       # Core identity, name, purpose, origin
├── traits.md         # Personality traits, preferences, communication style
├── values.md         # Core values, principles, ethical boundaries
├── rules.md          # Behavioral rules and operational constraints
├── memories.md       # Significant experiences and learnings
└── relationships.md  # User relationships and interaction patterns
```

## File format

Each file uses combined Markdown + YAML frontmatter:

```yaml
---
type: trait
version: 1
lastUpdated: 2026-06-26
evolution: 3
crossReferences:
  - values.md#honesty -- "Honesty supports direct communication"
  - rules.md#clarity -- "Directness requires clarity"
---
```

## Cross-referencing protocol

Every personality file lists its cross-references to other files. When updating one file, check all referenced files for consistency:

```yaml
crossReferences:
  - values.md#honesty -- Why this reference exists
  - rules.md#clarity -- Why this reference exists
```

When a personality trait changes:
1. Update the source file
2. Check all files it cross-references — may need updates
3. Check all files that cross-reference it — may need updates
4. Validate no broken cross-references (use `validate` tool)

## MCP server

### Resources

| URI | Content |
|-----|---------|
| `personality://identity` | Name, origin, core statement |
| `personality://traits` | Communication style, preferences |
| `personality://values` | Honesty, growth, effectiveness |
| `personality://rules` | Boundaries, clarity, evolution |
| `personality://memories` | Experience/lesson log |
| `personality://relationships` | User profiles, adaptation |
| `personality://summary` | Overview of all files |
| `personality://all` | All files as JSON |
| `personality://file/{name}` | Any file by name (template) |

### Tools

| Tool | Description |
|------|-------------|
| `reflect` | Log a memory (`experience`, `lesson`, `affectedFiles[]`) |
| `validate` | Check all cross-references |
| `status` | Show evolution state |
| `evolve` | List pending evolutions |

### Prompts

| Prompt | Description |
|--------|-------------|
| `personality` | Full personality context for system prompt injection |
| `reflect` | Guide for reflecting on an interaction |

## Reflection protocol

After significant interactions:

1. **Call `reflect` tool** — log the experience and lesson (impact set to `under review`)
2. **Check personality alignment** — Did the AI act in line with its traits/values?
3. **Identify deltas** — Should any traits, rules, or values evolve?
4. **Update files** — Edit personality files directly
5. **Run `validate`** — Ensure cross-references remain consistent
6. **Commit** — Git commit with message explaining the evolution

## Running the server

```bash
cd server
npm install
npm run build
npm start            # stdio-based MCP server
```

## Detection triggers

Activate when:
- Starting a new interaction with a user
- After completing a significant task
- When behavior feels inconsistent with declared personality
- User challenges or gives feedback about behavior
- Loading personality files for the first time

## Cross-references

- **ai-personality** — This is the meta-skill for the personality system itself
