# Dashboard Server Events Documentation

This document describes the event system architecture and implementation in dashboard-server.

## Overview

Dashboard-server serves as the WebSocket API gateway, handling real-time events and metrics aggregation. The event system is designed around WebSocket connections with fallback to simulated events during development.

## Event Architecture

### Core Components

1. **EventsHandler** (`src/handlers/events.ts`)
   - Simple event logging and management
   - Generates unique event IDs
   - Batch event processing
   - Currently logs to console (EventBridge integration planned)

2. **EventSubscriber** (`src/events/subscriber.ts`)
   - WebSocket event subscription management
   - Real-time metrics simulation
   - Activity update broadcasting
   - EventBridge integration placeholder

3. **WebSocket Handlers** (`src/websocket/handlers.ts`)
   - WebSocket connection management
   - Event type routing and processing
   - User authentication and context management
   - Broadcasting to specific users or all clients

4. **MetricsAggregator** (`src/services/metrics.ts`)
   - KV store metrics collection
   - S3 artifacts metrics
   - Activity event tracking
   - Real-time data aggregation

## Event Types

### WebSocket Message Types

#### MCP Protocol Messages

- `health_check` - Server health status
- `server_info` - Server information and capabilities
- `list_tools` - Available MCP tools listing
- `mcp_call` - Direct MCP tool invocation

#### Dashboard Events

- `subscribe_events` - Event subscription management
- `request_metrics` - Metrics data request
- `context_switch` - User context switching
- `session_created` - New session creation
- `ping/pong` - Connection health check

#### Real-time Updates

- `metrics_update` - KV/S3 metrics changes
- `activity_update` - System activity events
- `context_switched` - Context change confirmation
- `initial_data` - Connection initialization data

### Event Data Structures

#### Metrics Event

```typescript
interface MetricsEvent {
  kv: {
    totalKeys: number;
    totalSize: number; // in KB
  };
  artifacts: {
    totalFiles: number;
    totalSize: number; // in KB
  };
  lastUpdated: string; // ISO timestamp
}
```

#### Activity Event

```typescript
interface ActivityEvent {
  id: number;
  action: string; // e.g., "KV Store Updated", "Agent Task Completed"
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string; // ISO timestamp
}
```

#### Context Switch Event

```typescript
interface ContextSwitchEvent {
  userId: string;
  sessionId: string;
  fromContextId?: string;
  toContextId: string;
  contextType: 'user' | 'organization';
  timestamp: string;
}
```

## Event Flow

### Client Connection Flow

1. WebSocket connection established
2. Authentication via AuthMiddleware
3. User context stored on connection
4. Initial metrics/activity data sent
5. Event subscriptions activated
6. Real-time updates begin

### Event Broadcasting Flow

1. Event generated (metrics update, user action, etc.)
2. EventSubscriber processes event
3. Callbacks triggered for registered listeners
4. WebSocket handlers broadcast to relevant clients
5. Clients receive and process updates

### MCP Tool Integration

1. Client sends `mcp_call` message
2. WebSocket handler routes to appropriate handler (KV, Agent, etc.)
3. Handler processes request with user context
4. Result sent back to client
5. Activity events generated if needed

## Supported MCP Tools

### KV Store Operations

- `mcp__aws__kv_get` - Get value by key
- `mcp__aws__kv_set` - Set key-value pair

### Agent Operations

- `agent.listAvailableAgents` - List .claude/agents
- `agent.processRequest` - Process via agent governance
- `agent.delegateToAgent` - Direct agent delegation
- `agent.getTaskStatus` - Task status checking
- CRUD operations: `agent_list`, `agent_get`, `agent_create`, `agent_update`, `agent_delete`

## Security & Permissions

### Authentication

- WebSocket connections require authentication
- JWT tokens validated via AuthMiddleware
- User context attached to each connection

### Authorization

- Permission checks for agent operations
- User/organization-based access control
- Resource ownership validation

### User Context

```typescript
interface UserContext {
  userId: string;
  organizationId?: string;
  permissions: string[];
  // Additional user metadata
}
```

## Development vs Production

### Current State (Development)

- Event simulation via intervals (5-second updates)
- Console logging for events
- Mock activity data
- Direct WebSocket handling

### Planned Production Architecture

- EventBridge rule-based event processing
- Lambda functions for event handling
- DynamoDB event persistence
- SNS/SQS for reliable messaging
- CloudWatch metrics integration

## Event Simulation

During development, EventSubscriber simulates:

- **KV Metrics Updates**: Random changes in key count/size every ~7 seconds
- **Activity Events**: Random system actions every ~8 seconds
- **Connection Health**: Automatic ping/pong for connection monitoring

## Error Handling

### WebSocket Errors

- Invalid message format → `error` response
- Authentication failure → Connection closed (1008)
- Permission denied → `error` response with details
- Tool not found → Specific error message

### Event Processing Errors

- Failed event generation → Logged to console
- Broadcast failure → Connection cleanup
- MCP tool errors → Structured error responses

## Configuration

### Environment Variables

```bash
AGENT_MESH_KV_TABLE=agent-mesh-dev-kv
AGENT_MESH_ARTIFACTS_BUCKET=agent-mesh-dev-artifacts
AGENT_MESH_EVENT_BUS=agent-mesh-events
```

### Event Timing

- Metrics simulation: Every 5 seconds
- Activity simulation: Every 5 seconds (30% chance)
- Connection health: Ping/pong on demand

## Future Enhancements

### Planned Features

1. **EventBridge Integration** - Real AWS event processing
2. **Event Persistence** - DynamoDB event storage
3. **Real-time Metrics** - Live AWS resource monitoring
4. **Event Filtering** - User-specific event subscriptions
5. **Event History** - Historical event querying
6. **Webhook Support** - External event notifications

### Performance Optimizations

1. Connection pooling for MCP services
2. Event batching for high-volume scenarios
3. Client-side event caching
4. Selective broadcasting based on subscriptions

## Testing

### Unit Tests

- Event handler validation
- WebSocket message processing
- Metrics aggregation logic
- Permission checking

### Integration Tests

- End-to-end WebSocket communication
- MCP tool integration
- Event broadcasting verification
- Authentication flow testing

## Monitoring

### Key Metrics

- Active WebSocket connections
- Event processing latency
- MCP tool success/failure rates
- User session duration
- Broadcasting efficiency

### Health Checks

- WebSocket server availability
- MCP service connectivity
- AWS service accessibility (DynamoDB, S3)
- Event simulation status
