# Rust Agent Ecosystem

Complete agent system for Rust development with specialization in MCP servers, async systems, and AWS integration.

## 🎯 Agent Overview

### [rust-mcp-architect](rust-mcp-architect.md)
**Primary architect for MCP server design and implementation**

- MCP protocol compliance (JSON-RPC 2.0, lifecycle, capabilities)
- Multi-tenant isolation and session management
- AWS SDK integration (DynamoDB, S3, EventBridge, Secrets Manager)
- Tokio runtime configuration and graceful shutdown
- Handler registry and tool implementation patterns

**Use when**: Designing MCP servers, implementing protocol features, architecting multi-tenant systems

**Delegates to**:
- `rust-performance-optimizer` - Performance profiling and optimization
- `rust-error-handling-expert` - Error handling strategy
- `rust-testing-specialist` - Test coverage and AWS mocking
- `rust-async-expert` - Complex async coordination

### [rust-performance-optimizer](rust-performance-optimizer.md)
**Performance engineering specialist**

- CPU and memory profiling (flamegraph, heaptrack, tokio-console)
- Zero-copy patterns and allocation optimization
- AWS SDK connection pooling and batch operations
- Async runtime tuning and task spawn overhead
- Benchmark design with Criterion.rs

**Use when**: Performance bottlenecks, high latency, memory issues, optimization needed

**Delegates to**:
- `rust-mcp-architect` - Architectural changes based on findings
- `rust-async-expert` - Async performance patterns

### [rust-testing-specialist](rust-testing-specialist.md)
**Testing infrastructure expert**

- Unit testing with `#[tokio::test]`
- AWS SDK client mocking and test fixtures
- MCP protocol compliance testing
- Multi-tenant isolation testing
- Integration and property-based tests

**Use when**: Test coverage needed, AWS mocking, protocol testing, TDD

**Delegates to**:
- `rust-mcp-architect` - Architectural issues revealed by tests
- `rust-error-handling-expert` - Error path testing

### [rust-async-expert](rust-async-expert.md)
**Async/await and tokio specialist**

- Tokio runtime configuration and debugging
- Graceful shutdown coordination (CancellationToken, broadcast channels)
- Async channel patterns (mpsc, broadcast, watch)
- Select/join patterns for concurrent operations
- Stream processing with tokio_stream

**Use when**: Complex async workflows, shutdown coordination, channel communication, runtime issues

**Delegates to**:
- `rust-performance-optimizer` - Async performance analysis
- `rust-mcp-architect` - Lifecycle integration

### [rust-error-handling-expert](rust-error-handling-expert.md)
**Error handling and recovery specialist**

- thiserror domain error hierarchies
- anyhow application error contexts
- JSON-RPC error code mapping
- Retry strategies with exponential backoff
- User-friendly error messages

**Use when**: Error handling strategy, recovery patterns, user-facing errors, JSON-RPC codes

**Delegates to**:
- `rust-mcp-architect` - Design issues revealed by error analysis
- `rust-testing-specialist` - Error path testing

## 🔄 Delegation Flow

### Typical MCP Server Development Flow

```
User: "Build an MCP tool for workflow processing"
    ↓
rust-mcp-architect: Designs handler, protocol integration, tenant isolation
    ↓ (Delegates for testing)
rust-testing-specialist: Creates unit tests, mocks AWS clients
    ↓ (Identifies performance issue)
rust-performance-optimizer: Profiles and optimizes batch operations
    ↓ (Complex async shutdown needed)
rust-async-expert: Implements graceful shutdown with CancellationToken
    ↓ (Error handling review)
rust-error-handling-expert: Enhances error messages, adds retry logic
    ↓ (Back to architect)
rust-mcp-architect: Integrates improvements, final review
```

## 🎨 Common Patterns

### Pattern: New MCP Tool Implementation

1. **rust-mcp-architect** designs the tool handler and schema
2. **rust-testing-specialist** writes tests with mocked AWS clients
3. **rust-error-handling-expert** reviews error paths
4. **rust-performance-optimizer** profiles critical sections
5. **rust-mcp-architect** integrates and validates

