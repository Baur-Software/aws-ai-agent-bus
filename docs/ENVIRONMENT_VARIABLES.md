# Environment Variables Reference

This document consolidates all environment variables used across the AWS AI Agent Bus platform.

## Quick Start

Copy the example files to get started:

```bash
# Root configuration
cp .env.example .env

# Dashboard Server
cp dashboard-server/.env.example dashboard-server/.env

# Dashboard UI
cp dashboard-ui/.env.example dashboard-ui/.env
```

---

## AWS Configuration

Used by all components that interact with AWS services.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_PROFILE` | No | - | AWS CLI profile name (recommended for local development) |
| `AWS_REGION` | Yes | `us-west-2` | AWS region for all services |
| `AWS_ACCESS_KEY_ID` | Prod | - | AWS access key (use AWS_PROFILE for local dev) |
| `AWS_SECRET_ACCESS_KEY` | Prod | - | AWS secret key (use AWS_PROFILE for local dev) |
| `AWS_ENDPOINT_URL` | No | - | LocalStack endpoint for local development |

### LocalStack Configuration

For local development with Docker:

```bash
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
```

---

## Agent Mesh Core

Resource names for DynamoDB tables, S3 buckets, and EventBridge.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_MESH_ENV` | No | `prod` | Environment name (dev/staging/prod) |
| `AGENT_MESH_KV_TABLE` | Yes | `agent-mesh-kv` | DynamoDB table for key-value storage |
| `AGENT_MESH_ARTIFACTS_BUCKET` | Yes | `agent-mesh-artifacts` | S3 bucket for workflow artifacts |
| `AGENT_MESH_TIMELINE_BUCKET` | Yes | `agent-mesh-timeline` | S3 bucket for event timeline |
| `AGENT_MESH_EVENT_BUS` | Yes | `agent-mesh-events` | EventBridge event bus name |

### Agent Storage (Optional)

Used for agent versioning and storage:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_MESH_AGENTS_TABLE` | No | `agent-mesh-agents` | DynamoDB table for agent definitions |
| `AGENT_MESH_AGENT_VERSIONS_TABLE` | No | `agent-mesh-agent-versions` | DynamoDB table for agent versions |
| `AGENT_MESH_AGENTS_BUCKET` | No | `agent-mesh-agents` | S3 bucket for agent code/config |

---

## Dashboard Server

Configuration for the dashboard-server (Bun/TypeScript).

### Server Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Environment mode (development/production/test) |
| `DASHBOARD_PORT` | No | `3001` | HTTP/WebSocket server port |
| `PORT` | No | `3000` | Legacy HTTP server port |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_DEV_AUTH` | No | `false` | Enable hardcoded demo user for development |
| `JWT_SECRET` | Prod | - | Secret for JWT token signing (required in production) |
| `COGNITO_USER_POOL_ID` | No | - | AWS Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | No | - | AWS Cognito Client ID |

### MCP Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_SERVER_BINARY` | No | `/app/bin/mcp-server` | Path to embedded MCP server binary |

### Bedrock AI Chat

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BEDROCK_MODEL_ID` | No | `anthropic.claude-3-7-sonnet-20250219-v1:0` | Default Bedrock model |
| `BEDROCK_REGION` | No | `AWS_REGION` | AWS region for Bedrock API |

---

## Dashboard UI

Configuration for the dashboard-ui (SolidJS/Vite).

All UI environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_MCP_SERVER_URL` | Yes | `http://localhost:3001` | Dashboard server HTTP URL |
| `VITE_DASHBOARD_SERVER_URL` | Yes | `ws://localhost:3001` | Dashboard server WebSocket URL |
| `VITE_MCP_SERVER_PORT` | No | `3001` | Dashboard server port (reference) |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_ENABLE_DEV_AUTH` | No | `false` | Enable hardcoded demo user |
| `VITE_DEV_MODE` | No | `false` | Enable development features |

### Application Branding

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_APP_TITLE` | No | `AI Agent Bus` | Application title |
| `VITE_APP_DESCRIPTION` | No | - | Application description |

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SHOW_DEBUG_INFO` | No | `false` | Show debug information in UI |
| `VITE_ENABLE_AGENT_EDITOR` | No | `true` | Enable agent editor feature |
| `VITE_ENABLE_WORKFLOW_MARKETPLACE` | No | `true` | Enable workflow marketplace |

### API Overrides (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_ENDPOINT` | No | - | Override API endpoint URL |
| `VITE_HEALTH_ENDPOINT` | No | - | Override health check URL |

