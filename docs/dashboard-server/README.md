# Dashboard Server

WebSocket API gateway providing real-time communication between the SolidJS dashboard UI and the MCP Rust server.

## Overview

The dashboard-server is the **sole API gateway** for the dashboard UI. It:

- Connects to mcp-rust via stdio process communication
- Provides WebSocket-based real-time updates to the UI
- Handles authentication and multi-tenant context
- Manages workflow execution and monitoring
- **Does NOT provide REST APIs** - everything is event-driven via WebSocket/pub-sub

## Architecture

```
┌──────────────────┐
│  Dashboard UI    │
│  (SolidJS)       │
└────────┬─────────┘
         │ WebSocket
         ▼
┌──────────────────┐
│ Dashboard Server │
│  ┌────────────┐  │
│  │ WebSocket  │  │
│  │  Handlers  │  │
│  └──────┬─────┘  │
│         │        │
│  ┌──────▼─────┐  │
│  │ MCP Client │  │ ← stdio process
│  └────────────┘  │
└────────┬─────────┘
         │ stdio
         ▼
┌──────────────────┐
│   MCP Rust       │
│   Server         │
└──────────────────┘
```

## Key Principles

### Event-Driven Architecture

**Always use events and pub/sub, never REST:**

- All client-server communication via WebSocket
- Real-time updates pushed to clients
- No polling, no REST endpoints
- Event-driven workflows and monitoring

### Stateless WebSocket Gateway

- No CRUD APIs
- No data persistence (uses mcp-rust KV/S3)
- Pure gateway for real-time communication
- Tenant context per WebSocket connection

## WebSocket Message Types

### MCP Protocol Messages

#### health_check

Check MCP server health

```typescript
// Request
{ type: 'health_check' }

// Response
{
  type: 'health_check_response',
  status: 'healthy',
  timestamp: '2025-10-12T...'
}
```

#### server_info

Get server capabilities

```typescript
// Request
{ type: 'server_info' }

// Response
{
  type: 'server_info_response',
  name: 'agent-mesh',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
  capabilities: { tools: {}, resources: {} }
}
```

#### list_tools

List available MCP tools

```typescript
// Request
{ type: 'list_tools' }

// Response
{
  type: 'list_tools_response',
  tools: [
    {
      name: 'mcp__agent-mesh__kv_get',
      description: 'Get value from KV store',
      inputSchema: { ... }
    },
    // ... more tools
  ]
}
```

#### mcp_call

Execute MCP tool

```typescript
// Request
{
  type: 'mcp_call',
  name: 'mcp__agent-mesh__kv_get',
  arguments: { key: 'user-session-123' }
}

// Response
{
  type: 'mcp_call_response',
  result: {
    value: '{"theme": "dark"}',
    ttl: 1234567890,
    created_at: '2025-10-12T...'
  }
}
```

### Dashboard Events

#### subscribe_events

Subscribe to real-time updates

```typescript
// Request
{
  type: 'subscribe_events',
  eventTypes: ['metrics', 'activity', 'workflows']
}

// Server sends periodic updates:
{
  type: 'metrics_update',
  data: {
    kv: { totalKeys: 42, totalSize: 1024 },
    artifacts: { totalFiles: 15, totalSize: 5120 }
  }
}

{
  type: 'activity_update',
  data: {
    id: 123,
    action: 'Workflow Completed',
    type: 'success',
    timestamp: '2025-10-12T...'
  }
}
```

#### request_metrics

Request current metrics snapshot

```typescript
// Request
{ type: 'request_metrics' }

// Response
{
  type: 'metrics_update',
  data: {
    kv: { totalKeys: 42, totalSize: 1024 },
    artifacts: { totalFiles: 15, totalSize: 5120 },
    lastUpdated: '2025-10-12T...'
  }
}
```

#### context_switch

Switch tenant context

```typescript
// Request
{
  type: 'context_switch',
  userId: 'user-123',
  contextId: 'org-456',
  contextType: 'organization'
}

// Response
{
  type: 'context_switched',
  userId: 'user-123',
  contextId: 'org-456',
  timestamp: '2025-10-12T...'
}
```

## MCP Tools Available

### Key-Value Storage

- `mcp__agent-mesh__kv_get` - Retrieve from DynamoDB
- `mcp__agent-mesh__kv_set` - Store with TTL

### Artifact Management

- `mcp__agent-mesh__artifacts_get` - Download from S3
- `mcp__agent-mesh__artifacts_put` - Upload to S3
- `mcp__agent-mesh__artifacts_list` - List with filtering

### Event Management

