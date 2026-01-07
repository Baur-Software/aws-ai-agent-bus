# MCP Rust Server API Reference

Complete documentation for all MCP tools provided by the Rust server implementation.

## Protocol Overview

The MCP Rust server implements the Model Context Protocol using JSON-RPC 2.0 over stdio. All requests and responses follow the standard JSON-RPC format.

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": { ... }
  },
  "tenant_id": "optional-tenant-id",
  "user_id": "optional-user-id"
}
```

### Response Format

**Success:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

**Error:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "Error description"
  }
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32600 | Invalid Request | Malformed JSON-RPC request |
| -32601 | Method Not Found | Unknown method name |
| -32000 | Permission Denied | Missing required permission |
| -32001 | Rate Limit Exceeded | Request quota exhausted |
| -32002 | Tenant Error | Tenant authentication failed |
| -32003 | Handler Error | Tool execution error |
| -32603 | Internal Error | Server error |

---

## Core Methods

### initialize

Initialize the MCP protocol connection.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "mcp-rust",
      "version": "0.1.0"
    }
  }
}
```

### tools/list

List available tools for the current tenant session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "kv_get",
        "description": "Get a value from the key-value store",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### tools/call

Execute a tool with arguments.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "kv_get",
    "arguments": {
      "key": "my-key"
    }
  }
}
```

---

## Key-Value Storage Tools

### kv_get

Retrieve a value from the DynamoDB key-value store.

**Permission Required:** `ReadKV`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The key to retrieve"
    }
  },
  "required": ["key"]
}
```

**Response:**
```json
{
  "value": "stored-value"
}
```
or
```json
{
  "value": null
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "kv_get",
    "arguments": {
      "key": "user-preferences"
    }
  }
}
```

---

### kv_set

Store a value in the DynamoDB key-value store.

**Permission Required:** `WriteKV`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The key to set"
    },
    "value": {
      "type": "string",
      "description": "The value to store"
    },
    "ttl_hours": {
      "type": "number",
      "description": "Time to live in hours (default: 24)"
    }
  },
  "required": ["key", "value"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "kv_set",
    "arguments": {
      "key": "user-preferences",
      "value": "{\"theme\": \"dark\"}",
      "ttl_hours": 168
    }
  }
}
```

---

## Artifact Storage Tools

### artifacts_get

Download an artifact from S3.

**Permission Required:** `GetArtifacts`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The artifact key to retrieve"
    }
  },
  "required": ["key"]
}
```

**Response:**
```json
{
  "content": "base64-encoded-content",
  "encoding": "base64"
}
```
or
```json
{
  "content": null
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "artifacts_get",
    "arguments": {
      "key": "reports/monthly-summary.pdf"
    }
  }
}
```

---

### artifacts_put

Upload an artifact to S3.

**Permission Required:** `PutArtifacts`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "key": {
      "type": "string",
      "description": "The artifact key"
    },
    "content": {
      "type": "string",
      "description": "The artifact content (base64 encoded)"
    },
    "content_type": {
      "type": "string",
      "description": "The content type (default: text/plain)"
    }
  },
  "required": ["key", "content"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "artifacts_put",
    "arguments": {
      "key": "exports/data.json",
      "content": "eyJkYXRhIjogWzEsIDIsIDNdfQ==",
      "content_type": "application/json"
    }
  }
}
```

---

### artifacts_list

List artifacts in S3 with optional prefix filtering.

**Permission Required:** `ListArtifacts`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "prefix": {
      "type": "string",
      "description": "Optional prefix to filter artifacts"
    }
  }
}
```

**Response:**
```json
{
  "keys": [
    "reports/january.pdf",
    "reports/february.pdf"
  ]
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "artifacts_list",
    "arguments": {
      "prefix": "reports/"
    }
  }
}
```

---

## Event Management Tools

### events_send

Publish an event to AWS EventBridge.

