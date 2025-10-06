# MCP Rust Server

A high-performance, multi-tenant Model Context Protocol (MCP) server implemented in Rust with AWS integration.

## Features

### Multi-Tenant Architecture

- **Tenant Isolation**: Complete isolation of data and resources per tenant
- **Session Management**: Secure session tracking with automatic cleanup
- **Permission System**: Role-based access control (Admin, User, Viewer)
- **Resource Limits**: Configurable limits per tenant (storage, requests, concurrency)
- **Rate Limiting**: Built-in rate limiting per tenant session

### AWS Integration

- **DynamoDB**: Key-value store with tenant isolation
- **S3**: Artifact storage with tenant-based prefixing
- **EventBridge**: Event publishing with tenant context
- **Secrets Manager**: Secure credential storage

### MCP Protocol Support

- **JSON-RPC 2.0**: Full MCP protocol compliance
- **Tool Registration**: Dynamic tool discovery based on permissions
- **Error Handling**: Comprehensive error responses with proper codes
- **STDIO Interface**: Standard MCP client compatibility

## Architecture

### Core Components

1. **Tenant System** (`src/tenant.rs`)
   - `TenantContext`: Tenant configuration and permissions
   - `TenantSession`: Active session with rate limiting
   - `TenantManager`: Session lifecycle management

2. **MCP Protocol** (`src/mcp.rs`)
   - `MCPServer`: Main server implementation
   - `MCPRequest`/`MCPResponse`: Protocol message types
   - Request routing and error handling

3. **AWS Services** (`src/aws.rs`)
   - `AwsService`: Unified AWS client wrapper
   - Tenant-aware service operations
   - Automatic resource prefixing

4. **Handler Registry** (`src/handlers.rs`)
   - Pluggable tool system
   - Permission-based tool filtering
   - Standard AWS tool implementations

### Security Features

- **Memory Safety**: Rust's ownership system prevents common vulnerabilities
- **Tenant Isolation**: Strict data separation between tenants
- **Permission Validation**: All operations checked against user permissions
- **Rate Limiting**: Protection against abuse
- **Secure Defaults**: Safe configuration out-of-the-box

## Available Tools

### Key-Value Store
- `kv_get`: Retrieve values by key (requires `ReadKV` permission)
- `kv_set`: Store values with optional TTL (requires `WriteKV` permission)

### Artifacts
- `artifacts_get`: Retrieve artifacts by key (requires `GetArtifacts` permission)
- `artifacts_put`: Store artifacts with content type (requires `PutArtifacts` permission)
- `artifacts_list`: List artifacts with optional prefix (requires `ListArtifacts` permission)

### Events
- `events_send`: Publish events to EventBridge (requires `SendEvents` permission)

## Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-west-2
AGENT_MESH_KV_TABLE=agent-mesh-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-artifacts
AGENT_MESH_EVENT_BUS=agent-mesh-events

# Logging (optional)
RUST_LOG=info
```

### Default Tenant

For development, a demo tenant is automatically created:

- **Tenant ID**: `demo-tenant`
- **User ID**: `user-demo-123`
- **Role**: Admin (all permissions)
- **Region**: us-west-2

## Development

### Building

```bash
# Standard build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Check for issues
cargo clippy
cargo fmt
```

### Docker Development

```bash
# Build with Docker
docker run --rm -v "$(pwd):/workspace" -w /workspace rust:1.75 cargo build

# Run tests with Docker
docker run --rm -v "$(pwd):/workspace" -w /workspace rust:1.75 cargo test
```

### Running

```bash
# Start the MCP server (STDIO mode)
cargo run

# With logging
RUST_LOG=debug cargo run
```

## Integration

### Claude Code Configuration

Add to your Claude Code settings:

```json
{
  "mcp-rust": {
    "command": "cargo",
    "args": ["run", "--release"],
    "cwd": "mcp-rust",
    "env": {
      "AWS_REGION": "us-west-2",
      "RUST_LOG": "info"
    }
  }
}
```

### MCP Client Usage

The server communicates via JSON-RPC 2.0 over STDIO:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "kv_get",
    "arguments": {
      "key": "test-key"
    }
  },
  "tenant_id": "demo-tenant",
  "user_id": "user-demo-123"
}
```

## Performance Characteristics

- **Memory Efficient**: Rust's zero-cost abstractions
- **Concurrent**: Tokio async runtime with proper resource management
- **Scalable**: Per-tenant resource isolation
- **Fast**: Native performance with minimal overhead

## Comparison with JavaScript Version

| Aspect | JavaScript | Rust |
|--------|------------|------|
| Memory Safety | Runtime errors | Compile-time guarantees |
| Performance | V8 JIT | Native machine code |
| Concurrency | Event loop | True parallelism |
| Dependencies | Heavy (node_modules) | Minimal static binary |
| Tenant Isolation | Process-level | Memory-level |
| Error Handling | Runtime exceptions | Compile-time validation |

## Future Enhancements

- [ ] Workflow engine integration
- [ ] Real-time event streaming
- [ ] Metrics and monitoring
- [ ] Plugin system for custom tools
- [ ] GraphQL API gateway
- [ ] Distributed caching
- [ ] Kubernetes operator

## Contributing

1. Follow Rust best practices
2. Add tests for new features
3. Update documentation
4. Run `cargo fmt` and `cargo clippy`
5. Ensure all tests pass

## License

MIT License - see LICENSE file for details