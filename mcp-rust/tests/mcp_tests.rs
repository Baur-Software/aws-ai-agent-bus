use mcp_rust::handlers::HandlerRegistry;
use mcp_rust::mcp::*;
use mcp_rust::tenant::{TenantManager, TenantSession};
use mcp_rust::rate_limiting::{AwsOperation, AwsServiceLimits, AwsRateLimiter};
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn test_mcp_error_response_from_invalid_request() {
    let err = MCPError::InvalidRequest("bad".to_string());
    let resp: MCPErrorResponse = err.into();
    assert_eq!(resp.code, -32600);
    assert!(resp.message.contains("Invalid Request"));
}

#[tokio::test]
async fn test_mcp_response_serialization() {
    let resp = MCPResponse {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        result: Some(json!({"ok": true})),
        error: None,
    };
    let s = serde_json::to_string(&resp).unwrap();
    assert!(s.contains("\"jsonrpc\":\"2.0\""));
    assert!(s.contains("\"ok\":true"));
}

#[tokio::test]
async fn test_handle_request_invalid_json() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let resp = server.handle_request("not-json").await;
    assert!(resp.error.is_some());
    assert_eq!(resp.jsonrpc, "2.0");
}

#[tokio::test]
async fn test_handle_initialize() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: None,
        tenant_id: None,
        user_id: None,
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.result.is_some());
    assert!(resp.error.is_none());
}

#[tokio::test]
async fn test_method_not_found() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "unknown_method".to_string(),
        params: None,
        tenant_id: None,
        user_id: None,
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.error.is_some());
    assert_eq!(resp.error.as_ref().unwrap().code, -32601);
}

#[tokio::test]
async fn test_handle_list_tools_success() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "tools/list".to_string(),
        params: None,
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.result.is_some());
    assert!(resp.error.is_none());

    // Verify the response structure
    let result = resp.result.unwrap();
    assert!(result.get("tools").is_some());
}

#[tokio::test]
async fn test_handle_list_tools_with_default_tenant() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(2)),
        method: "tools/list".to_string(),
        params: None,
        tenant_id: None, // Should use default tenant
        user_id: None,   // Should use default user
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.result.is_some());
    assert!(resp.error.is_none());
}

#[tokio::test]
async fn test_handle_tool_call_missing_params() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(3)),
        method: "tools/call".to_string(),
        params: None, // Missing params should cause error
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.error.is_some());
    assert_eq!(resp.error.as_ref().unwrap().code, -32600); // Invalid request
    assert!(resp.error.as_ref().unwrap().message.contains("Missing parameters"));
}

#[tokio::test]
async fn test_handle_tool_call_missing_tool_name() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(4)),
        method: "tools/call".to_string(),
        params: Some(json!({
            // Missing "name" field
            "arguments": {}
        })),
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.error.is_some());
    assert_eq!(resp.error.as_ref().unwrap().code, -32600); // Invalid request
    assert!(resp.error.as_ref().unwrap().message.contains("Missing tool name"));
}

#[tokio::test]
async fn test_handle_tool_call_invalid_tool_name_type() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(5)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": 123, // Invalid type - should be string
            "arguments": {}
        })),
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.error.is_some());
    assert_eq!(resp.error.as_ref().unwrap().code, -32600); // Invalid request
    assert!(resp.error.as_ref().unwrap().message.contains("Invalid tool name"));
}

#[tokio::test]
async fn test_handle_tool_call_with_valid_params() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(6)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": "test_tool",
            "arguments": {
                "param1": "value1",
                "param2": 42
            }
        })),
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    // This might fail if the tool doesn't exist, but it should not be an invalid request error
    if resp.error.is_some() {
        // Should be handler error, not invalid request
        assert_eq!(resp.error.as_ref().unwrap().code, -32003); // Handler error
    }
}

#[tokio::test]
async fn test_handle_tool_call_with_missing_arguments() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(7)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": "test_tool"
            // Missing "arguments" field - should default to empty object
        })),
        tenant_id: Some("test-tenant".to_string()),
        user_id: Some("test-user".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    // Should not be an invalid request error - missing arguments should default to empty object
    if resp.error.is_some() {
        assert_ne!(resp.error.as_ref().unwrap().code, -32600); // Should not be invalid request
    }
}

