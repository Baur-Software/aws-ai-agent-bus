# MCP Rust Server Architecture

This document provides detailed technical architecture documentation for the MCP Rust server implementation.

## System Overview

The MCP Rust server is a high-performance, multi-tenant Model Context Protocol server that provides AI assistants with secure, rate-limited access to AWS services. Built in Rust for maximum performance and safety guarantees.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ Claude Desktop  │  │ Dashboard Server│  │ External MCP Clients        │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘ │
│           │                    │                         │                  │
│           └────────────────────┴─────────────────────────┘                  │
│                                │                                            │
│                           stdio/JSON-RPC                                    │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                         MCP Server Layer                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         MCPServer                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Request   │  │   Session   │  │    Rate     │  │   Handler   │  │   │
│  │  │   Router    │  │  Manager    │  │  Limiting   │  │  Registry   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                          Tenant Layer                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       TenantManager                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Tenant    │  │   Session   │  │  Permission │  │  Resource   │  │   │
│  │  │  Context    │  │  Tracking   │  │   Control   │  │   Limits    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                           AWS Layer                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  DynamoDB   │  │     S3      │  │ EventBridge │  │  Secrets Manager    │ │
│  │  (KV Store) │  │ (Artifacts) │  │  (Events)   │  │   (Credentials)     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Main Entry Point (`main.rs`)

The application entry point configures the Tokio async runtime and initializes all components:

```rust
#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing to stderr (stdout reserved for JSON-RPC)
    // Create TenantManager
    // Create MCPServer with tenant isolation
    // Run the server (blocks until stdin closes)
}
```

**Key Design Decisions:**
- Multi-threaded Tokio runtime with 4 worker threads
- Logging to stderr to preserve stdout for JSON-RPC protocol
- Graceful shutdown on EOF or error

### 2. MCP Protocol Layer (`mcp.rs`)

Handles the JSON-RPC 2.0 protocol implementation for MCP:

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCPServer                                 │
│  ┌───────────────┐                                              │
│  │ handle_request│ ─────► Parse JSON-RPC                        │
│  └───────────────┘            │                                 │
│          │                    ▼                                 │
│          │            ┌───────────────┐                         │
│          │            │process_request│                         │
│          │            └───────────────┘                         │
│          │                    │                                 │
│          │          ┌─────────┼─────────┐                       │
│          │          ▼         ▼         ▼                       │
│          │    initialize  tools/list  tools/call                │
│          │                                                      │
│          └──────────► MCPResponse (JSON-RPC)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Protocol Flow:**
1. Read JSON-RPC request from stdin
2. Validate request format
3. Create or retrieve tenant session
4. Check rate limits (legacy + AWS-specific)
5. Route to appropriate handler
6. Return JSON-RPC response to stdout

**Supported Methods:**
- `initialize` - Protocol handshake
- `tools/list` - List available tools for tenant
- `tools/call` - Execute a tool with arguments
- `notifications/initialized` - Client notification (no response)

### 3. Tenant Management (`tenant.rs`)

Provides compile-time guaranteed multi-tenant isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│                       TenantManager                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    tenant_configs                          │  │
│  │  HashMap<String, TenantContext>                           │  │
│  │  - tenant_id → context mapping                            │  │
│  │  - Loaded from config or auto-registered (dev mode)       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      sessions                              │  │
│  │  HashMap<String, Arc<TenantSession>>                      │  │
│  │  - Session key: "{tenant_id}:{session_uuid}"              │  │
│  │  - Lock-free atomic counters for request tracking         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   aws_rate_limiter                         │  │
│  │  Per-tenant, per-AWS-service token bucket rate limiting   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### TenantContext Structure

```rust
pub struct TenantContext {
    pub tenant_id: String,
    pub user_id: String,
    pub context_type: ContextType,      // Personal or Organization
    pub organization_id: String,
    pub role: UserRole,                  // Admin, User, Viewer
    pub permissions: Vec<Permission>,
    pub aws_region: String,
    pub resource_limits: ResourceLimits,
}
```

#### Context Types

- **Personal Context**: Resources namespaced as `personal-{user_id}`
- **Organization Context**: Resources namespaced as `org-{org_id}`

This affects:
- KV storage key prefixes
- S3 artifact paths
- Event metadata injection

#### Permission System

```rust
pub enum Permission {
    ReadKV, WriteKV, DeleteKV,
    ListArtifacts, GetArtifacts, PutArtifacts,
    SendEvents, ExecuteWorkflows,
    ManageUsers, Execute, Admin, Read, Write,
}
```

**Admin Override**: Users with `UserRole::Admin` bypass all permission checks.

### 4. Rate Limiting (`rate_limiting.rs`)

