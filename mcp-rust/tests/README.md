# MCP Rust Server Test Organization

## Test Structure

```
tests/
├── unit/                          # Fast, isolated unit tests
│   ├── mcp_tests.rs              # Core MCP functionality tests
│   └── mcp_protocol_compliance_tests.rs  # Protocol compliance unit tests
├── integration/                   # Component integration tests
│   └── mcp_integration_test.rs   # Cross-component integration tests
├── e2e/                          # End-to-end system tests
│   └── test_mcp_fixes.js         # Full dashboard-server integration test
└── README.md                     # This file
```

## Test Categories

### Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions, methods, and classes in isolation
- **Characteristics**: Fast, no external dependencies, mocked services
- **Examples**: JSON-RPC message parsing, error handling, request validation
- **Run with**: `cargo test --test unit/test_name`

### Integration Tests (`tests/integration/`)

- **Purpose**: Test interactions between components
- **Characteristics**: Medium speed, limited external dependencies
- **Examples**: MCP client-server communication, handler registry integration
- **Run with**: `cargo test --test integration/test_name`

### End-to-End Tests (`tests/e2e/`)

- **Purpose**: Test complete user workflows
- **Characteristics**: Slower, full system dependencies
- **Examples**: Dashboard-server to MCP-server communication, real protocol flows
- **Run with**: `node tests/e2e/test_name.js`

## Test Organization Patterns

### 1. **Test File Naming**

- Unit tests: `{component}_tests.rs`
- Integration tests: `{feature}_integration_test.rs`
- E2E tests: `test_{workflow}.js`

### 2. **Test Function Naming**

```rust
// Pattern: test_{what}_{when}_{expected}
#[tokio::test]
async fn test_handle_request_with_notification_returns_none() { }

#[tokio::test]
async fn test_json_rpc_response_with_invalid_id_returns_error() { }
```

### 3. **Test Data Organization**

```
tests/
├── fixtures/                     # Test data files
│   ├── valid_requests.json
│   ├── invalid_requests.json
│   └── expected_responses.json
└── helpers/                      # Shared test utilities
    ├── mod.rs
    ├── mcp_test_client.rs
    └── assertions.rs
```

### 4. **Test Configuration**

```toml
# Cargo.toml
[[test]]
name = "unit_tests"
path = "tests/unit/mod.rs"

[[test]]
name = "integration_tests"
path = "tests/integration/mod.rs"
```

## Running Tests

### All Tests

```bash
cargo test                        # Run all Rust tests
npm run test:e2e                 # Run all E2E tests (if configured)
```

### By Category

```bash
cargo test --test unit/*         # Unit tests only
cargo test --test integration/*  # Integration tests only
node tests/e2e/*.js              # E2E tests only
```

### Specific Tests

```bash
cargo test test_notification_handling  # Specific test
cargo test mcp_protocol --nocapture    # With output
```

## Test Coverage Requirements

### Critical Protocol Compliance Tests ✅

- [x] Request vs notification handling
- [x] JSON-RPC schema validation
- [x] Protocol version negotiation (2025-06-18)
- [x] Error response format compliance
- [x] Dashboard-server integration

### Performance Tests (Future)

- [ ] Concurrent request handling
- [ ] Rate limiting behavior
- [ ] Memory usage under load
- [ ] Connection stability over time

### Security Tests (Future)

- [ ] Tenant isolation
- [ ] Input validation
- [ ] Error information leakage
- [ ] Resource exhaustion protection

## Best Practices

1. **Test Independence**: Each test should be able to run in isolation
2. **Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Mock External Dependencies**: Use mocks for AWS services, file system, etc.
5. **Test Edge Cases**: Include boundary conditions, error cases, and invalid inputs
6. **Performance Awareness**: Keep unit tests fast (<100ms), integration tests reasonable (<5s)

## Recent Fixes Covered

The test suite specifically covers the MCP protocol compliance fixes implemented:

1. **Notification Handling**: Ensures notifications don't generate responses
2. **Protocol Version**: Validates 2025-06-18 version compliance
3. **JSON-RPC Compliance**: Tests proper request/response format
4. **Error Handling**: Validates graceful error responses
5. **Integration**: Full dashboard-server compatibility testing

These tests prevent regression of the critical protocol issues that were breaking the dashboard-server integration.
