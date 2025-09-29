use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tracing::{debug, error};

use crate::aws::{AwsError, AwsService};
use crate::tenant::{Permission, TenantSession};
use crate::registry::MCPServerRegistry;

// Re-export handler modules
pub mod integrations;
pub mod mcp_proxy;

#[derive(Error, Debug)]
pub enum HandlerError {
    #[error("Permission denied: required {0:?}")]
    PermissionDenied(Permission),
    #[error("Invalid arguments: {0}")]
    InvalidArguments(String),
    #[error("AWS error: {0}")]
    Aws(#[from] AwsError),
    #[error("Handler not found: {0}")]
    NotFound(String),
    #[error("Internal handler error: {0}")]
    Internal(String),
}

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

pub struct HandlerRegistry {
    handlers: HashMap<String, Arc<dyn Handler>>,
    registry: Arc<MCPServerRegistry>,
}

impl HandlerRegistry {
    pub async fn new() -> anyhow::Result<Self> {
        let aws_service = Arc::new(AwsService::new("us-west-2").await?);
        let registry = Arc::new(MCPServerRegistry::new(aws_service.clone()));
        let mut handlers: HashMap<String, Arc<dyn Handler>> = HashMap::new();

        // Register KV handlers
        handlers.insert(
            "kv_get".to_string(),
            Arc::new(KvGetHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "kv_set".to_string(),
            Arc::new(KvSetHandler::new(aws_service.clone())),
        );

        // Register artifacts handlers
        handlers.insert(
            "artifacts_get".to_string(),
            Arc::new(ArtifactsGetHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "artifacts_put".to_string(),
            Arc::new(ArtifactsPutHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "artifacts_list".to_string(),
            Arc::new(ArtifactsListHandler::new(aws_service.clone())),
        );

        // Register event handler
        handlers.insert(
            "events_send".to_string(),
            Arc::new(EventsSendHandler::new(aws_service.clone())),
        );

        // Register integration management handlers
        handlers.insert(
            "integration_register".to_string(),
            Arc::new(integrations::IntegrationRegisterHandler::new(
                aws_service.clone(),
                registry.clone(),
            )),
        );
        handlers.insert(
            "integration_connect".to_string(),
            Arc::new(integrations::IntegrationConnectHandler::new(
                aws_service.clone(),
                registry.clone(),
            )),
        );
        handlers.insert(
            "integration_list".to_string(),
            Arc::new(integrations::IntegrationListHandler::new(
                aws_service.clone(),
                registry.clone(),
            )),
        );
        handlers.insert(
            "integration_disconnect".to_string(),
            Arc::new(integrations::IntegrationDisconnectHandler::new(
                aws_service.clone(),
                registry.clone(),
            )),
        );
        handlers.insert(
            "integration_test".to_string(),
            Arc::new(integrations::IntegrationTestHandler::new(registry.clone())),
        );

        // Register MCP proxy handlers
        handlers.insert(
            "mcp_proxy".to_string(),
            Arc::new(mcp_proxy::MCPProxyHandler::new(registry.clone())),
        );
        handlers.insert(
            "mcp_list_tools".to_string(),
            Arc::new(mcp_proxy::MCPListToolsHandler::new(registry.clone())),
        );

        Ok(Self { handlers, registry })
    }

    pub async fn list_tools(&self, session: &TenantSession) -> Result<Vec<Value>, HandlerError> {
        let mut tools = Vec::new();

        for (name, handler) in &self.handlers {
            // Check if user has permission for this tool
            if let Some(required_perm) = handler.required_permission() {
                if !session.has_permission(&required_perm) {
                    continue;
                }
            }

            let mut tool_schema = handler.tool_schema();
            if let Value::Object(ref mut tool_obj) = tool_schema {
                tool_obj.insert("name".to_string(), Value::String(name.clone()));
            }

            tools.push(tool_schema);
        }

        Ok(tools)
    }

    pub async fn handle_tool_call(
        &self,
        session: &TenantSession,
        tool_name: &str,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let handler = self
            .handlers
            .get(tool_name)
            .ok_or_else(|| HandlerError::NotFound(tool_name.to_string()))?;

        // Check permissions
        if let Some(required_perm) = handler.required_permission() {
            if !session.has_permission(&required_perm) {
                return Err(HandlerError::PermissionDenied(required_perm));
            }
        }

        debug!(
            "Executing tool {} for tenant {}",
            tool_name, session.context.tenant_id
        );
        handler.handle(session, arguments).await
    }
}

// KV Handlers
pub struct KvGetHandler {
    aws_service: Arc<AwsService>,
}

impl KvGetHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for KvGetHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let key = arguments
            .get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HandlerError::InvalidArguments("Missing 'key' parameter".to_string()))?;

        match self.aws_service.kv_get(session, key).await? {
            Some(value) => Ok(serde_json::json!({"value": value})),
            None => Ok(serde_json::json!({"value": null})),
        }
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::ReadKV)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Get a value from the key-value store",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The key to retrieve"
                    }
                },
                "required": ["key"]
            }
        })
    }
}

