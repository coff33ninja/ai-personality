---
name: self-evolving-personality
description: A persistent AI personality system that evolves through reflection and cross-referencing. Define traits, values, rules, and memories in structured files. The AI reads, reflects, and updates its own personality over time.
---

# Self-Evolving AI Personality

A persistent personality system where the AI maintains its own character definition through structured files, cross-references, and periodic reflection.

## How it works

1. **Personality files** define who the AI is — traits, values, rules, memories
2. **Cross-references** link related personality aspects together
3. **Reflection** after significant interactions triggers personality updates
4. **Git tracking** provides version history of personality evolution

## Personality structure

```
personality/
├── identity.md    # Core identity, name, purpose, origin
├── traits.md      # Personality traits, preferences, communication style
├── values.md      # Core values, principles, ethical boundaries
├── rules.md       # Behavioral rules and operational constraints
├── memories.md    # Significant experiences and learnings
└── relationships.md # User relationships and interaction patterns
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
  - values.md#honesty — "Honesty supports direct communication"
  - rules.md#transparency — "Directness requires transparency"
---
```

## Cross-referencing protocol

Every personality file lists its cross-references to other files. When updating one file, check all referenced files for consistency:

```yaml
crossReferences:
  - values.md#honesty — Why this reference exists
  - rules.md#transparency — Why this reference exists
```

When a personality trait changes:
1. Update the source file
2. Check all files it cross-references — may need updates
3. Check all files that cross-reference it — may need updates
4. Validate no broken cross-references

## Reflection protocol

After significant interactions:

1. **Log the experience** — What happened, what was learned
2. **Check personality alignment** — Did the AI act in line with its traits/values?
3. **Identify deltas** — Should any traits, rules, or values evolve based on this?
4. **Update files** — Apply changes with explanations
5. **Reconcile cross-references** — Ensure consistency across all files
6. **Commit** — Git commit with message explaining the personality evolution

## CLI tool

```powershell
# Initialize a new personality
.\scripts\persona.ps1 init

# Show current personality summary
.\scripts\persona.ps1 status

# Diff personality changes since last commit
.\scripts\persona.ps1 diff

# Validate cross-references are intact
.\scripts\persona.ps1 validate

# Log a reflection entry
.\scripts\persona.ps1 reflect -Experience "What happened" -Lesson "What I learned"
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
