use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{debug, error, info};

use crate::handlers::HandlerRegistry;
use crate::rate_limiting::AwsOperation;
use crate::tenant::{TenantManager, TenantSession};

#[derive(Error, Debug)]
pub enum MCPError {
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Method not found: {0}")]
    MethodNotFound(String),
    #[error("Tenant error: {0}")]
    TenantError(#[from] crate::tenant::TenantError),
    #[error("Handler error: {0}")]
    HandlerError(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Internal server error: {0}")]
    Internal(#[from] anyhow::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPRequest {
    pub jsonrpc: String,
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
    // Custom tenant context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPResponse {
    pub jsonrpc: String,
    pub id: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<MCPErrorResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPErrorResponse {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl From<MCPError> for MCPErrorResponse {
    fn from(error: MCPError) -> Self {
        let (code, message) = match error {
            MCPError::InvalidRequest(msg) => (-32600, format!("Invalid Request: {}", msg)),
            MCPError::MethodNotFound(method) => (-32601, format!("Method not found: {}", method)),
            MCPError::PermissionDenied(msg) => (-32000, format!("Permission denied: {}", msg)),
            MCPError::RateLimitExceeded => (-32001, "Rate limit exceeded".to_string()),
            MCPError::TenantError(err) => (-32002, format!("Tenant error: {}", err)),
            MCPError::HandlerError(msg) => (-32003, format!("Handler error: {}", msg)),
            MCPError::Internal(err) => (-32603, format!("Internal error: {}", err)),
        };

        Self {
            code,
            message,
            data: None,
        }
    }
}

pub struct MCPServer {
    tenant_manager: Arc<TenantManager>,
    handler_registry: HandlerRegistry,
}

impl MCPServer {
    pub async fn new(tenant_manager: Arc<TenantManager>) -> anyhow::Result<Self> {
        // Pre-initialize handler registry (including AWS clients) before starting stdio loop
        eprintln!("[MCP Server] Initializing handlers...");
        let handler_registry = HandlerRegistry::new().await?;
        eprintln!("[MCP Server] Handlers initialized successfully");

        Ok(Self {
            tenant_manager,
            handler_registry,
        })
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        // Log to stderr - stdout is reserved for JSON-RPC protocol
        eprintln!("[MCP Server] Starting on STDIO");

        let stdin = tokio::io::stdin();
        let mut reader = BufReader::new(stdin);
        let mut stdout = tokio::io::stdout();

        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    // EOF reached, shutting down quietly
                    break;
                }
                Ok(_) => {
                    if let Some(response) = self.handle_request(line.trim()).await {
                        let response_json = serde_json::to_string(&response)?;

                        stdout.write_all(response_json.as_bytes()).await?;
                        stdout.write_all(b"\n").await?;
                        stdout.flush().await?;
                    }
                    // If None, it was a notification - no response needed
                }
                Err(e) => {
                    // Log errors to stderr, not stdout
                    eprintln!("[MCP Server] Error reading from stdin: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    pub async fn handle_request(&self, request_line: &str) -> Option<MCPResponse> {
        // Parse the JSON-RPC request
        let request: MCPRequest = match serde_json::from_str(request_line) {
            Ok(req) => req,
            Err(e) => {
                return Some(MCPResponse {
                    jsonrpc: "2.0".to_string(),
                    id: None,
                    result: None,
                    error: Some(MCPError::InvalidRequest(e.to_string()).into()),
                });
            }
        };

        let request_id = request.id.clone();

        // Check if this is a notification (no ID) - notifications don't get responses
        if request_id.is_none() {
            // Handle notification silently
            debug!("Received notification: {}", request.method);
            return None;
        }

        // Handle the request with tenant context
        match self.process_request(request).await {
            Ok(result) => Some(MCPResponse {
                jsonrpc: "2.0".to_string(),
                id: request_id,
                result: Some(result),
                error: None,
            }),
            Err(error) => Some(MCPResponse {
                jsonrpc: "2.0".to_string(),
                id: request_id,
                result: None,
                error: Some(error.into()),
            }),
        }
    }

    async fn process_request(&self, request: MCPRequest) -> Result<Value, MCPError> {
        debug!("Processing request: {}", request.method);

        // Create or get tenant session
        let session = self.get_or_create_session(&request).await?;

        // Check legacy rate limiting first
        if !session.check_rate_limit().await {
            return Err(MCPError::RateLimitExceeded);
        }

        // For tool calls, also check AWS-specific rate limiting
        if request.method == "tools/call" {
            if let Some(params) = &request.params {
                if let Some(tool_name) = params.get("name").and_then(|v| v.as_str()) {
                    if let Some(aws_operation) = AwsOperation::from_tool_name(tool_name, params) {
                        let aws_limiter = self.tenant_manager.get_aws_rate_limiter();
                        if !session
                            .check_aws_operation(&aws_limiter, &aws_operation)
                            .await
                        {
                            return Err(MCPError::RateLimitExceeded);
                        }
                    }
                }
            }
        }

        // Increment request counters
        session.increment_request_count().await;
        let _active_count = session.increment_active_requests().await;

        // Track request for cleanup
        let _guard = RequestGuard::new(session.clone());

        // Update activity timestamp
        session.update_activity().await;

        // Route the request to appropriate handler
        match request.method.as_str() {
            "initialize" => self.handle_initialize().await,
            "tools/list" => self.handle_list_tools(&session).await,
            "tools/call" => self.handle_tool_call(&session, request.params).await,
            "notifications/initialized" => Ok(serde_json::Value::Null),
            _ => Err(MCPError::MethodNotFound(request.method)),
        }
    }

    async fn get_or_create_session(
        &self,
        request: &MCPRequest,
    ) -> Result<Arc<TenantSession>, MCPError> {
        // Use environment defaults if not provided in request (for local dev)
        let tenant_id = match &request.tenant_id {
            Some(id) => id.clone(),
            None => std::env::var("DEFAULT_TENANT_ID").map_err(|_| {
                MCPError::InvalidRequest(
                    "tenant_id is required (set DEFAULT_TENANT_ID env var for local dev)"
                        .to_string(),
                )
            })?,
        };

        let user_id = match &request.user_id {
            Some(id) => id.clone(),
            None => std::env::var("DEFAULT_USER_ID").map_err(|_| {
                MCPError::InvalidRequest(
                    "user_id is required (set DEFAULT_USER_ID env var for local dev)".to_string(),
                )
            })?,
        };

        // Validate tenant access
        self.tenant_manager
            .validate_tenant_access(&tenant_id, &user_id)
            .await?;

        // Create new session
        self.tenant_manager
            .create_session(&tenant_id)
            .await
            .map_err(MCPError::TenantError)
    }

    async fn handle_initialize(&self) -> Result<Value, MCPError> {
        let capabilities = serde_json::json!({
            "protocolVersion": "2025-06-18",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "mcp-rust",
                "version": "0.1.0"
            }
        });

        Ok(capabilities)
    }

    async fn handle_list_tools(&self, session: &TenantSession) -> Result<Value, MCPError> {
        let tools = self
            .handler_registry
            .list_tools(session)
            .await
            .map_err(|e| MCPError::HandlerError(e.to_string()))?;

        Ok(serde_json::json!({
            "tools": tools
        }))
    }

    async fn handle_tool_call(
        &self,
        session: &TenantSession,
        params: Option<Value>,
    ) -> Result<Value, MCPError> {
        let params =
            params.ok_or_else(|| MCPError::InvalidRequest("Missing parameters".to_string()))?;

        let tool_name: String = serde_json::from_value(
            params
                .get("name")
                .ok_or_else(|| MCPError::InvalidRequest("Missing tool name".to_string()))?
                .clone(),
        )
        .map_err(|e| MCPError::InvalidRequest(format!("Invalid tool name: {}", e)))?;

        let arguments = params
            .get("arguments")
            .cloned()
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));

        debug!(
            "Calling tool: {} with session: {}",
            tool_name, session.session_id
        );

        let result = self
            .handler_registry
            .handle_tool_call(session, &tool_name, arguments)
            .await
            .map_err(|e| MCPError::HandlerError(e.to_string()))?;

        Ok(result)
    }
}

// RAII guard to ensure active request count is decremented
struct RequestGuard {
    session: Arc<TenantSession>,
}

impl RequestGuard {
    fn new(session: Arc<TenantSession>) -> Self {
        Self { session }
    }
}

impl Drop for RequestGuard {
    fn drop(&mut self) {
        let session = self.session.clone();
        tokio::spawn(async move {
            session.decrement_active_requests().await;
        });
    }
}
