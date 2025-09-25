use mcp_rust::handlers::HandlerRegistry;
use mcp_rust::mcp::*;
use mcp_rust::tenant::{TenantManager, TenantSession};
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

// ...add more tests for handle_list_tools, handle_tool_call, rate limiting, etc. as needed...