#[tokio::test]
async fn test_rate_limiting_multiple_requests() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Create many requests quickly to trigger rate limiting
    let mut responses = Vec::new();
    for i in 0..20 {
        let req = MCPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(i)),
            method: "tools/list".to_string(),
            params: None,
            tenant_id: Some("rate-limit-test-tenant".to_string()),
            user_id: Some("rate-limit-test-user".to_string()),
            session_token: None,
        };
        let resp = server
            .handle_request(&serde_json::to_string(&req).unwrap())
            .await;
        responses.push(resp);
    }

    // At least one request should be rate limited
    let rate_limited_count = responses
        .iter()
        .filter(|resp| {
            resp.error.is_some() && resp.error.as_ref().unwrap().code == -32001
        })
        .count();

    // We expect some rate limiting to occur with 20 rapid requests
    // The exact threshold depends on the rate limiter configuration
    assert!(rate_limited_count > 0, "Expected some requests to be rate limited");
}

#[tokio::test]
async fn test_rate_limiting_error_response() {
    // Create a tenant manager with very strict rate limiting for testing
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Spam requests to trigger rate limiting
    let mut rate_limited_response = None;
    for i in 0..50 {
        let req = MCPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(i)),
            method: "initialize".to_string(),
            params: None,
            tenant_id: Some("strict-rate-limit-tenant".to_string()),
            user_id: Some("strict-rate-limit-user".to_string()),
            session_token: None,
        };
        let resp = server
            .handle_request(&serde_json::to_string(&req).unwrap())
            .await;

        if resp.error.is_some() && resp.error.as_ref().unwrap().code == -32001 {
            rate_limited_response = Some(resp);
            break;
        }
    }

    if let Some(resp) = rate_limited_response {
        assert_eq!(resp.error.as_ref().unwrap().code, -32001);
        assert!(resp.error.as_ref().unwrap().message.contains("Rate limit exceeded"));
        assert!(resp.result.is_none());
    }
}

#[tokio::test]
async fn test_concurrent_requests_session_management() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = Arc::new(MCPServer::new(tenant_manager).await.unwrap());

    // Create multiple concurrent requests to test session management
    let mut handles = Vec::new();
    for i in 0..10 {
        let server_clone = server.clone();
        let handle = tokio::spawn(async move {
            let req = MCPRequest {
                jsonrpc: "2.0".to_string(),
                id: Some(json!(i)),
                method: "initialize".to_string(),
                params: None,
                tenant_id: Some(format!("concurrent-tenant-{}", i % 3)), // Use 3 different tenants
                user_id: Some(format!("concurrent-user-{}", i)),
                session_token: None,
            };
            server_clone
                .handle_request(&serde_json::to_string(&req).unwrap())
                .await
        });
        handles.push(handle);
    }

    // Wait for all requests to complete
    let results = futures::future::join_all(handles).await;

    // All requests should succeed (initialize should always work)
    for result in results {
        let resp = result.unwrap();
        assert!(resp.error.is_none());
        assert!(resp.result.is_some());
    }
}

#[tokio::test]
async fn test_notifications_initialized_method() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "notifications/initialized".to_string(),
        params: None,
        tenant_id: None,
        user_id: None,
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp.result.is_some());
    assert!(resp.error.is_none());
    assert_eq!(resp.result.unwrap(), json!(null));
}

#[tokio::test]
async fn test_session_activity_tracking() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager.clone()).await.unwrap();

    let tenant_id = "activity-test-tenant";
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "initialize".to_string(),
        params: None,
        tenant_id: Some(tenant_id.to_string()),
        user_id: Some("activity-test-user".to_string()),
        session_token: None,
    };

    // First request should create a session
    let resp1 = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp1.error.is_none());

    // Verify session was created by making another request
    let resp2 = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;
    assert!(resp2.error.is_none());
}

#[tokio::test]
async fn test_aws_rate_limiting_dynamodb_operations() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Test DynamoDB rate limiting with kv_get operation
    let mut rate_limited_count = 0;
    for i in 0..15 {
        let req = MCPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(i)),
            method: "tools/call".to_string(),
            params: Some(json!({
                "name": "kv_get",
                "arguments": {"key": format!("test-key-{}", i)}
            })),
            tenant_id: Some("aws-rate-test-tenant".to_string()),
            user_id: Some("aws-rate-test-user".to_string()),
            session_token: None,
        };
        let resp = server
            .handle_request(&serde_json::to_string(&req).unwrap())
            .await;

        if resp.error.is_some() && resp.error.as_ref().unwrap().code == -32001 {
            rate_limited_count += 1;
        }
    }

    // Should trigger AWS-specific rate limiting
    assert!(rate_limited_count > 0, "Expected AWS DynamoDB rate limiting to trigger");
}