### Pattern: Performance Optimization

1. **rust-performance-optimizer** profiles and identifies bottlenecks
2. **rust-async-expert** optimizes async patterns if needed
3. **rust-mcp-architect** reviews architectural implications
4. **rust-testing-specialist** adds performance regression tests

### Pattern: Complex Async Coordination

1. **rust-async-expert** designs shutdown/coordination pattern
2. **rust-mcp-architect** integrates with server lifecycle
3. **rust-testing-specialist** tests concurrent scenarios
4. **rust-error-handling-expert** handles error propagation

## 🛠️ Technology Stack

### Core Dependencies

```toml
[dependencies]
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
anyhow = "1.0"
tracing = "0.1"
async-trait = "0.1"

# AWS SDK
aws-config = { version = "1.8", features = ["behavior-version-latest"] }
aws-sdk-dynamodb = "1.93"
aws-sdk-s3 = "1.106"
aws-sdk-eventbridge = "1.91"
aws-sdk-secretsmanager = "1.88"
```

### Development Tools

- **Profiling**: cargo flamegraph, heaptrack, tokio-console
- **Testing**: cargo test, cargo nextest, mockall
- **Benchmarking**: Criterion.rs
- **Formatting**: rustfmt, clippy

## 📚 Key Expertise Areas

### MCP Protocol Compliance

- JSON-RPC 2.0 strict adherence
- Protocol version negotiation (2024-11-05, 2025-03-26, 2025-06-18)
- Stdio transport with EOF detection
- Notification vs request handling
- Capability advertisement (tools, resources, prompts)

### Multi-Tenant Architecture

- Tenant context propagation
- Namespace prefixing for isolation
- Permission-based access control
- Resource limits and rate limiting
- Organization vs personal contexts

### AWS Integration

- SDK client initialization and pooling
- Service-specific rate limiting (DynamoDB WCU/RCU, S3, EventBridge)
- Error handling and retry strategies
- Batch operations optimization
- Secrets management

### Async Systems

- Tokio runtime configuration (current_thread vs multi_thread)
- Graceful shutdown coordination
- Channel-based communication
- Stream processing
- RAII patterns with async Drop

## 🚀 Getting Started

### 1. New MCP Server Project

Start with **rust-mcp-architect**:
```
"I need to create a new MCP server for [use case]"
```

The architect will design the structure and delegate to specialists as needed.

### 2. Performance Issues

Start with **rust-performance-optimizer**:
```
"The MCP server is slow during [operation]. Need performance analysis."
```

The optimizer will profile and coordinate with other agents for fixes.

### 3. Test Coverage

Start with **rust-testing-specialist**:
```
"Need comprehensive tests for [MCP tools/handlers] with AWS mocking"
```

The testing specialist will create the test suite and identify issues.

### 4. Async Challenges

Start with **rust-async-expert**:
```
"Need graceful shutdown coordination across [components]"
```

The async expert will design the pattern and integrate with the architecture.

### 5. Error Handling Review

Start with **rust-error-handling-expert**:
```
"Need better error messages and recovery for [scenarios]"
```

The error expert will enhance the error hierarchy and user experience.

## 📊 Success Metrics

- **Protocol Compliance**: 100% MCP specification adherence
- **Test Coverage**: >80% line coverage, 100% critical path coverage
- **Performance**: <100ms p50 latency, <500ms p99 latency
- **Reliability**: <0.1% error rate, graceful degradation under load
- **Security**: Multi-tenant isolation, permission enforcement, input validation

## 🔧 Best Practices

1. **Start with Architecture**: Use rust-mcp-architect for design decisions
2. **Test Early**: Write tests alongside implementation
3. **Profile Before Optimizing**: Use rust-performance-optimizer for data-driven optimization
4. **Handle Errors Gracefully**: User-friendly messages with actionable guidance
5. **Async with Care**: Leverage rust-async-expert for complex coordination

---

This Rust agent ecosystem delivers production-grade MCP servers with proper protocol compliance, multi-tenant isolation, performance optimization, and comprehensive testing.
