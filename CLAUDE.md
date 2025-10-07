# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: Test Debt Tracking

**NEVER IGNORE SKIPPED TESTS** - They represent production bugs waiting to happen.

Current test debt status:

- **11 skipped tests** in dashboard-ui (see `dashboard-ui/TODO_TESTS.md`)
- **1 timer logic bug** - could cause data loss in production
- **10 component integration gaps** - no coverage for critical UI flows

Before claiming "production ready": ALL tests must pass without `.skip()`.

See detailed tracking in:

- `dashboard-ui/TECHNICAL_DEBT.md` - Strategic overview
- `dashboard-ui/TODO_TESTS.md` - Specific failing tests and solutions

## Core Commands

### MCP Server Setup

```bash
# Configure Claude Code to use the Rust MCP server
# This enables Claude Code to directly use MCP tools while developing!
# Add to Claude Code settings or mcp_servers.json:
{
  "agent-mesh": {
    "command": "use_aws_mcp",
    "env": {
      "AWS_REGION": "us-west-2"
    }
  }
}

# Claude Code can then use tools like:
# - mcp__aws__kv_get/set for KV storage
# - mcp__aws__artifacts_get/put for file storage
# - mcp__aws__events_send for EventBridge
# - mcp__aws__workflow_start for Step Functions
# - mcp__aws__agent_* for agent operations
```

### Development

```bash
# MCP Server development (Rust implementation)
cd mcp-rust
cargo build                 # Build Rust MCP server
cargo test                  # Run full test suite
cargo run                   # Start MCP server on stdio (default for MCP clients)
cargo install --path .     # Install use_aws_mcp binary globally

# Dashboard UI development (SolidJS)
cd dashboard-ui
npm install
npm run dev              # Start Vite dev server on port 5173+
npm run build            # Build for production
npm run preview          # Preview production build

# Environment Configuration
cp .env.example .env     # Create local environment file
# Edit .env to set VITE_MCP_SERVER_URL for custom MCP server location

# Run both together (from root)
npm run dev:all          # Starts both MCP server and dashboard UI

# Google Analytics reports
npm run setup:ga-google-cloud    # Complete Google Cloud + GA setup assistant
npm run setup:ga-credentials     # Interactive GA credentials setup
npm run report:users-by-country  # Live GA report (requires credentials)
npm run report:users-by-country-sample  # Sample data report

# Infrastructure (Terraform)
# Set AWS profile (recommended - avoids hardcoding in Terraform files)
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

npm run tf:fmt            # Format Terraform files
npm run tf:init           # Initialize workspace (set WS and ENV vars)
npm run tf:plan           # Plan infrastructure changes
npm run tf:apply          # Apply infrastructure changes
npm run tf:destroy        # Destroy infrastructure

# Alternative: Use backend config file (profile centralized)
cd infra/workspaces/small/kv_store
terraform init -backend-config=backend.hcl

# Event Monitoring Infrastructure (PowerShell on Windows)
cd infra/workspaces/small/events_monitoring
powershell -ExecutionPolicy Bypass -File deploy.ps1   # Plan changes
powershell -ExecutionPolicy Bypass -File apply.ps1    # Apply changes
```

### Environment Variables

#### Infrastructure & AWS

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

#### Dashboard UI Configuration (dashboard-ui/.env)

```bash
# MCP Server Configuration
VITE_MCP_SERVER_URL=http://localhost:3001    # MCP server URL for proxy
VITE_MCP_SERVER_PORT=3001                    # MCP server port
VITE_DEV_MODE=true                           # Enable development features

# Optional overrides
VITE_APP_TITLE="Custom Dashboard Title"
VITE_API_ENDPOINT=http://localhost:3001/api
```

## Architecture Overview

### Core Components

- **MCP Server** (`mcp-rust/`): Rust-based Model Context Protocol server providing AI assistants with AWS service access
- **Dashboard Server** (`dashboard-server/`): WebSocket API gateway for the SolidJS dashboard UI
- **Dashboard UI** (`dashboard-ui/`): SolidJS-based frontend for workflow management and real-time monitoring
- **Infrastructure** (`infra/`): Terraform modules organized into small/medium/large workspaces
- **Agent System** (`.claude/`): Sophisticated agent orchestration with conductors, critics, and specialists

### MCP Server Structure (Rust)

- `src/`: Rust implementation of MCP server with AWS integrations
- Features: KV storage, artifacts, events, workflows, analytics
- Performance-optimized with async/await and tokio runtime
- Type-safe AWS SDK integration

### Event Monitoring System

- **6 MCP Tools**: send, query, analytics, create-rule, create-alert, health-check
- **Real-time Processing**: Enhanced event ingestion with metadata and timestamps
- **Historical Storage**: All events stored in DynamoDB with queryable indexes
- **User Isolation**: Multi-tenant support with user-specific access controls
- **SNS Integration**: Built on existing notification system for persistent messaging

### Infrastructure Workspaces

- **Small**: Basic AWS components (DynamoDB, S3, EventBridge, Secrets Manager)
  - `small/kv_store`: Key-value storage with DynamoDB
  - `small/events_monitoring`: Event monitoring system with 3 DynamoDB tables (events, subscriptions, event_rules)
- **Medium**: Composed services (ECS agents, Step Functions, CloudWatch)  
- **Large**: High-performance components (Aurora pgvector, analytics)

## Google Analytics Integration

### Quick Setup Process

**Complete Automated Setup (One Command!)**