**Permission Required:** `SendEvents`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "detailType": {
      "type": "string",
      "description": "The event type"
    },
    "detail": {
      "type": "object",
      "description": "The event details"
    }
  },
  "required": ["detailType", "detail"]
}
```

**Response:**
```json
{
  "success": true
}
```

**Notes:**
- `tenant_id` and `user_id` are automatically injected into event detail
- Event source is set to `mcp-rust`

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "events_send",
    "arguments": {
      "detailType": "workflow.completed",
      "detail": {
        "workflowId": "wf-123",
        "status": "success",
        "duration_ms": 1500
      }
    }
  }
}
```

---

### events_query

Query events from the DynamoDB event history.

**Permission Required:** `SendEvents`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
      "description": "Filter by user ID"
    },
    "organizationId": {
      "type": "string",
      "description": "Filter by organization ID"
    },
    "source": {
      "type": "string",
      "description": "Filter by event source"
    },
    "detailType": {
      "type": "string",
      "description": "Filter by event detail type"
    },
    "priority": {
      "type": "string",
      "description": "Filter by priority (low, medium, high, critical)"
    },
    "startTime": {
      "type": "string",
      "description": "Start timestamp (ISO 8601)"
    },
    "endTime": {
      "type": "string",
      "description": "End timestamp (ISO 8601)"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of events to return (default: 50)"
    },
    "exclusiveStartKey": {
      "type": "string",
      "description": "Pagination cursor for next page"
    },
    "sortOrder": {
      "type": "string",
      "description": "Sort order: 'asc' or 'desc' (default: 'desc')"
    }
  }
}
```

**Response:**
```json
{
  "events": [
    {
      "eventId": "evt-123",
      "userId": "user-456",
      "source": "mcp-rust",
      "detailType": "workflow.completed",
      "timestamp": "2024-01-15T10:30:00Z",
      "detail": { ... }
    }
  ],
  "count": 1,
  "lastEvaluatedKey": "cursor-for-next-page"
}
```

**Note:** Requires `userId` or `source` filter to avoid expensive table scans.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "events_query",
    "arguments": {
      "userId": "user-123",
      "detailType": "workflow.completed",
      "startTime": "2024-01-01T00:00:00Z",
      "limit": 20
    }
  }
}
```

---

### events_analytics

Get analytics and aggregations for events.

**Permission Required:** `SendEvents`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
      "description": "User ID to scope analytics (optional, defaults to session user)"
    },
    "organizationId": {
      "type": "string",
      "description": "Organization ID to scope analytics to org-level events"
    },
    "startTime": {
      "type": "string",
      "description": "ISO8601 start time for analytics window (default: 24 hours ago)"
    },
    "endTime": {
      "type": "string",
      "description": "ISO8601 end time for analytics window (default: now)"
    },
    "metrics": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Metrics to compute (volume, topSources, priority, eventTypes)"
    },
    "granularity": {
      "type": "string",
      "enum": ["hourly", "daily"],
      "description": "Time granularity for volume metrics"
    }
  }
}
```

**Response:**
```json
{
  "scope": "user-123",
  "startTime": "2024-01-14T10:00:00Z",
  "endTime": "2024-01-15T10:00:00Z",
  "analytics": {
    "volume": {
      "granularity": "hourly",
      "buckets": [
        { "bucket": "2024-01-15 09:00", "count": 15 },
        { "bucket": "2024-01-15 10:00", "count": 23 }
      ]
    },
    "topSources": [
      { "source": "mcp-rust", "count": 45 },
      { "source": "dashboard", "count": 12 }
    ],
    "priority": {
      "low": 30,
      "medium": 20,
      "high": 5,
      "critical": 2
    },
    "eventTypes": [
      { "eventType": "workflow.completed", "count": 35 }
    ]
  },
  "cached": false
}
```

**Notes:**
- Results are cached for 5 minutes
- Default metrics: `volume`, `topSources`, `priority`

---

### events_create_rule

Create an event filtering rule for automated processing.

**Permission Required:** `WriteKV`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Unique name for the rule"
    },
    "pattern": {
      "type": "object",
      "description": "EventBridge event pattern for matching events"
    },
    "description": {
      "type": "string",
      "description": "Optional description of the rule"
    },
    "enabled": {
      "type": "boolean",
      "description": "Whether the rule is enabled (default: true)"
    }
  },
  "required": ["name", "pattern"]
}
```

