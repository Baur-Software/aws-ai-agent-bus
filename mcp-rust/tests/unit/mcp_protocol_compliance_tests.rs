use mcp_rust::mcp::*;
use mcp_rust::tenant::TenantManager;
use serde_json::json;
use std::sync::Arc;

/// Tests for MCP protocol compliance fixes
/// Covers the critical notification vs request handling that was broken

#[tokio::test]
async fn test_notification_handling_no_response() {
    // Set required environment variables for tests
    std::env::set_var("DEFAULT_TENANT_ID", "test");
    std::env::set_var("DEFAULT_USER_ID", "test");

    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Notification - no ID field, should return None (no response)
    let notification_json = json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    })
    .to_string();

    let response = server.handle_request(&notification_json).await;
    assert!(
        response.is_none(),
        "Notifications should not generate responses"
    );
}

#[tokio::test]
async fn test_request_handling_with_response() {
    std::env::set_var("DEFAULT_TENANT_ID", "test");
    std::env::set_var("DEFAULT_USER_ID", "test");

    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Request - has ID field, should return Some(response)
    let request_json = json!({
        "jsonrpc": "2.0",
        "id": 42,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    })
    .to_string();

    let response = server.handle_request(&request_json).await;
    assert!(response.is_some(), "Requests should generate responses");

    let resp = response.unwrap();
    assert_eq!(resp.jsonrpc, "2.0");
    assert_eq!(resp.id, Some(json!(42)));
    assert!(resp.result.is_some());
    assert!(resp.error.is_none());
}

#[tokio::test]
async fn test_protocol_version_2025_06_18() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    let request_json = json!({
        "jsonrpc": "2.0",
        "id": "test-init",
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        }
    })
    .to_string();

    let response = server.handle_request(&request_json).await.unwrap();
    let result = response.result.unwrap();

    assert_eq!(
        result.get("protocolVersion").unwrap().as_str().unwrap(),
        "2025-06-18",
        "Server should respond with latest protocol version"
    );
}

#[tokio::test]
async fn test_mcp_sdk_client_handshake_sequence() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Step 1: Client sends initialize request
    let init_request = json!({
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "dashboard-server", "version": "1.0.0"}
        },
        "jsonrpc": "2.0",
        "id": 0
    })
    .to_string();

    let init_response = server.handle_request(&init_request).await;
    assert!(init_response.is_some());
    let resp = init_response.unwrap();
    assert_eq!(resp.id, Some(json!(0)));
    assert!(resp.result.is_some());

    // Step 2: Client sends notifications/initialized notification
    let notification = json!({
        "method": "notifications/initialized",
        "jsonrpc": "2.0"
    })
    .to_string();

    let notification_response = server.handle_request(&notification).await;
    assert!(
        notification_response.is_none(),
        "Notifications should not get responses"
    );
}

#[tokio::test]
async fn test_malformed_json_error_response() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    let malformed_json = "{ invalid json";
    let response = server.handle_request(malformed_json).await;

    assert!(response.is_some());
    let resp = response.unwrap();
    assert_eq!(resp.jsonrpc, "2.0");
    assert_eq!(resp.id, None);
    assert!(resp.error.is_some());
    assert_eq!(resp.error.unwrap().code, -32600); // Invalid Request
}

#[tokio::test]
async fn test_notification_with_different_methods() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    let notifications = vec![
        "notifications/initialized",
        "notifications/progress",
        "notifications/cancelled",
        "notifications/custom",
    ];

    for method in notifications {
        let notification_json = json!({
            "jsonrpc": "2.0",
            "method": method
        })
        .to_string();

        let response = server.handle_request(&notification_json).await;
        assert!(
            response.is_none(),
            "Notification '{}' should not generate response",
            method
        );
    }
}

#[tokio::test]
async fn test_request_id_types_string_and_number() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Test string ID
    let string_id_request = json!({
        "jsonrpc": "2.0",
        "id": "test-string-id",
        "method": "initialize"
    })
    .to_string();

    let response = server.handle_request(&string_id_request).await.unwrap();
    assert_eq!(response.id, Some(json!("test-string-id")));

    // Test number ID
    let number_id_request = json!({
        "jsonrpc": "2.0",
        "id": 12345,
        "method": "initialize"
    })
    .to_string();

    let response = server.handle_request(&number_id_request).await.unwrap();
    assert_eq!(response.id, Some(json!(12345)));

    // Test null ID should be treated as notification
    let null_id_request = json!({
        "jsonrpc": "2.0",
        "id": null,
        "method": "initialize"
    })
    .to_string();

    let response = server.handle_request(&null_id_request).await;
    assert!(
        response.is_none(),
        "null ID should be treated as notification"
    );
}

#[tokio::test]
async fn test_json_rpc_response_schema_compliance() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    let request = json!({
        "jsonrpc": "2.0",
        "id": "schema-test",
        "method": "initialize"
    })
    .to_string();

    let response = server.handle_request(&request).await.unwrap();

    // Verify JSON-RPC 2.0 response schema compliance
    assert_eq!(response.jsonrpc, "2.0");
    assert!(response.id.is_some());

    // Must have either result OR error, not both
    let has_result = response.result.is_some();
    let has_error = response.error.is_some();
    assert!(
        (has_result && !has_error) || (!has_result && has_error),
        "Response must have either result or error, not both"
    );
}

#[tokio::test]
async fn test_concurrent_request_and_notification_handling() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = Arc::new(MCPServer::new(tenant_manager).await.unwrap());

    let mut handles = Vec::new();

    // Mix of requests and notifications
    for i in 0..10 {
        let server_clone = server.clone();
        let handle = tokio::spawn(async move {
            if i % 2 == 0 {
                // Request
                let request = json!({
                    "jsonrpc": "2.0",
                    "id": i,
                    "method": "initialize"
                })
                .to_string();
                (i, server_clone.handle_request(&request).await)
            } else {
                // Notification
                let notification = json!({
                    "jsonrpc": "2.0",
                    "method": "notifications/initialized"
                })
                .to_string();
                (i, server_clone.handle_request(&notification).await)
            }
        });
        handles.push(handle);
    }

    let results = futures::future::join_all(handles).await;

    for result in results {
        let (i, response) = result.unwrap();
        if i % 2 == 0 {
            // Request should have response
            assert!(response.is_some(), "Request {} should have response", i);
        } else {
            // Notification should not have response
            assert!(
                response.is_none(),
                "Notification {} should not have response",
                i
            );
        }
    }
}

#[tokio::test]
async fn test_error_response_preserves_request_id() {
    let tenant_manager = Arc::new(TenantManager::new().await.unwrap());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    let invalid_method_request = json!({
        "jsonrpc": "2.0",
        "id": "preserve-id-test",
        "method": "non_existent_method"
    })
    .to_string();

    let response = server
        .handle_request(&invalid_method_request)
        .await
        .unwrap();

    assert_eq!(response.id, Some(json!("preserve-id-test")));
    assert!(response.error.is_some());
    assert_eq!(response.error.unwrap().code, -32601); // Method not found
}