#[tokio::test]
async fn test_aws_rate_limiting_s3_operations() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Test S3 rate limiting with artifacts_put operation
    let mut rate_limited_count = 0;
    for i in 0..10 {
        let req = MCPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(i)),
            method: "tools/call".to_string(),
            params: Some(json!({
                "name": "artifacts_put",
                "arguments": {"key": format!("test-artifact-{}", i), "content": "test-content"}
            })),
            tenant_id: Some("aws-s3-rate-test".to_string()),
            user_id: Some("aws-s3-rate-user".to_string()),
            session_token: None,
        };
        let resp = server
            .handle_request(&serde_json::to_string(&req).unwrap())
            .await;

        if resp.error.is_some() && resp.error.as_ref().unwrap().code == -32001 {
            rate_limited_count += 1;
        }
    }

    // S3 PUT operations should be rate limited
    assert!(rate_limited_count > 0, "Expected AWS S3 rate limiting to trigger");
}

#[tokio::test]
async fn test_aws_rate_limiting_eventbridge_batch() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Test EventBridge rate limiting with events_send operation
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(1)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": "events_send",
            "arguments": {
                "events": [
                    {"type": "test.event.1", "data": {"test": "data1"}},
                    {"type": "test.event.2", "data": {"test": "data2"}},
                    {"type": "test.event.3", "data": {"test": "data3"}}
                ]
            }
        })),
        tenant_id: Some("aws-eventbridge-test".to_string()),
        user_id: Some("aws-eventbridge-user".to_string()),
        session_token: None,
    };

    // First request should succeed or fail for reasons other than rate limiting
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;

    // The operation should recognize EventBridge batch size limits
    // (this test verifies the rate limiting logic is applied)
    if resp.error.is_some() {
        // Should not be a parsing error or invalid request
        assert_ne!(resp.error.as_ref().unwrap().code, -32600);
    }
}

#[tokio::test]
async fn test_aws_operation_from_tool_name() {
    // Test tool name to AWS operation mapping
    let params = json!({"key": "test"});

    assert!(matches!(
        AwsOperation::from_tool_name("kv_get", &params),
        Some(AwsOperation::DynamoDbRead { read_units: 1 })
    ));

    assert!(matches!(
        AwsOperation::from_tool_name("kv_set", &params),
        Some(AwsOperation::DynamoDbWrite { write_units: 1 })
    ));

    assert!(matches!(
        AwsOperation::from_tool_name("artifacts_get", &params),
        Some(AwsOperation::S3Get)
    ));

    assert!(matches!(
        AwsOperation::from_tool_name("artifacts_put", &params),
        Some(AwsOperation::S3Put)
    ));

    // Test EventBridge with multiple events
    let events_params = json!({
        "events": [
            {"type": "event1"},
            {"type": "event2"},
            {"type": "event3"}
        ]
    });

    if let Some(AwsOperation::EventBridgePutEvents { event_count }) =
        AwsOperation::from_tool_name("events_send", &events_params) {
        assert_eq!(event_count, 3);
    } else {
        panic!("Expected EventBridgePutEvents operation");
    }
}

#[tokio::test]
async fn test_tenant_isolation_aws_rate_limits() {
    let tenant_manager = Arc::new(TenantManager::default());
    let server = MCPServer::new(tenant_manager).await.unwrap();

    // Exhaust rate limits for tenant1
    for i in 0..20 {
        let req = MCPRequest {
            jsonrpc: "2.0".to_string(),
            id: Some(json!(i)),
            method: "tools/call".to_string(),
            params: Some(json!({
                "name": "kv_get",
                "arguments": {"key": format!("tenant1-key-{}", i)}
            })),
            tenant_id: Some("tenant1".to_string()),
            user_id: Some("user1".to_string()),
            session_token: None,
        };
        server.handle_request(&serde_json::to_string(&req).unwrap()).await;
    }

    // tenant2 should still be able to make requests
    let req = MCPRequest {
        jsonrpc: "2.0".to_string(),
        id: Some(json!(100)),
        method: "tools/call".to_string(),
        params: Some(json!({
            "name": "kv_get",
            "arguments": {"key": "tenant2-key"}
        })),
        tenant_id: Some("tenant2".to_string()),
        user_id: Some("user2".to_string()),
        session_token: None,
    };
    let resp = server
        .handle_request(&serde_json::to_string(&req).unwrap())
        .await;

    // tenant2 should not be affected by tenant1's rate limiting
    // (though it might fail for other reasons like missing handlers)
    if resp.error.is_some() {
        assert_ne!(resp.error.as_ref().unwrap().code, -32001,
                  "tenant2 should not be rate limited due to tenant1's usage");
    }
}