pub struct KvSetHandler {
    aws_service: Arc<AwsService>,
}

impl KvSetHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for KvSetHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let key = arguments
            .get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HandlerError::InvalidArguments("Missing 'key' parameter".to_string()))?;

        let value = arguments
            .get("value")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing 'value' parameter".to_string())
            })?;

        let ttl_hours = arguments
            .get("ttl_hours")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);

        self.aws_service
            .kv_set(session, key, value, ttl_hours)
            .await?;
        Ok(serde_json::json!({"success": true}))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::WriteKV)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Set a value in the key-value store",
            "inputSchema": {
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
        })
    }
}

// Artifacts Handlers
pub struct ArtifactsGetHandler {
    aws_service: Arc<AwsService>,
}

impl ArtifactsGetHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for ArtifactsGetHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let key = arguments
            .get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HandlerError::InvalidArguments("Missing 'key' parameter".to_string()))?;

        match self.aws_service.artifacts_get(session, key).await? {
            Some(content) => {
                let base64_content = general_purpose::STANDARD.encode(&content);
                Ok(serde_json::json!({
                    "content": base64_content,
                    "encoding": "base64"
                }))
            }
            None => Ok(serde_json::json!({"content": null})),
        }
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::GetArtifacts)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Get an artifact by key",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The artifact key to retrieve"
                    }
                },
                "required": ["key"]
            }
        })
    }
}

pub struct ArtifactsPutHandler {
    aws_service: Arc<AwsService>,
}

impl ArtifactsPutHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for ArtifactsPutHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let key = arguments
            .get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| HandlerError::InvalidArguments("Missing 'key' parameter".to_string()))?;

        let content = arguments
            .get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing 'content' parameter".to_string())
            })?;

        let content_type = arguments
            .get("content_type")
            .and_then(|v| v.as_str())
            .unwrap_or("text/plain");

        // Decode base64 content
        let decoded_content = general_purpose::STANDARD.decode(content).map_err(|e| {
            HandlerError::InvalidArguments(format!("Invalid base64 content: {}", e))
        })?;

        self.aws_service
            .artifacts_put(session, key, &decoded_content, content_type)
            .await?;
        Ok(serde_json::json!({"success": true}))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::PutArtifacts)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Store an artifact",
            "inputSchema": {
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
        })
    }
}

pub struct ArtifactsListHandler {
    aws_service: Arc<AwsService>,
}

impl ArtifactsListHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for ArtifactsListHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let prefix = arguments.get("prefix").and_then(|v| v.as_str());

        let keys = self.aws_service.artifacts_list(session, prefix).await?;
        Ok(serde_json::json!({"keys": keys}))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::ListArtifacts)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "List artifacts with optional prefix",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "prefix": {
                        "type": "string",
                        "description": "Optional prefix to filter artifacts"
                    }
                }
            }
        })
    }
}

// Events Handler
pub struct EventsSendHandler {
    aws_service: Arc<AwsService>,
}

impl EventsSendHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsSendHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let detail_type = arguments
            .get("detailType")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing 'detailType' parameter".to_string())
            })?;

        let detail = arguments
            .get("detail")
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing 'detail' parameter".to_string())
            })?
            .clone();

        self.aws_service
            .send_event(session, detail_type, detail)
            .await?;
        Ok(serde_json::json!({"success": true}))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::SendEvents)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Send an event",
            "inputSchema": {
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
        })
    }
}