**Response:**
```json
{
  "ruleId": "rule-user123-abc123",
  "name": "high-priority-alerts",
  "pattern": { ... },
  "description": "Alert on high priority events",
  "enabled": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "events_create_rule",
    "arguments": {
      "name": "high-priority-alerts",
      "pattern": {
        "detail": {
          "priority": ["high", "critical"]
        }
      },
      "description": "Match all high and critical priority events"
    }
  }
}
```

---

### events_create_alert

Create an alert subscription for an event rule.

**Permission Required:** `WriteKV`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Unique name for the alert subscription"
    },
    "ruleId": {
      "type": "string",
      "description": "ID of the event rule to subscribe to"
    },
    "notificationMethod": {
      "type": "string",
      "enum": ["sns", "email"],
      "description": "Notification method"
    },
    "snsTopicArn": {
      "type": "string",
      "description": "SNS topic ARN (required if notificationMethod is 'sns')"
    },
    "emailAddress": {
      "type": "string",
      "description": "Email address (required if notificationMethod is 'email')"
    },
    "enabled": {
      "type": "boolean",
      "description": "Whether the subscription is enabled (default: true)"
    }
  },
  "required": ["name", "ruleId", "notificationMethod"]
}
```

**Response:**
```json
{
  "subscriptionId": "sub-user123-xyz789",
  "name": "email-alerts",
  "ruleId": "rule-user123-abc123",
  "notificationMethod": "email",
  "emailAddress": "user@example.com",
  "enabled": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### events_health_check

Perform health checks on event system components.

**Permission Required:** `ReadKV`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "eventsTable": {
      "name": "agent-mesh-dev-events",
      "count24h": 150,
      "status": "ok"
    },
    "rulesTable": {
      "name": "agent-mesh-dev-event-rules",
      "count": 5,
      "status": "ok"
    },
    "subscriptionsTable": {
      "name": "agent-mesh-dev-subscriptions",
      "count": 3,
      "status": "ok"
    }
  }
}
```

**Status Values:**
- `healthy`: Active events/rules/subscriptions detected
- `idle`: System operational but no data yet

---

## Integration Management Tools

### integration_register

Register a new MCP server integration.

**Permission Required:** `Admin`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "service_id": {
      "type": "string",
      "description": "Unique identifier for the service"
    },
    "name": {
      "type": "string",
      "description": "Display name of the integration"
    },
    "description": {
      "type": "string",
      "description": "Description of the integration"
    },
    "category": {
      "type": "string",
      "description": "Category (e.g., Analytics, CRM, Development)"
    },
    "server_type": {
      "type": "string",
      "enum": ["stdio", "http", "websocket"],
      "description": "Type of MCP server connection"
    },
    "command": {
      "type": "string",
      "description": "Command to start the MCP server (for process deployment)"
    },
    "args": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Command arguments"
    },
    "docker_config": {
      "type": "object",
      "description": "Docker deployment configuration",
      "properties": {
        "image": { "type": "string" },
        "tag": { "type": "string" },
        "ports": { "type": "array", "items": { "type": "string" } },
        "volumes": { "type": "array", "items": { "type": "string" } },
        "network": { "type": "string" },
        "runtime": { "type": "string" }
      }
    },
    "env": {
      "type": "object",
      "description": "Environment variables"
    },
    "auth_method": {
      "type": "object",
      "description": "Authentication method configuration"
    },
    "configuration_schema": {
      "type": "array",
      "description": "Configuration fields schema"
    },
    "capabilities": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of capabilities"
    }
  },
  "required": ["service_id", "name", "auth_method"]
}
```

**Response:**
```json
{
  "success": true,
  "integration_id": "google-analytics"
}
```

---

### integration_connect

Connect to an MCP server integration.

