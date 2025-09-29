use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::aws::AwsService;
use crate::handlers::{Handler, HandlerError};
use crate::registry::{AuthMethod, DeploymentConfig, MCPServerConfig, MCPServerRegistry, MCPServerType};
use crate::tenant::{Permission, TenantSession};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub auth_method: AuthMethod,
    pub configuration_schema: Vec<ConfigField>,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigField {
    pub key: String,
    pub label: String,
    pub field_type: String,
    pub required: bool,
    pub description: String,
    pub sensitive: bool,
}

pub struct IntegrationRegisterHandler {
    aws_service: Arc<AwsService>,
    registry: Arc<MCPServerRegistry>,
}

impl IntegrationRegisterHandler {
    pub fn new(aws_service: Arc<AwsService>, registry: Arc<MCPServerRegistry>) -> Self {
        Self { aws_service, registry }
    }
}

#[async_trait]
impl Handler for IntegrationRegisterHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: IntegrationRegisterArgs = serde_json::from_value(arguments)
            .map_err(|e| HandlerError::InvalidArguments(e.to_string()))?;

        info!("Registering integration {} for tenant {}", args.service_id, session.context.tenant_id);

        // Create MCP server config from integration args
        let deployment = if let Some(docker) = args.docker_config {
            DeploymentConfig::Docker {
                image: docker.image,
                tag: docker.tag,
                ports: docker.ports.unwrap_or_default(),
                volumes: docker.volumes.unwrap_or_default(),
                network: docker.network,
                runtime: docker.runtime,
            }
        } else {
            DeploymentConfig::Process {
                command: args.command.unwrap_or_default(),
                args: args.args.unwrap_or_default(),
            }
        };

        let server_config = MCPServerConfig {
            id: args.service_id.clone(),
            name: args.name.clone(),
            description: args.description.clone(),
            server_type: args.server_type.unwrap_or(MCPServerType::Stdio),
            deployment,
            env: args.env.unwrap_or_default(),
            auth_method: args.auth_method.clone(),
            capabilities: args.capabilities.clone(),
            health_check_interval_secs: 60,
            auto_reconnect: true,
        };

        // Register the server
        self.registry
            .register_server(&session.context.get_context_id(), server_config)
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // Store integration config in KV
        let key = format!("integration-{}", args.service_id);
        let config = IntegrationConfig {
            id: args.service_id.clone(),
            name: args.name,
            description: args.description,
            category: args.category,
            auth_method: args.auth_method,
            configuration_schema: args.configuration_schema,
            capabilities: args.capabilities,
        };

        let value = serde_json::to_string(&config)
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        self.aws_service
            .kv_set_direct(&key, &value, Some(24 * 365)) // 1 year TTL
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        Ok(serde_json::json!({
            "success": true,
            "integration_id": args.service_id
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Admin)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Register a new MCP server integration",
            "inputSchema": {
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
                        "description": "Command arguments (for process deployment)"
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
        })
    }
}

#[derive(Debug, Deserialize)]
struct IntegrationRegisterArgs {
    service_id: String,
    name: String,
    description: String,
    category: String,
    server_type: Option<MCPServerType>,
    command: Option<String>,
    args: Option<Vec<String>>,
    docker_config: Option<DockerConfig>,
    env: Option<std::collections::HashMap<String, String>>,
    auth_method: AuthMethod,
    configuration_schema: Vec<ConfigField>,
    capabilities: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DockerConfig {
    image: String,
    tag: String,
    ports: Option<Vec<String>>,
    volumes: Option<Vec<String>>,
    network: Option<String>,
    runtime: Option<String>,
}

pub struct IntegrationConnectHandler {
    aws_service: Arc<AwsService>,
    registry: Arc<MCPServerRegistry>,
}

impl IntegrationConnectHandler {
    pub fn new(aws_service: Arc<AwsService>, registry: Arc<MCPServerRegistry>) -> Self {
        Self { aws_service, registry }
    }
}

#[async_trait]
impl Handler for IntegrationConnectHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: IntegrationConnectArgs = serde_json::from_value(arguments)
            .map_err(|e| HandlerError::InvalidArguments(e.to_string()))?;

        info!(
            "Connecting to integration {} for user {} in tenant {}",
            args.service_id, session.context.user_id, session.context.tenant_id
        );

        // Store user connection in KV
        let connection_id = args.connection_id.unwrap_or_else(|| "default".to_string());
        let key = format!(
            "user-{}-integration-{}-{}",
            session.context.user_id, args.service_id, connection_id
        );

        let connection_data = UserIntegrationConnection {
            service_id: args.service_id.clone(),
            connection_id: connection_id.clone(),
            connection_name: args.connection_name.clone(),
            credentials: args.credentials.clone(),
            settings: args.settings.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            user_id: session.context.user_id.clone(),
        };

