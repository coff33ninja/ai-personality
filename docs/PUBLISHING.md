# Publishing

This project publishes two MCP server packages and can be deployed via Smithery.

| Channel | Package | Command to use |
|---------|---------|----------------|
| npm | `ai-personality-server` | `npx -y ai-personality-server` |
| PyPI | `ai-personality-server` | `uvx ai-personality-server` |
| Smithery | `@coff33ninja/ai-personality` | Auto-deployed from GitHub |

---

## npm publish (TypeScript server)

```powershell
cd server

# 1. Login (one-time)
npm login

# 2. Build fresh
npm run build

# 3. Publish
npm publish
```

**What ships**: the `files` array in `package.json` includes `build/` (compiled JS), `src/` (TypeScript), `README.md`, and `package.json`. No install or build step needed on the consumer side — `npx -y ai-personality-server` runs immediately.

**Pre-publish checklist:**
- [ ] `git status` is clean (or intentional)
- [ ] `npm run build` succeeds with no errors
- [ ] Version bumped (follow semver) — update `version` in `server/package.json`
- [ ] `CHANGELOG.md` updated

### Version bump

```powershell
# Patch (bug fixes)
npm version patch

# Minor (new features, backwards compatible)
npm version minor

# Major (breaking changes)
npm version major
```

This updates `package.json` and creates a git tag. Push the tag separately:

```powershell
git push --tags
```

---

## PyPI publish via uv (Python server)

```powershell
cd server-py

# 1. Login (one-time)
uv login

# 2. Build
uv build

# 3. Publish
uv publish
```

`uv build` produces a source distribution (`.tar.gz`) and a wheel (`.whl`) in `server-py/dist/`. `uv publish` uploads both to PyPI.

**Pre-publish checklist:**
- [ ] `version` in `server-py/pyproject.toml` matches the intended release
- [ ] `CHANGELOG.md` updated
- [ ] `uv build` succeeds
- [ ] `uvx ai-personality-server` works from a fresh `uv tool install`

### Version bump

Update `version = "..."` in `server-py/pyproject.toml` manually (uv has no `version` command equivalent yet).

---

## Smithery

[Smithery](https://smithery.ai) is an MCP server registry. It deploys your server from GitHub so users can install it with one click.

### Setup

The `smithery.yaml` at the project root defines the deployment. It uses your GitHub repo as the source and runs `npx -y` on the consumer side.

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      aiPersonalityDir:
        type: string
        default: ""
        description: "Override personality directory path"
    required: []
  commandFunction:
    |-
    (config) => ({
      command: 'npx',
      args: ['-y', 'ai-personality-server']
    })
```

### Deploy

1. Push to GitHub (Smithery auto-detects the `smithery.yaml` in the repo root)
2. Go to https://smithery.ai/server/coff33ninja/ai-personality
3. Click "Connect" or "Deploy"

Or trigger a manual deployment from the Smithery dashboard.

### User install

Users install via:

```bash
npx @smithery/cli install @coff33ninja/ai-personality --client claude
```

Or one-click from the Smithery marketplace page.

---

## Post-push checklist (all channels)

- [ ] Server starts: `npx -y ai-personality-server` (or `uvx`)
- [ ] Resources load: `personality://summary`, `skills://catalog`
- [ ] Tools respond: `status`, `validate`
- [ ] RAG search works: `search_personality`
- [ ] `setup_client` generates valid output
