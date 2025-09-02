# AWS AI Agent Bus

A comprehensive agent mesh infrastructure with Model Context Protocol (MCP) server integration, enabling AI assistants to interact with AWS services through standardized interfaces. See [EXAMPLES.md](EXAMPLES.md) for use cases and integration patterns.

## Overview

This project provides a complete solution for running AI agent meshes on AWS infrastructure:

- **MCP Server**: Production-ready Model Context Protocol server with Google Analytics integration
- **Claude Agent System**: Sophisticated agent orchestration with conductors, critics, and specialists  
- **Terraform Infrastructure**: Modular AWS infrastructure with small/medium/large workspace patterns
- **100% Test Coverage**: Comprehensive test suite ensuring reliability
- **OAuth2 Support**: Complete Google Analytics authentication flow
- **Cost-Effective**: Run a complete agent mesh for as low as $10/month

## Architecture

### Infrastructure Workspaces

- **Small workspaces**: Fine-grained, cost-effective components (DynamoDB, S3, EventBridge)
- **Medium workspaces**: Domain stacks composing small workspaces (ECS agents, Step Functions)  
- **Large workspaces**: Optional, high-performance components (Aurora pgvector, analytics)

### MCP Server Integration

The MCP server (`mcp-server/`) provides AI assistants with:

- **Google Analytics Integration**: Complete OAuth2 flow, top pages analysis, content opportunities
- **Key-value storage** via DynamoDB
- **Artifact management** through S3
- **Event bus integration** with EventBridge
- **Timeline and workflow support** via Step Functions
- **Dual stdio/HTTP interfaces** for flexible deployment

### Agent Orchestration

The `.claude/` directory contains a sophisticated agent system:

- **Conductor**: Goal-driven planner and delegator
- **Critic**: Safety and verification agent
- **Specialists**: Framework and domain experts
- **Memory System**: KV store, timeline, and vector embeddings

## Quick Start

### 1. Deploy Infrastructure

```bash
# Deploy core components
make init WS=small/kv_store ENV=dev
make apply WS=small/kv_store ENV=dev
make apply WS=small/artifacts_bucket ENV=dev
make apply WS=small/event_bus ENV=dev

# Deploy workflow orchestration
make apply WS=medium/workflow ENV=dev
```

### 2. Setup MCP Server

```bash
cd mcp-server
npm install

# Run full test suite (100% pass rate)
npm test

# Configure environment
cp .env.example .env
# Edit .env with your AWS resource names

# Start server
npm start              # stdio interface  
npm run start:http     # HTTP interface on port 3000
npm run dev           # development mode with hot reload
```

### 3. Configure Claude Agents

```bash
cd .claude
cp .env.example .env
# Edit .env with your configuration

# Initialize agent system
./scripts/setup.sh init
./scripts/setup.sh config
```

### 4. Analytics Reports

Generate Google Analytics reports with comprehensive user insights:

```bash
# Interactive setup for Google Analytics credentials
npm run setup:ga-credentials

# Sample report (no credentials needed)
npm run report:users-by-country-sample

# Live data report (requires AWS credentials + GA secret)
npm run report:users-by-country
```

**Quick Setup Process:**
1. Run `npm run setup:ga-credentials` and choose option 1 (Create new credentials)
2. Follow prompts to enter Google OAuth2 credentials and Property ID  
3. Complete OAuth flow in browser
4. Credentials automatically stored in AWS Secrets Manager

**Manual Setup (Alternative):**
- AWS credentials configured with Secrets Manager access
- Google Analytics secret in AWS Secrets Manager: `spalding-content-pipeline/google-analytics`
- Secret format: `{"client_id": "...", "client_secret": "...", "access_token": "...", "refresh_token": "...", "property_id": "..."}`

**Troubleshooting:**
- `Could not load credentials from any providers`: Configure AWS credentials with `aws configure`
- `Failed to initialize Google Analytics`: Run `npm run setup:ga-credentials` and choose option 3 to test
- Detailed setup guide: `mcp-server/docs/google-analytics-setup.md`

## Infrastructure Components

### Small Workspaces

- `kv_store`: DynamoDB table for key-value storage
- `artifacts_bucket`: S3 bucket for file artifacts
- `timeline_store`: S3 bucket for timeline events
- `event_bus`: EventBridge custom bus for events
- `secrets`: AWS Secrets Manager integration

### Medium Workspaces

- `mesh_agents`: ECS-based agent orchestration
- `workflow`: Step Functions state machines
- `observability`: CloudWatch metrics and monitoring

### Large Workspaces (Optional)

- `vector_pg`: Aurora PostgreSQL with pgvector for embeddings
- Analytics and edge distribution components

## Configuration

All components use environment-driven configuration:

```bash
# AWS Configuration
AWS_PROFILE=your-aws-profile
AWS_REGION=us-west-2

# Agent Mesh Resources
AGENT_MESH_KV_TABLE=agent-mesh-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts
AGENT_MESH_EVENT_BUS=agent-mesh-events
```

## Development Lanes

- `read_only`: Safe queries and exploration (default)
- `dry_run`: Planning and staging changes
- `execute`: Production operations with approval gates

## Cost Optimization

Start with small workspaces for development:

- DynamoDB on-demand: ~$1-5/month
- S3 storage: ~$1-3/month  
- EventBridge: ~$1-2/month
- Total: ~$10/month for basic agent mesh

Scale to medium/large workspaces as needed.

## Documentation

- [`CODEBASE_STRUCTURE.md`](CODEBASE_STRUCTURE.md) - Complete codebase overview and architecture
- [`mcp-server/`](mcp-server/README.md) - MCP server documentation
- [`.claude/`](.claude/README.md) - Agent orchestration system
- [`infra/`](infra/) - Terraform infrastructure modules

## Contributing

See [CONTRIBUTING.md](mcp-server/CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](mcp-server/LICENSE) for details.