        let value = serde_json::to_string(&connection_data)
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        self.aws_service
            .kv_set_direct(&key, &value, Some(24 * 30)) // 30 days TTL
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // Store credentials in Secrets Manager if sensitive
        if let Some(credentials) = &args.credentials {
            for (cred_key, cred_value) in credentials {
                let secret_key = format!(
                    "mcp-credential-{}-{}-{}",
                    session.context.tenant_id, args.service_id, cred_key
                );

                self.aws_service
                    .kv_set_direct(&secret_key, cred_value, Some(24 * 30))
                    .await
                    .map_err(|e| HandlerError::Internal(e.to_string()))?;
            }
        }

        // Connect to the MCP server
        self.registry
            .connect_server(&session.context.get_context_id(), &args.service_id, args.credentials)
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        Ok(serde_json::json!({
            "success": true,
            "connection_id": connection_id,
            "service_id": args.service_id
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Write)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Connect to an MCP server integration",
            "inputSchema": {
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
        })
    }
}

#[derive(Debug, Deserialize)]
struct IntegrationConnectArgs {
    service_id: String,
    connection_id: Option<String>,
    connection_name: Option<String>,
    credentials: Option<std::collections::HashMap<String, String>>,
    settings: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UserIntegrationConnection {
    service_id: String,
    connection_id: String,
    connection_name: Option<String>,
    credentials: Option<std::collections::HashMap<String, String>>,
    settings: Option<std::collections::HashMap<String, String>>,
    created_at: String,
    user_id: String,
}

pub struct IntegrationListHandler {
    aws_service: Arc<AwsService>,
    registry: Arc<MCPServerRegistry>,
}

impl IntegrationListHandler {
    pub fn new(aws_service: Arc<AwsService>, registry: Arc<MCPServerRegistry>) -> Self {
        Self { aws_service, registry }
    }
}

#[async_trait]
impl Handler for IntegrationListHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        _arguments: Value,
    ) -> Result<Value, HandlerError> {
        debug!(
            "Listing integrations for tenant {}",
            session.context.tenant_id
        );

        // Get registered servers from registry
        let servers = self.registry
            .list_servers(&session.context.get_context_id())
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // Get user connections
        let prefix = format!("user-{}-integration-", session.context.user_id);
        let connections = self.aws_service
            .kv_list(&prefix)
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        Ok(serde_json::json!({
            "servers": servers,
            "user_connections": connections
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Read)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "List available MCP server integrations",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        })
    }
}

pub struct IntegrationDisconnectHandler {
    aws_service: Arc<AwsService>,
    registry: Arc<MCPServerRegistry>,
}

impl IntegrationDisconnectHandler {
    pub fn new(aws_service: Arc<AwsService>, registry: Arc<MCPServerRegistry>) -> Self {
        Self { aws_service, registry }
    }
}

#[async_trait]
impl Handler for IntegrationDisconnectHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: IntegrationDisconnectArgs = serde_json::from_value(arguments)
            .map_err(|e| HandlerError::InvalidArguments(e.to_string()))?;

        info!(
            "Disconnecting from integration {} for user {} in tenant {}",
            args.service_id, session.context.user_id, session.context.tenant_id
        );

        // Disconnect from the MCP server
        self.registry
            .disconnect_server(&session.context.get_context_id(), &args.service_id)
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // Remove user connection from KV
        let connection_id = args.connection_id.unwrap_or_else(|| "default".to_string());
        let key = format!(
            "user-{}-integration-{}-{}",
            session.context.user_id, args.service_id, connection_id
        );

        self.aws_service
            .kv_delete(&key)
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        Ok(serde_json::json!({
            "success": true,
            "service_id": args.service_id,
            "connection_id": connection_id
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Write)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Disconnect from an MCP server integration",
            "inputSchema": {
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
        })
    }
}

#[derive(Debug, Deserialize)]
struct IntegrationDisconnectArgs {
    service_id: String,
    connection_id: Option<String>,
}

pub struct IntegrationTestHandler {
    registry: Arc<MCPServerRegistry>,
}

impl IntegrationTestHandler {
    pub fn new(registry: Arc<MCPServerRegistry>) -> Self {
        Self { registry }
    }
}

#[async_trait]
impl Handler for IntegrationTestHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: IntegrationTestArgs = serde_json::from_value(arguments)
            .map_err(|e| HandlerError::InvalidArguments(e.to_string()))?;

        debug!(
            "Testing integration {} for tenant {}",
            args.service_id, session.context.tenant_id
        );

        // Get server status from registry
        let servers = self.registry
            .list_servers(&session.context.get_context_id())
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        let server_info = servers
            .iter()
            .find(|s| s.id == args.service_id)
            .ok_or_else(|| HandlerError::Internal(format!("Server {} not found", args.service_id)))?;

        let is_connected = server_info.status == "Connected";

        Ok(serde_json::json!({
            "success": is_connected,
            "status": server_info.status,
            "tool_count": server_info.tool_count,
            "message": if is_connected {
                "Integration is connected and healthy"
            } else {
                "Integration is not connected"
            }
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Read)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Test an MCP server integration connection",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "service_id": {
                        "type": "string",
                        "description": "ID of the service to test"
                    }
                },
                "required": ["service_id"]
            }
        })
    }
}

#[derive(Debug, Deserialize)]
struct IntegrationTestArgs {
    service_id: String,
}