1. **Configure AWS credentials**: `aws sso login --profile your-profile`
2. **Run the setup assistant**: `npm run setup:ga-google-cloud`
   - Guides through Google Cloud Console setup
   - Processes OAuth2 credentials automatically
   - Tests Google Analytics API connection
   - Saves credentials to AWS Secrets Manager
3. **Test with live data**: `npm run report:users-by-country`

**Manual Setup (Alternative)**

1. Run `npm run setup:ga-credentials` if you already have OAuth2 credentials
2. Follow prompts to enter credentials and complete OAuth flow

### Required Credentials Format

AWS Secrets Manager secret: `agent-mesh-mcp/google-analytics`

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

### Technology Preferences

- **TypeScript**: Preferred for all frontend and backend JavaScript/Node.js code
- **Terraform**: Preferred for all infrastructure as code
- **Modern ES6+**: Use latest JavaScript features with proper typing
- **SolidJS**: TypeScript-based reactive frontend framework
- **Vite**: TypeScript configuration with proper typing

### Testing Strategy

- 100% test pass rate requirement
- Comprehensive AWS and Google API mocking
- Unit tests: `test/unit/`
- Integration tests: `test/integration/`  
- OAuth2 validation: `test/ga-oauth2-simple.test.mjs`

### Code Architecture

- **TypeScript Modules**: Modern ES6+ with proper typing
- **Event-Driven**: All major operations publish EventBridge events
- **Stateless Services**: Minimal state, external storage via DynamoDB/S3
- **Clean Error Handling**: Graceful degradation with proper logging
- **Mock-Friendly**: Designed for reliable CI/CD testing

### Infrastructure Management

- Use Terraform workspaces in `infra/workspaces/`
- **Workspace Tiers**:
  - `extra-small`: $10/month target, minimal services, no hardcoded profiles ✅
  - `small`: Core services, needs profile centralization (run `centralize-all-profiles.sh`) ⚠️
  - `medium`: ECS agents, Step Functions, no hardcoded profiles ✅
  - `large`: Aurora pgvector, analytics, no hardcoded profiles ✅
- Environment-driven configuration pattern
- **AWS Profile**: Use `export AWS_PROFILE=baursoftware` to avoid hardcoding (see `infra/workspaces/PROFILE_CENTRALIZATION_ALL.md`)

## Agent System

### Specialized Agents (`.claude/agents/`)

- **Mentor**: Finds latest documentation and teaches agents new methods
- **Conductor**: Goal-driven planner and delegator
- **Critic**: Safety and verification agent  
- **Framework Experts**: Django, Laravel, Rails, React, Vue, Terraform
- **AWS Specialists**: S3, DynamoDB, Lambda, EKS, IAM, etc.
- **Integration Experts**: Stripe, Slack, GitHub, Vercel

### Integration System (Multiple Connections Support)

#### Connection Architecture

- **App Configurations**: Stored as `integration-<service>` keys containing OAuth2 metadata, UI fields, and workflow capabilities
- **User Connections**: Stored as `user-{userId}-integration-{service}-{connectionId}` keys containing encrypted credentials and settings
- **Connection Naming**: Users can create multiple named connections per service (e.g., "Work Account", "Personal", "Backup")

#### KV Store Patterns

```bash
# App configuration (shared template)
integration-google-analytics  # OAuth2 config, UI fields, workflow capabilities

# User connections (individual, encrypted credentials)
user-demo-user-123-integration-google-analytics-default     # Default connection
user-demo-user-123-integration-google-analytics-work        # Work account
user-demo-user-123-integration-google-analytics-personal    # Personal account
```

#### Workflow Integration

- **Node Filtering**: Workflow nodes become available when ANY connection exists for required service
- **Legacy Support**: Automatic migration from old `user-{userId}-integration-{service}` pattern
- **Dynamic Detection**: WorkflowBuilder checks both legacy and new connection patterns

#### Dashboard UI Components

- **IntegrationsSettings**: Supports multiple connections per service with expandable cards
- **Connection Management**: Individual test/disconnect actions per connection
- **User Experience**: Clickable cards, connection naming, "Add Another Connection" workflow

### Memory System

- KV store for agent state and user connections
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
- **AWS Profile Configuration**: Set `export AWS_PROFILE=baursoftware` or use `backend.hcl` files (see `infra/workspaces/small/README.md`)
- Profile configuration centralized to avoid duplication across modules

### Integration Multiple Connections

- **Migration Issues**: Legacy connections automatically migrate to new format with `default` connectionId
- **Connection Naming**: Empty connection names default to "{ServiceName} (connectionId)" format
- **Workflow Availability**: Nodes become available when ANY connection exists for the required service
- **Connection Management**: Each connection has individual test/disconnect controls in dashboard UI

## File Locations

- MCP Server: `mcp-server/src/server.js`
- HTTP Interface: `mcp-server/src/http-server.js`  
- Test Suites: `mcp-server/test/`
- Infrastructure: `infra/workspaces/`
- Agent Definitions: `.claude/agents/`
- Configuration: `mcp-config.json`, `.claude/mesh-agent-config.json`
- CLAUDE.md
- .claude/**/*
- Fetch(https://github.com/idosal/mcp-ui)
- yes we need to have composable patterns that make this code base maintainable
- isolates the MCP server as a stdio-only backend service, with dashboard-server as the sole API gateway for the UI
- isolates the MCP server as a stdio-only backend service, with dashboard-server as the sole websocket based API gateway for the UI
- dashboard server doesn't fn do crud api's.
- always use events and pubsub never use rest
