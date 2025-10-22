use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tracing::{debug, error};

use crate::aws::{AwsError, AwsService};
use crate::registry::MCPServerRegistry;
use crate::tenant::{Permission, TenantSession};

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
    _registry: Arc<MCPServerRegistry>,
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

        // Register event handlers
        handlers.insert(
            "events_send".to_string(),
            Arc::new(EventsSendHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "events_query".to_string(),
            Arc::new(EventsQueryHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "events_analytics".to_string(),
            Arc::new(EventsAnalyticsHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "events_create_rule".to_string(),
            Arc::new(EventsCreateRuleHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "events_create_alert".to_string(),
            Arc::new(EventsCreateAlertHandler::new(aws_service.clone())),
        );
        handlers.insert(
            "events_health_check".to_string(),
            Arc::new(EventsHealthCheckHandler::new(aws_service.clone())),
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

        Ok(Self {
            handlers,
            _registry: registry,
        })
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

// Events Query Handler
pub struct EventsQueryHandler {
    aws_service: Arc<AwsService>,
}

impl EventsQueryHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsQueryHandler {
    async fn handle(
        &self,
        _session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        // Extract query parameters
        let user_id = arguments
            .get("userId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let organization_id = arguments
            .get("organizationId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let source = arguments
            .get("source")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let detail_type = arguments
            .get("detailType")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let priority = arguments
            .get("priority")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let start_time = arguments
            .get("startTime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let end_time = arguments
            .get("endTime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let limit = arguments
            .get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(50) as i32;

        let exclusive_start_key = arguments
            .get("exclusiveStartKey")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let sort_order = arguments
            .get("sortOrder")
            .and_then(|v| v.as_str())
            .unwrap_or("desc");

        // Query events from DynamoDB
        let result = self
            .aws_service
            .query_events(
                user_id,
                organization_id,
                source,
                detail_type,
                priority,
                start_time,
                end_time,
                limit,
                exclusive_start_key,
                sort_order == "asc",
            )
            .await?;

        Ok(result)
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::SendEvents) // Reuse SendEvents permission for now
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Query events from the event history",
            "inputSchema": {
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
        })
    }
}

// EventsAnalyticsHandler
// MCP Tool: events_analytics
// Provides event analytics and aggregations (volume, top sources, priority distribution)
pub struct EventsAnalyticsHandler {
    aws_service: Arc<AwsService>,
}

impl EventsAnalyticsHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsAnalyticsHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        // Extract analytics parameters
        let user_id = arguments
            .get("userId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let organization_id = arguments
            .get("organizationId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let start_time = arguments
            .get("startTime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let end_time = arguments
            .get("endTime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let metrics = arguments
            .get("metrics")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| {
                vec![
                    "volume".to_string(),
                    "topSources".to_string(),
                    "priority".to_string(),
                ]
            });
        let granularity = arguments
            .get("granularity")
            .and_then(|v| v.as_str())
            .unwrap_or("hourly")
            .to_string();

        // Execute analytics query
        let result = self
            .aws_service
            .analytics_query(
                session,
                user_id,
                organization_id,
                start_time,
                end_time,
                metrics,
                granularity,
            )
            .await?;

        Ok(result)
    }

    fn tool_schema(&self) -> Value {
        json!({
            "name": "events_analytics",
            "description": "Get analytics and aggregations for events (volume, top sources, priority distribution)",
            "inputSchema": {
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
                    "timeRange": {
                        "type": "string",
                        "description": "Time range for analytics (1h, 24h, 7d, 30d) or custom ISO8601 range"
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
                        "description": "Metrics to compute (volume, topSources, priority, eventTypes)",
                        "items": { "type": "string" }
                    },
                    "groupBy": {
                        "type": "string",
                        "description": "Time grouping for volume metrics (hour, day, week)",
                        "enum": ["hour", "day", "week"]
                    },
                    "granularity": {
                        "type": "string",
                        "description": "Time granularity for volume metrics (hourly, daily)",
                        "enum": ["hourly", "daily"]
                    }
                },
                "required": []
            }
        })
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::SendEvents) // Reuse SendEvents permission for analytics
    }
}

// EventsCreateRuleHandler
// MCP Tool: events_create_rule
// Creates event filtering rules stored in DynamoDB
pub struct EventsCreateRuleHandler {
    aws_service: Arc<AwsService>,
}

impl EventsCreateRuleHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsCreateRuleHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        // Extract required fields
        let name = arguments
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing required field 'name'".to_string())
            })?
            .to_string();

        let pattern = arguments
            .get("pattern")
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing required field 'pattern'".to_string())
            })?
            .clone();

        let description = arguments
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let enabled = arguments
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        // Create the rule
        let result = self
            .aws_service
            .create_event_rule(session, &name, pattern, description, enabled)
            .await?;

        Ok(result)
    }

    fn tool_schema(&self) -> Value {
        json!({
            "name": "events_create_rule",
            "description": "Create an event filtering rule for automated processing",
            "inputSchema": {
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
        })
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::WriteKV) // Rules stored in DynamoDB
    }
}

// EventsCreateAlertHandler
// MCP Tool: events_create_alert
// Creates alert subscriptions (SNS/email) for event rules
pub struct EventsCreateAlertHandler {
    aws_service: Arc<AwsService>,
}

impl EventsCreateAlertHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsCreateAlertHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        // Extract required fields
        let name = arguments
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing required field 'name'".to_string())
            })?
            .to_string();

        let rule_id = arguments
            .get("ruleId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments("Missing required field 'ruleId'".to_string())
            })?
            .to_string();

        let notification_method = arguments
            .get("notificationMethod")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                HandlerError::InvalidArguments(
                    "Missing required field 'notificationMethod'".to_string(),
                )
            })?
            .to_string();

        let sns_topic_arn = arguments
            .get("snsTopicArn")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let email_address = arguments
            .get("emailAddress")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let enabled = arguments
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        // Create the alert subscription
        let result = self
            .aws_service
            .create_alert_subscription(
                session,
                &name,
                &rule_id,
                &notification_method,
                sns_topic_arn,
                email_address,
                enabled,
            )
            .await?;

        Ok(result)
    }

    fn tool_schema(&self) -> Value {
        json!({
            "name": "events_create_alert",
            "description": "Create an alert subscription for an event rule (SNS or email notifications)",
            "inputSchema": {
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
                        "description": "Notification method (sns or email)",
                        "enum": ["sns", "email"]
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
        })
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::WriteKV) // Subscriptions stored in DynamoDB
    }
}

// EventsHealthCheckHandler
// MCP Tool: events_health_check
// Performs health checks on event system components
pub struct EventsHealthCheckHandler {
    aws_service: Arc<AwsService>,
}

impl EventsHealthCheckHandler {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self { aws_service }
    }
}

#[async_trait]
impl Handler for EventsHealthCheckHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        _arguments: Value,
    ) -> Result<Value, HandlerError> {
        // Perform health check
        let result = self.aws_service.events_health_check(session).await?;
        Ok(result)
    }

    fn tool_schema(&self) -> Value {
        json!({
            "name": "events_health_check",
            "description": "Perform health checks on event system components (DynamoDB tables, event volume)",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        })
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::ReadKV) // Health check reads from DynamoDB
    }
}
