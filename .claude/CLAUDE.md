# [Your Project Name]

**Project:** [Brief description]
**Status:** [Development/Production/Research]
**Primary Goal:** [What are you building?]

---

## Quick Reference

| What | Where | Command |
|------|-------|---------|
| Start | `[entry_point.py]` | `python [entry_point.py]` |
| Test | `[test_directory]` | `pytest` |
| Deploy | `[deployment_script]` | `./deploy.sh` |

---

## Architecture Overview

```
[Your system architecture diagram - text-based is fine]

Example:
Client → API Server → Database
         ↓
    Background Workers
```

**Core Components:**
- **[Component 1]**: [Purpose, location]
- **[Component 2]**: [Purpose, location]
- **[Component 3]**: [Purpose, location]

---

## Context Documentation Structure

This project uses **fractal documentation** - information organized by attention level:

### Systems (`systems/`)
Hardware, deployment, infrastructure - changes slowly
- `systems/production.md` - Production environment
- `systems/development.md` - Dev environment
- Add more as needed

### Modules (`modules/`)
Core code systems - changes frequently
- `modules/api.md` - API layer documentation
- `modules/database.md` - Data layer
- `modules/auth.md` - Authentication
- Add per major module

### Integrations (`integrations/`)
Cross-system communication
- `integrations/external-api.md` - Third-party API
- `integrations/websocket.md` - Real-time communication
- Add per integration point

---

## Getting Started (for Claude)

**When you start a session:**
1. Check `systems/` for deployment context
2. Check `modules/` for code you're working on
3. Use `integrations/` if touching external systems

**The context router will automatically:**
- Keep recently mentioned files HOT (full content)
- Keep related files WARM (headers only)
- Evict unmentioned files as COLD

---

## Development Workflow

**Daily:**
```bash
# [Your typical commands]
git pull
[run tests]
[start dev server]
```

**Deploy:**
```bash
# [Your deploy process]
[build command]
[deploy command]
```

---

## Common Operations

**Run tests:**
```bash
[test command]
```

**Check logs:**
```bash
[log command]
```

**Health check:**
```bash
[health check command]
```

---

## Critical Files

| File | Purpose | Line |
|------|---------|------|
| `[critical_file_1.py]` | [Purpose] | [Key line numbers] |
| `[critical_file_2.py]` | [Purpose] | [Key line numbers] |

---

## Environment Variables

```bash
# Required
export [VAR_NAME]=[value]

# Optional
export [VAR_NAME]=[value]
```

---

## Dependencies on External Services

| Service | Purpose | Failure Impact | Health Check |
|---------|---------|----------------|--------------|
| [Service 1] | [Purpose] | [Impact] | `curl [health_url]` |
| [Service 2] | [Purpose] | [Impact] | `ping [host]` |

---

## Recent Changes

[Keep a running log of major changes for context continuity]

**[Date]:**
- [Change description]
- [Affects: which systems]
- [Why: reasoning]

---

## For New Developers

**This file helps Claude Code:**
1. Understand your project structure
2. Avoid hallucinating non-existent integrations
3. Maintain context across long sessions
4. Coordinate across multiple concurrent instances

**Customize this template:**
1. Replace all `[placeholders]` with your actual info
2. Add sections specific to your project
3. Keep it updated as architecture evolves
4. Use `systems/*.md` for detailed hardware/deployment docs
5. Use `modules/*.md` for detailed code documentation

---

## Multi-Instance Coordination

If you're running multiple Claude Code instances on this project:

1. **Set instance ID:**
   ```bash
   export CLAUDE_INSTANCE=A  # Or B, C, D, etc.
   ```

2. **Signal when completing work:**
   ```pool
   INSTANCE: A
   ACTION: completed
   TOPIC: [Brief description]
   SUMMARY: [What changed]
   AFFECTS: [Files/systems touched]
   BLOCKS: [What this unblocks]
   ```

3. **Other instances will see your updates** at their next session start

---

**Last Updated:** [Date]
**Maintained By:** [Your name/team]
