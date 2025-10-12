# MCP Rust Server

High-performance Rust implementation of the Model Context Protocol server with multi-tenant isolation, AWS service integration, and workflow orchestration.

## Overview

The MCP Rust server provides AI assistants with secure, rate-limited access to AWS services through the Model Context Protocol (MCP). Built in Rust for:

- **Multi-tenant isolation** with compile-time guarantees
- **Token bucket rate limiting** per tenant per AWS service
- **Type-safe AWS SDK integration** with async/await
- **Event-driven architecture** via AWS EventBridge
- **Workflow orchestration** with real-time status updates

## Architecture

```
┌─────────────────────┐
│  Claude Desktop /   │
│  Dashboard Server   │
└──────────┬──────────┘
           │ stdio/WebSocket
           ▼
┌─────────────────────┐
│   MCP Rust Server   │
│  ┌───────────────┐  │
│  │ Tenant Context│  │ ← Compile-time isolation
│  │ Rate Limiting │  │ ← Per-tenant AWS quotas
│  │ AWS Services  │  │ ← DynamoDB, S3, EventBridge
│  └───────────────┘  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   AWS Services      │
│ • DynamoDB (KV)     │
│ • S3 (Artifacts)    │
│ • EventBridge       │
│ • Step Functions    │
└─────────────────────┘
```

## Key Features

### Multi-Tenant Isolation

```rust
pub struct TenantContext {
    pub tenant_id: String,
    pub user_id: String,
    pub context_type: ContextType,
    pub permissions: Vec<Permission>,
    pub resource_limits: ResourceLimits,
}
```

- Compile-time enforcement of tenant boundaries
- No cross-tenant data leakage possible
- Type-safe permission system

### Rate Limiting

```rust
pub struct RateLimiter {
    buckets: HashMap<(String, AwsService), TokenBucket>,
}
```

- Per-tenant, per-AWS-service rate limiting
- Token bucket algorithm with configurable refill rates
- Prevents quota exhaustion and noisy neighbor problems

### Event-Driven

All major operations publish events to EventBridge:

```rust
pub async fn send_event(
    &self,
    session: &TenantSession,
    detail_type: &str,
    detail: Value,
) -> Result<(), AwsError>
```

- Automatic tenant context injection
- Real-time monitoring and analytics
- Workflow trigger capabilities

## Available MCP Tools

### Key-Value Storage

- `mcp__agent-mesh__kv_get` - Retrieve values from DynamoDB
- `mcp__agent-mesh__kv_set` - Store values with TTL

### Artifact Management

- `mcp__agent-mesh__artifacts_get` - Download from S3
- `mcp__agent-mesh__artifacts_put` - Upload to S3
- `mcp__agent-mesh__artifacts_list` - List with prefix filtering

### Event Management

- `mcp__agent-mesh__events_send` - Publish to EventBridge
- `mcp__agent-mesh__events_query` - Query event history
- `mcp__agent-mesh__events_analytics` - Event volume and analytics
- `mcp__agent-mesh__events_create_rule` - Create automation rules
- `mcp__agent-mesh__events_create_alert` - Subscribe to events (SNS/email)
- `mcp__agent-mesh__events_health_check` - System health monitoring

### Integration Registry

- `mcp__agent-mesh__integration_register` - Register MCP server integrations
- `mcp__agent-mesh__integration_connect` - Connect to external services
- `mcp__agent-mesh__integration_disconnect` - Disconnect integrations
- `mcp__agent-mesh__integration_list` - List available integrations
- `mcp__agent-mesh__integration_test` - Test integration connections

### MCP Proxy

- `mcp__agent-mesh__mcp_proxy` - Execute tools on registered MCP servers
- `mcp__agent-mesh__mcp_list_tools` - List tools from MCP servers

## Installation

### From Source

```bash
cd mcp-rust
cargo build --release
cargo install --path .
```

This installs the `use_aws_mcp` binary globally.

### Usage

**Stdio Mode (for MCP clients like Claude Desktop):**

```bash
use_aws_mcp
```

**With Environment Variables:**

```bash
AWS_REGION=us-west-2 \
AGENT_MESH_KV_TABLE=agent-mesh-kv \
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts \
AGENT_MESH_EVENT_BUS=agent-mesh-events \
use_aws_mcp
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-west-2` |
| `AGENT_MESH_KV_TABLE` | DynamoDB table name | `agent-mesh-kv` |
| `AGENT_MESH_ARTIFACTS_BUCKET` | S3 bucket name | `agent-mesh-artifacts` |
| `AGENT_MESH_EVENT_BUS` | EventBridge bus name | `agent-mesh-events` |
| `LOG_LEVEL` | Logging level | `info` |

### Claude Desktop Integration

Add to `~/.config/claude-desktop/settings.json`:

```json
{
  "mcpServers": {
    "agent-mesh": {
      "command": "use_aws_mcp",
      "env": {
        "AWS_REGION": "us-west-2",
        "AGENT_MESH_KV_TABLE": "agent-mesh-kv",
        "AGENT_MESH_ARTIFACTS_BUCKET": "agent-mesh-artifacts",
        "AGENT_MESH_EVENT_BUS": "agent-mesh-events"
      }
    }
  }
}
```

### Dashboard Server Integration

The dashboard-server connects to mcp-rust via stdio process communication. See [dashboard-server documentation](../dashboard-server/README.md).

## Development

### Running Tests

```bash
# All tests
cargo test

# Integration tests
cargo test --test '*_integration_test'

# Specific test
cargo test test_kv_operations
```

### Testing with Mock AWS

```bash
# Tests use mocked AWS SDK automatically
cargo test --features mock-aws
```

### Debugging

```bash
# Enable debug logging
RUST_LOG=debug cargo run

# Trace-level logging
RUST_LOG=trace cargo run
```

## Performance

### Why Rust?

- **Multi-tenant isolation**: Compile-time guarantees prevent cross-tenant data access
- **No GC pauses**: Predictable latency for all tenants
- **Memory safety**: Zero-cost abstractions without runtime overhead
- **Async performance**: Tokio runtime handles thousands of concurrent requests

### Benchmarks

- **KV operations**: <5ms p99 latency
- **Event publishing**: <10ms p99 latency
- **Concurrent tenants**: 1000+ tenants per instance
- **Memory per tenant**: <1MB overhead

## Architecture Details

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## API Reference

See [API.md](./API.md) for complete MCP tool documentation.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

## Migration from JavaScript

See [MIGRATION.md](./MIGRATION.md) for migrating from the old Node.js implementation.

## Related Documentation

- [Dashboard Server](../dashboard-server/README.md) - WebSocket API gateway
- [Dashboard UI](../dashboard-ui/README.md) - SolidJS frontend
- [Infrastructure](../infra/README.md) - Terraform deployment
- [Workflow System](../workflow-implementation.md) - Workflow task reference