- `mcp__agent-mesh__events_send` - Publish to EventBridge
- `mcp__agent-mesh__events_query` - Query event history
- `mcp__agent-mesh__events_analytics` - Analytics and aggregations
- `mcp__agent-mesh__events_create_rule` - Create automation rules
- `mcp__agent-mesh__events_create_alert` - Subscribe to events
- `mcp__agent-mesh__events_health_check` - System health

### Integration Registry

- `mcp__agent-mesh__integration_register` - Register integrations
- `mcp__agent-mesh__integration_connect` - Connect services
- `mcp__agent-mesh__integration_disconnect` - Disconnect
- `mcp__agent-mesh__integration_list` - List integrations
- `mcp__agent-mesh__integration_test` - Test connections

### MCP Proxy

- `mcp__agent-mesh__mcp_proxy` - Execute tools on registered servers
- `mcp__agent-mesh__mcp_list_tools` - List tools from servers

## Development

### Running Locally

```bash
cd dashboard-server
bun install
bun run dev
```

Server starts on `ws://localhost:3001`

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-west-2
AGENT_MESH_KV_TABLE=agent-mesh-dev-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-dev-artifacts
AGENT_MESH_EVENT_BUS=agent-mesh-events

# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

### Running with Dashboard UI

```bash
# From project root
npm run dev:all
```

Starts both dashboard-server and dashboard-ui.

## Testing

```bash
# Unit tests
bun test

# Integration tests
bun test:integration

# Watch mode
bun test:watch
```

### WebSocket Testing

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  // Test health check
  ws.send(JSON.stringify({ type: 'health_check' }));

  // Test MCP tool call
  ws.send(JSON.stringify({
    type: 'mcp_call',
    name: 'mcp__agent-mesh__kv_get',
    arguments: { key: 'test-key' }
  }));
};

ws.onmessage = (event) => {
  console.log('Response:', JSON.parse(event.data));
};
```

## Security

### Authentication

- JWT-based authentication
- Token validation via AuthMiddleware
- User context attached to WebSocket connection

### Authorization

- Per-tenant resource isolation
- Permission-based access control
- MCP tool authorization checks

### Connection Security

- WebSocket over TLS in production
- Origin validation
- Connection rate limiting
- Automatic cleanup on disconnect

## Error Handling

### WebSocket Errors

```typescript
{
  type: 'error',
  code: 'INVALID_MESSAGE',
  message: 'Message type "unknown" not recognized',
  details: { receivedType: 'unknown' }
}
```

### Common Error Codes

- `INVALID_MESSAGE` - Malformed message
- `AUTHENTICATION_FAILED` - Auth token invalid
- `PERMISSION_DENIED` - Insufficient permissions
- `TOOL_NOT_FOUND` - MCP tool doesn't exist
- `INTERNAL_ERROR` - Server-side error

## Monitoring

### Key Metrics

- Active WebSocket connections
- Message processing latency
- MCP tool success/failure rates
- User session duration
- Event broadcast efficiency

### Health Checks

```bash
# WebSocket health check
wscat -c ws://localhost:3001
> {"type":"health_check"}
< {"type":"health_check_response","status":"healthy"}
```

## Deployment

### Docker

```bash
cd dashboard-server
docker build -t dashboard-server .
docker run -p 3001:3001 \
  -e AWS_REGION=us-west-2 \
  -e AGENT_MESH_KV_TABLE=agent-mesh-prod-kv \
  dashboard-server
```

### Production Configuration

- Use WSS (WebSocket Secure) with TLS
- Enable connection pooling
- Configure rate limiting
- Set up CloudWatch logging
- Enable distributed tracing

## Architecture Decisions

### Why WebSocket-Only?

- **Real-time updates**: Instant UI updates without polling
- **Event-driven**: Natural fit for workflow monitoring
- **Efficient**: Single persistent connection per client
- **Stateless**: No server-side session management

### Why Stdio to MCP Rust?

- **Isolation**: MCP server as pure backend service
- **Security**: No network exposure of MCP server
- **Simplicity**: Standard MCP protocol transport
- **Performance**: Direct process communication

### Why No REST APIs?

- **Consistency**: Single communication pattern (events)
- **Real-time**: REST requires polling for updates
- **Simplicity**: Fewer API patterns to maintain
- **Event-driven**: Aligns with EventBridge architecture

## Related Documentation

- [MCP Rust Server](../mcp-rust/README.md) - Backend MCP server
- [Dashboard UI](../dashboard-ui/README.md) - SolidJS frontend
- [Events Architecture](../../dashboard-server/EVENTS.md) - Detailed event flow
- [Error Handling](../../dashboard-server/ERROR_HANDLING_EXAMPLE.md) - Error patterns