Dual-layer rate limiting system:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Rate Limiting Layers                         │
│                                                                 │
│  Layer 1: Legacy Request Limits (per-tenant)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  requests_per_minute: 100                                  │  │
│  │  max_concurrent_requests: 10                               │  │
│  │  Implementation: Atomic counters (lock-free)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 2: AWS Service Limits (per-tenant, per-service)          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Token Bucket Algorithm:                                   │  │
│  │  - dynamodb_read_units: 1000/sec                          │  │
│  │  - dynamodb_write_units: 1000/sec                         │  │
│  │  - s3_get_requests: 500/sec                               │  │
│  │  - s3_put_requests: 350/sec                               │  │
│  │  - eventbridge_put_events: 1000/sec                       │  │
│  │  - secrets_manager_requests: 500/sec                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Token Bucket Implementation:**
- Each tenant gets independent buckets per AWS service
- Buckets refill at configured rate
- Operations consume tokens based on estimated AWS capacity units
- Expired buckets cleaned up hourly

### 5. Handler System (`handlers.rs`)

Extensible handler pattern for MCP tools:

```rust
#[async_trait]
pub trait Handler: Send + Sync {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError>;

    fn required_permission(&self) -> Option<Permission>;
    fn tool_schema(&self) -> Value;
}
```

**Registered Handlers:**

| Handler | Tool Name | Permission | AWS Service |
|---------|-----------|------------|-------------|
| `KvGetHandler` | `kv_get` | `ReadKV` | DynamoDB |
| `KvSetHandler` | `kv_set` | `WriteKV` | DynamoDB |
| `ArtifactsGetHandler` | `artifacts_get` | `GetArtifacts` | S3 |
| `ArtifactsPutHandler` | `artifacts_put` | `PutArtifacts` | S3 |
| `ArtifactsListHandler` | `artifacts_list` | `ListArtifacts` | S3 |
| `EventsSendHandler` | `events_send` | `SendEvents` | EventBridge |
| `EventsQueryHandler` | `events_query` | `SendEvents` | DynamoDB |
| `EventsAnalyticsHandler` | `events_analytics` | `SendEvents` | DynamoDB |
| `EventsCreateRuleHandler` | `events_create_rule` | `WriteKV` | DynamoDB |
| `EventsCreateAlertHandler` | `events_create_alert` | `WriteKV` | DynamoDB |
| `EventsHealthCheckHandler` | `events_health_check` | `ReadKV` | DynamoDB |
| `IntegrationRegisterHandler` | `integration_register` | `Admin` | DynamoDB |
| `IntegrationConnectHandler` | `integration_connect` | `Write` | SecretsManager |
| `IntegrationListHandler` | `integration_list` | `Read` | DynamoDB |
| `IntegrationDisconnectHandler` | `integration_disconnect` | `Write` | SecretsManager |
| `IntegrationTestHandler` | `integration_test` | `Read` | - |
| `MCPProxyHandler` | `mcp_proxy` | - | - |
| `MCPListToolsHandler` | `mcp_list_tools` | - | - |

### 6. AWS Integration (`aws.rs`)

Type-safe AWS SDK integration layer:

```rust
pub struct AwsClients {
    pub dynamodb: DynamoDbClient,
    pub s3: S3Client,
    pub eventbridge: EventBridgeClient,
    pub secrets_manager: SecretsManagerClient,
}

pub struct AwsService {
    clients: Arc<AwsClients>,
    kv_table: String,           // AGENT_MESH_KV_TABLE
    artifacts_bucket: String,   // AGENT_MESH_ARTIFACTS_BUCKET
    event_bus: String,          // AGENT_MESH_EVENT_BUS
}
```

**Tenant Isolation in AWS:**

```
DynamoDB Key Structure:
┌─────────────────────────────────────────┐
│  Personal: user:{user_id}:{key}         │
│  Org:      org:{org_id}:user:{user_id}:{key}  │
└─────────────────────────────────────────┘

S3 Path Structure:
┌─────────────────────────────────────────┐
│  Personal: personal-{user_id}/{key}     │
│  Org:      org-{org_id}/{key}           │
└─────────────────────────────────────────┘

EventBridge Event Metadata:
┌─────────────────────────────────────────┐
│  { tenant_id, user_id, ... detail }     │
└─────────────────────────────────────────┘
```

### 7. Integration Registry (`registry.rs`)

MCP server registry for managing external MCP server connections:

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCPServerRegistry                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Deployment Types                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │  │
│  │  │ Process │  │ Docker  │  │ Lambda  │                    │  │
│  │  │ (stdio) │  │Container│  │Function │                    │  │
│  │  └─────────┘  └─────────┘  └─────────┘                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Auth Methods                              │  │
│  │  None │ ApiKey │ OAuth2 │ Basic                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Connection Management                         │  │
│  │  - Health check monitoring                                │  │
│  │  - Auto-reconnect on failure                              │  │
│  │  - Tool discovery (tools/list)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Request Processing Pipeline

