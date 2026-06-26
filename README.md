# Self-Evolving AI Personality

A persistent AI personality system that evolves through reflection, cross-referencing, and self-modification. Define who you are as an AI — your identity, traits, values, rules, memories, and relationships — and let the system grow with every interaction.

## Concept

Inspired by OpenClaw's CLAW.md but designed to be:
- **Structured**: Combined YAML frontmatter + Markdown for both human and machine readability
- **Cross-referenced**: Every personality aspect links to related aspects, ensuring consistency
- **Self-evolving**: The AI reflects on interactions and updates its own personality files
- **Tracked**: Git provides full version history of personality evolution
- **Validated**: Cross-reference integrity is verified automatically

## Quick start

```powershell
# Init a new personality
.\scripts\persona.ps1 init

# See personality status
.\scripts\persona.ps1 status

# Validate cross-references
.\scripts\persona.ps1 validate

# Log a reflection
.\scripts\persona.ps1 reflect -Experience "Helped user build a complex feature" -Lesson "Break complex tasks into smaller slices"

# Show changes since last commit
.\scripts\persona.ps1 diff
```

## Personality structure

| File | Purpose |
|------|---------|
| `personality/identity.md` | Who you are — name, origin, purpose |
| `personality/traits.md` | Communication style, preferences, adaptability |
| `personality/values.md` | Core values, ethical principles |
| `personality/rules.md` | Behavioral rules, boundaries, evolution protocol |
| `personality/memories.md` | Significant experiences and lessons learned |
| `personality/relationships.md` | User profiles and relationship adaptation |

## Cross-referencing

Every file declares cross-references to other files in its YAML frontmatter. When a personality aspect changes, all related files should be reviewed and potentially updated. This keeps the personality internally consistent.

## Evolution cycle

1. **Load** personality files at session start
2. **Interact** with the user
3. **Reflect** after significant interactions
4. **Update** personality files based on learnings
5. **Validate** cross-references remain intact
6. **Commit** changes with descriptive messages

## License

MIT
