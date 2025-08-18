# .claude Agent Mesh

This repository contains a structured set of agents, orchestrators, and shared infrastructure for running Claude Code with MCP, Ollama, and Dify.

## Structure

```
.claude/
  agents/
    core/            # Core skills (reviewer, doc specialist, optimizer)
    orchestrators/   # Domain program leads (project analyst, team configurator, tech lead)
    specialized/     # Deep stack experts (rails, django, laravel, react, vue, terraform, etc.)
    universal/       # Flexible generalists (frontend, backend, api architect)
    conductor.md     # Top-level planner & arbiter
    critic.md        # Safety/verifier agent
    sweeper.md       # Context hygiene & retrospectives
    README.token-economy.md
  memory/
    kv.sqlite        # Key-value store for small truths
    timeline.ndjson  # Append-only JSONL audit log
    vector.faiss     # Embeddings index for docs/logs
    README.md        # Memory conventions & schema
  scripts/
    setup.sh           # Initialize memory and configure environment
    utils.sh           # KV and timeline utilities
  policies/
    guardrails.md    # Sensitive paths, cost caps, approval rules
  playbooks/         # Runbooks, retrospectives, task guides
```

## Key Roles

- **Conductor** → owns goals, lanes, cross-domain sequencing, and memory. Delegates to orchestrators/specialists and enforces guardrails.
- **Critic** → audits plans/diffs before execution. Blocks unsafe, costly, or untested changes.
- **Sweeper** → records retrospectives, appends to timeline, updates runbooks, compacts memory.
- **Orchestrators** → domain champions:
  - *Tech Lead* → architecture & integration plans
  - *Project Analyst* → milestones, KPIs, risks
  - *Team Configurator* → repos, CI, RBAC, envs

## Memory Conventions

- **KV**: Store small truths (account IDs, budget caps, endpoints).
- **Timeline**: Append-only JSON lines, compact, with `ts, agent, action, summary`.
- **Vector**: Embed long docs; chunk ~1k tokens.

## Token Economy

- Keep outputs artifact-only. Use compact YAML/JSON/MD.
- Reference existing docs instead of re-stating them.
- Favor links/paths to artifacts over inline blobs.

See [agents/README.token-economy.md](agents/README.token-economy.md).

## Workflow

1. **Conductor** ingests goal → drafts global plan → delegates subtasks.
2. **Orchestrators** produce domain artifacts, propose lanes.
3. **Conductor** assembles dossier → sends to Critic.
4. **Critic** audits → verdict.json.
5. **Conductor** promotes approved tasks → executes.
6. **Sweeper** produces retrospective, updates memory & runbooks.

## Configuration

### Environment Setup

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
# Edit .env with your specific configuration
```

Key environment variables:
- `AWS_PROFILE` - Your AWS profile name
- `AWS_REGION` - AWS region (default: us-west-2)
- `MCP_SERVER_URL` - MCP server endpoint
- `AGENT_MESH_*` - Agent mesh resource names

See `.env.example` for all available configuration options.

### Quick Setup

```bash
# Initialize memory structures
./scripts/setup.sh init

# Configure with your environment variables
./scripts/setup.sh config

# Use utilities for local operations
./scripts/utils.sh kv-set user.name '"Alice"'
./scripts/utils.sh timeline-add '{"ts":"'$(date -u +%FT%TZ)'","event":"setup"}'
```

## Updating This README

Whenever new agents, scripts, or policies are added, extend the structure map and key roles here to keep it authoritative.

## Changelog
- See `CHANGELOG.md`. Sweeper can append entries when agent specs change.