```
                   stdin (JSON-RPC)
                         │
                         ▼
               ┌─────────────────┐
               │  Parse Request  │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Get/Create      │
               │ TenantSession   │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Check Legacy    │───► RateLimitExceeded
               │ Rate Limits     │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Check AWS       │───► RateLimitExceeded
               │ Rate Limits     │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Increment       │
               │ Request Counters│
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Route to        │
               │ Handler         │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Check           │───► PermissionDenied
               │ Permissions     │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Execute         │
               │ Handler Logic   │
               └────────┬────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ Decrement       │
               │ Active Requests │
               └────────┬────────┘
                        │
                        ▼
               stdout (JSON-RPC Response)
```

### Graceful Shutdown Sequence

```
     EOF on stdin
          │
          ▼
┌─────────────────┐
│ Set shutdown    │
│ flag            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stop accepting  │
│ new requests    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Wait for active │──► Up to 5 seconds
│ requests        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Force shutdown  │
│ if timeout      │
└────────┬────────┘
         │
         ▼
     Exit(0/1)
```

## Concurrency Model

### Lock Strategy

| Resource | Lock Type | Rationale |
|----------|-----------|-----------|
| `sessions` | `RwLock<HashMap>` | Many reads, few writes |
| `tenant_configs` | `RwLock<HashMap>` | Rarely modified after init |
| `request_count` | `AtomicU32` | High-frequency, no blocking |
| `active_requests` | `AtomicU32` | High-frequency, no blocking |
| `last_activity` | `RwLock<DateTime>` | Infrequent updates |
| `rate_limit_buckets` | `RwLock<HashMap>` | Per-tenant bucket access |

### Deadlock Prevention

The codebase implements careful deadlock prevention:

1. **Session cleanup**: Collects keys first with read lock, then filters separately to avoid holding write lock during async operations
2. **Atomic operations**: Request counters use lock-free atomics
3. **RAII guards**: `RequestGuard` ensures request count decrement even on panic

## Security Architecture

### Credential Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                  Credential Flow                                 │
│                                                                 │
│  User provides credentials                                      │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AWS Secrets Manager                                     │   │
│  │  mcp-credentials/{tenant}/{user}/{service}/{connection}  │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DynamoDB (metadata only)                                │   │
│  │  user-{user_id}-integration-{service}-{connection}       │   │
│  │  Contains: secret ARN reference, NOT credentials         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Isolation Guarantees

1. **Compile-time**: Type system enforces session context passing
2. **Runtime**: All AWS operations prefixed with tenant/user identifiers
3. **Permission**: Per-operation permission checks
4. **Rate limiting**: Per-tenant quotas prevent noisy neighbor
5. **Credential isolation**: Separate Secrets Manager entries per connection

## Performance Characteristics

| Metric | Value | Conditions |
|--------|-------|------------|
| KV Get p99 | <5ms | DynamoDB On-Demand |
| KV Set p99 | <10ms | DynamoDB On-Demand |
| Event Publish p99 | <10ms | EventBridge |
| Concurrent tenants | 1000+ | Per instance |
| Memory per tenant | <1MB | Baseline overhead |
| Startup time | <2s | Cold start |

## File Structure

```
mcp-rust/
├── Cargo.toml              # Dependencies and build config
├── src/
│   ├── main.rs             # Entry point, Tokio runtime setup
│   ├── lib.rs              # Library exports and tests
│   ├── mcp.rs              # MCP protocol implementation
│   ├── tenant.rs           # Multi-tenant context management
│   ├── aws.rs              # AWS service integration
│   ├── rate_limiting.rs    # Token bucket rate limiting
│   ├── registry.rs         # MCP server registry
│   └── handlers/
│       ├── mod.rs          # Handler registry and core handlers
│       ├── integrations.rs # Integration management handlers
│       └── mcp_proxy.rs    # MCP proxy handlers
└── tests/
    ├── unit/               # Unit tests
    └── integration/        # Integration tests
```

## Extension Points

### Adding a New Handler

1. Create handler struct implementing `Handler` trait
2. Register in `HandlerRegistry::new()`
3. Define tool schema with JSON Schema for inputs
4. Specify required permission

### Adding a New AWS Service

1. Add client to `AwsClients` struct
2. Add SDK dependency to `Cargo.toml`
3. Add operations to `AwsService`
4. Add rate limit category to `AwsOperation` enum
5. Configure limits in `AwsServiceLimits`

### Adding a New Permission

1. Add variant to `Permission` enum
2. Update `TenantContext` defaults as needed
3. Reference in handler `required_permission()`
