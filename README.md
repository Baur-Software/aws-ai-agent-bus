# AWS AI Agent Bus

A comprehensive agent mesh infrastructure with Model Context Protocol (MCP) server integration, enabling AI assistants to interact with AWS services through standardized interfaces.

## Overview

This project provides a complete solution for running AI agent meshes on AWS infrastructure:

- **MCP Server**: Production-ready Model Context Protocol server for AI assistant integration
- **Claude Agent System**: Sophisticated agent orchestration with conductors, critics, and specialists
- **Terraform Infrastructure**: Modular AWS infrastructure with small/medium/large workspace patterns
- **Cost-Effective**: Run a complete agent mesh for as low as $10/month

## Architecture

### Infrastructure Workspaces

- **Small workspaces**: Fine-grained, cost-effective components (DynamoDB, S3, EventBridge)
- **Medium workspaces**: Domain stacks composing small workspaces (ECS agents, Step Functions)  
- **Large workspaces**: Optional, high-performance components (Aurora pgvector, analytics)

### MCP Server Integration

The MCP server (`mcp-server/`) provides AI assistants with:
- Key-value storage via DynamoDB
- Artifact management through S3
- Event bus integration with EventBridge
- Timeline and workflow support
- Dual stdio/HTTP interfaces

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

# Configure environment
cp .env.example .env
# Edit .env with your AWS resource names

# Start server
npm start              # stdio interface
npm run start:http     # HTTP interface on port 3000
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

- [`mcp-server/`](mcp-server/README.md) - MCP server documentation
- [`.claude/`](.claude/README.md) - Agent orchestration system
- [`infra/`](infra/) - Terraform infrastructure modules

## Contributing

See [CONTRIBUTING.md](mcp-server/CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](mcp-server/LICENSE) for details.