**Permission Required:** `Write`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "service_id": {
      "type": "string",
      "description": "ID of the service to connect"
    },
    "connection_id": {
      "type": "string",
      "description": "Optional connection ID for multiple connections"
    },
    "connection_name": {
      "type": "string",
      "description": "Display name for this connection"
    },
    "credentials": {
      "type": "object",
      "description": "Credentials for authentication"
    },
    "settings": {
      "type": "object",
      "description": "Additional settings"
    }
  },
  "required": ["service_id"]
}
```

**Response:**
```json
{
  "success": true,
  "connection_id": "work-account",
  "service_id": "google-analytics"
}
```

**Notes:**
- Credentials are stored in AWS Secrets Manager (not DynamoDB)
- Multiple connections per service are supported

---

### integration_list

List available MCP server integrations.

**Permission Required:** `Read`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Response:**
```json
{
  "servers": [
    {
      "id": "google-analytics",
      "name": "Google Analytics",
      "description": "Analytics integration",
      "status": "Connected",
      "tool_count": 5
    }
  ],
  "user_connections": [
    "user-123-integration-google-analytics-default",
    "user-123-integration-github-work"
  ]
}
```

---

### integration_disconnect

Disconnect from an MCP server integration.

**Permission Required:** `Write`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "service_id": {
      "type": "string",
      "description": "ID of the service to disconnect"
    },
    "connection_id": {
      "type": "string",
      "description": "Optional connection ID"
    }
  },
  "required": ["service_id"]
}
```

**Response:**
```json
{
  "success": true,
  "service_id": "google-analytics",
  "connection_id": "default"
}
```

**Notes:**
- Credentials are deleted from Secrets Manager with 7-day recovery window
- Connection metadata is removed from KV store

---

### integration_test

Test an MCP server integration connection.

**Permission Required:** `Read`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "service_id": {
      "type": "string",
      "description": "ID of the service to test"
    }
  },
  "required": ["service_id"]
}
```

**Response:**
```json
{
  "success": true,
  "status": "Connected",
  "tool_count": 5,
  "message": "Integration is connected and healthy"
}
```

---

## MCP Proxy Tools

### mcp_proxy

Execute a tool on a registered MCP server.

**Permission Required:** None (inherits from target tool)

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "server_id": {
      "type": "string",
      "description": "ID of the MCP server"
    },
    "tool_name": {
      "type": "string",
      "description": "Name of the tool to execute"
    },
    "arguments": {
      "type": "object",
      "description": "Arguments for the tool"
    }
  },
  "required": ["server_id", "tool_name"]
}
```

**Response:**
```json
{
  "success": true,
  "result": { ... }
}
```

---

### mcp_list_tools

List tools available from a registered MCP server.

**Permission Required:** None

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "server_id": {
      "type": "string",
      "description": "ID of the MCP server"
    }
  },
  "required": ["server_id"]
}
```

**Response:**
```json
{
  "tools": [
    {
      "name": "analyze_report",
      "description": "Analyze a GA report",
      "inputSchema": { ... }
    }
  ]
}
```

---

## Rate Limiting

All tools are subject to rate limiting:

### Legacy Limits (per tenant)
- `requests_per_minute`: 100
- `max_concurrent_requests`: 10

### AWS Service Limits (per tenant, per service)
| Service | Operation | Default Limit |
|---------|-----------|---------------|
| DynamoDB | Read | 1000 RCU/sec |
| DynamoDB | Write | 1000 WCU/sec |
| DynamoDB | Query | 100/sec |
| S3 | Get | 500/sec |
| S3 | Put | 350/sec |
| S3 | List | 10/sec |
| EventBridge | Put Events | 1000/sec |
| Secrets Manager | Get/Put | 500/sec |

When rate limits are exceeded, tools return error code `-32001`.

---

## Tenant Context

All operations are scoped to the authenticated tenant:

### Key Namespacing
- **Personal context**: `user:{user_id}:{key}`
- **Organization context**: `org:{org_id}:user:{user_id}:{key}`

### S3 Path Prefixing
- **Personal context**: `personal-{user_id}/{path}`
- **Organization context**: `org-{org_id}/{path}`

### Event Metadata
All events automatically include:
```json
{
  "tenant_id": "tenant-123",
  "user_id": "user-456",
  ...
}
```