---

## Agent Model Configuration

Configuration for AI agent model selection.

### Default Models

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_MODEL_PRIMARY` | No | `claude:sonnet-3.5` | Primary model for complex tasks |
| `AGENT_MODEL_SECONDARY` | No | `claude:haiku` | Secondary model for simpler tasks |
| `AGENT_MODEL_SPECIALIZED` | No | `claude:opus` | Specialized model for critical tasks |
| `AGENT_MODEL_FALLBACK` | No | `ollama:llama3.1` | Local/offline fallback model |
| `AGENT_MODEL_WORKFLOW` | No | `dify:flows` | Workflow orchestration engine |

### Model Selection Strategy

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_AUTO_MODEL_SELECT` | No | `true` | Automatically select optimal model |
| `AGENT_COST_OPTIMIZATION` | No | `true` | Optimize for cost when selecting models |
| `AGENT_QUALITY_THRESHOLD` | No | `0.85` | Quality threshold for model selection |

### Environment-Specific Models

Development environment (faster/cheaper):

| Variable | Default |
|----------|---------|
| `AGENT_MODEL_PRIMARY_DEV` | `claude:haiku` |
| `AGENT_MODEL_SECONDARY_DEV` | `claude:haiku` |
| `AGENT_MODEL_SPECIALIZED_DEV` | `claude:sonnet-3.5` |

Production environment (high quality):

| Variable | Default |
|----------|---------|
| `AGENT_MODEL_PRIMARY_PROD` | `claude:sonnet-3.5` |
| `AGENT_MODEL_SECONDARY_PROD` | `claude:haiku` |
| `AGENT_MODEL_SPECIALIZED_PROD` | `claude:opus` |

### Agent-Specific Overrides

Override models for specific agent types:

```bash
CONDUCTOR_MODEL_PRIMARY=claude:opus
CRITIC_MODEL_PRIMARY=claude:opus
SWEEPER_MODEL_PRIMARY=claude:haiku
```

---

## MCP Rust Server

Configuration for the Rust MCP server.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RUST_LOG` | No | `info` | Log level (trace/debug/info/warn/error) |
| `MCP_LISTEN_ADDRESS` | No | `0.0.0.0:8080` | HTTP listen address (if HTTP mode enabled) |

---

## Google Analytics Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GA_SECRET_ID` | No | - | AWS Secrets Manager secret ID for GA credentials |

---

## Environment File Locations

| File | Purpose |
|------|---------|
| `.env` | Root-level shared configuration |
| `dashboard-server/.env` | Dashboard server specific |
| `dashboard-ui/.env` | Dashboard UI specific (Vite) |
| `mcp-rust/.env` | MCP Rust server specific |

---

## Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore`
2. **Use AWS_PROFILE** for local development instead of hardcoding keys
3. **Set JWT_SECRET** in production - A strong random secret is required
4. **Disable ENABLE_DEV_AUTH** in production - It bypasses authentication
5. **Use AWS Secrets Manager** for sensitive credentials in production

---

## Example Development Configuration

### Full Local Development

```bash
# .env (root)
AWS_REGION=us-west-2
AGENT_MESH_ENV=dev
AGENT_MESH_KV_TABLE=agent-mesh-dev-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-dev-artifacts
AGENT_MESH_EVENT_BUS=agent-mesh-dev-events

# dashboard-server/.env
NODE_ENV=development
ENABLE_DEV_AUTH=true
DASHBOARD_PORT=3001

# dashboard-ui/.env
VITE_ENABLE_DEV_AUTH=true
VITE_DEV_MODE=true
VITE_MCP_SERVER_URL=http://localhost:3001
VITE_DASHBOARD_SERVER_URL=ws://localhost:3001
```

### Docker Compose (LocalStack)

```bash
# All services
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Developer guide and commands
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [infra/README.md](../infra/README.md) - Infrastructure documentation
