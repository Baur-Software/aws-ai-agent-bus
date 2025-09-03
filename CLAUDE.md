# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

### MCP Server Setup
```bash
# Configure Claude Code to use this MCP server
# Add to Claude Code settings or mcp_servers.json:
{
  "agent-mesh": {
    "command": "node",
    "args": ["src/server.js"],
    "cwd": "mcp-server",
    "env": {
      "AWS_REGION": "us-west-2"
    }
  }
}
```

### Development
```bash
# MCP Server development
cd mcp-server
npm install
npm test                    # Run full test suite (100% pass rate)
npm run test:unit          # Unit tests only  
npm run test:integration   # Integration tests only
npm start                  # Start MCP server on stdio (default for MCP clients)
npm run dev               # Development mode with hot reload
npm run start:http        # HTTP interface on port 3000
npm run dev:http          # HTTP dev mode with hot reload
npm run lint              # JavaScript syntax validation

# Google Analytics reports
npm run setup:ga-credentials     # Interactive GA credentials setup
npm run report:users-by-country  # Live GA report (requires credentials)
npm run report:users-by-country-sample  # Sample data report

# Infrastructure (Terraform)
npm run tf:fmt            # Format Terraform files
npm run tf:init           # Initialize workspace (set WS and ENV vars)
npm run tf:plan           # Plan infrastructure changes
npm run tf:apply          # Apply infrastructure changes
npm run tf:destroy        # Destroy infrastructure
```

### Environment Variables
```bash
# Required for infrastructure operations
export WS=small/kv_store    # Workspace path
export ENV=dev              # Environment (dev/staging/prod)

# AWS Configuration  
export AWS_REGION=us-west-2
export AGENT_MESH_KV_TABLE=agent-mesh-kv
export AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts
export AGENT_MESH_EVENT_BUS=agent-mesh-events
```

## Architecture Overview

### Core Components
- **MCP Server** (`mcp-server/src/`): Model Context Protocol server providing AI assistants with AWS service access
- **Infrastructure** (`infra/`): Terraform modules organized into small/medium/large workspaces
- **Agent System** (`.claude/`): Sophisticated agent orchestration with conductors, critics, and specialists

### MCP Server Structure
- `src/modules/aws/`: AWS service clients (DynamoDB, S3, EventBridge, Step Functions)
- `src/modules/mcp/handlers/`: MCP tool handlers (kv, artifacts, events, workflow, google-analytics)
- `src/services/`: Google Analytics API client with OAuth2 support
- `src/reports/`: Pre-built analytics reports with sample data versions
- `src/scripts/`: Interactive setup utilities

### Infrastructure Workspaces
- **Small**: Basic AWS components (DynamoDB, S3, EventBridge, Secrets Manager)
- **Medium**: Composed services (ECS agents, Step Functions, CloudWatch)  
- **Large**: High-performance components (Aurora pgvector, analytics)

## Google Analytics Integration

### Quick Setup Process
1. Run `npm run setup:ga-credentials` and choose option 1 (Create new credentials)
2. Follow prompts to enter Google OAuth2 credentials and Property ID
3. Complete OAuth flow in browser
4. Credentials automatically stored in AWS Secrets Manager

### Required Credentials Format
AWS Secrets Manager secret: `spalding-content-pipeline/google-analytics`
```json
{
  "client_id": "...",
  "client_secret": "...", 
  "access_token": "...",
  "refresh_token": "...",
  "property_id": "..."
}
```

## Development Patterns

### Testing Strategy
- 100% test pass rate requirement
- Comprehensive AWS and Google API mocking
- Unit tests: `test/unit/`
- Integration tests: `test/integration/`  
- OAuth2 validation: `test/ga-oauth2-simple.test.mjs`

### Code Architecture
- **ES6 Modules**: Modern JavaScript with import/export
- **Event-Driven**: All major operations publish EventBridge events
- **Stateless Services**: Minimal state, external storage via DynamoDB/S3
- **Clean Error Handling**: Graceful degradation with proper logging
- **Mock-Friendly**: Designed for reliable CI/CD testing

### Infrastructure Management
- Use Terraform workspaces in `infra/workspaces/`
- Start with small workspaces for cost-effectiveness (~$10/month)
- Scale to medium/large workspaces as needed
- Environment-driven configuration pattern

## Agent System

### Specialized Agents (`.claude/agents/`)
- **Conductor**: Goal-driven planner and delegator
- **Critic**: Safety and verification agent  
- **Framework Experts**: Django, Laravel, Rails, React, Vue, Terraform
- **AWS Specialists**: S3, DynamoDB, Lambda, EKS, IAM, etc.
- **Integration Experts**: Stripe, Slack, GitHub, Vercel

### Memory System
- KV store for agent state
- Timeline for event tracking  
- Vector embeddings for contextual memory

## Common Troubleshooting

### MCP Server Issues
- `npm test` must pass 100% before deployment
- Check AWS credentials with `aws configure`
- Verify environment variables are set correctly

### Google Analytics Setup
- `Could not load credentials`: Run `npm run setup:ga-credentials`
- `Failed to initialize Google Analytics`: Use option 3 in setup script to test
- Detailed guide: `mcp-server/docs/google-analytics-setup.md`

### Infrastructure Deployment
- Always run `npm run tf:fmt` before commits
- Set WS and ENV variables before Terraform operations
- Use small workspaces for development, scale as needed

## File Locations

- MCP Server: `mcp-server/src/server.js`
- HTTP Interface: `mcp-server/src/http-server.js`  
- Test Suites: `mcp-server/test/`
- Infrastructure: `infra/workspaces/`
- Agent Definitions: `.claude/agents/`
- Configuration: `mcp-config.json`, `.claude/mesh-agent-config.json`
- CLAUDE.md
- .claude/**/*