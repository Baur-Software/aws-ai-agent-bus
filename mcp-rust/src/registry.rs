use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::aws::AwsService;
use crate::tenant::TenantSession;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub server_type: MCPServerType,
    pub deployment: DeploymentConfig,
    pub env: HashMap<String, String>,
    pub auth_method: AuthMethod,
    pub capabilities: Vec<String>,
    pub health_check_interval_secs: u64,
    pub auto_reconnect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MCPServerType {
    Stdio,
    Http,
    WebSocket,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentConfig {
    Docker {
        image: String,
        tag: String,
        ports: Vec<String>,
        volumes: Vec<String>,
        network: Option<String>,
        runtime: Option<String>, // nvidia for GPU, etc.
    },
    Process {
        command: String,
        args: Vec<String>,
    },
    Lambda {
        function_name: String,
        region: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    None,
    ApiKey {
        key_field: String,
    },
    OAuth2 {
        client_id: String,
        client_secret: String,
    },
    Basic {
        username: String,
        password: String,
    },
}

#[derive(Debug)]
pub struct MCPServerConnection {
    pub config: MCPServerConfig,
    pub process: Option<Child>,
    pub container_id: Option<String>, // For Docker deployments
    pub endpoint: Option<String>,     // For HTTP/WebSocket connections
    pub status: ConnectionStatus,
    pub last_health_check: std::time::Instant,
    pub tools: Vec<MCPTool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Failed(String),
}

pub struct MCPServerRegistry {
    servers: Arc<RwLock<HashMap<String, MCPServerConnection>>>,
    aws_service: Arc<AwsService>,
}

impl MCPServerRegistry {
    pub fn new(aws_service: Arc<AwsService>) -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
            aws_service,
        }
    }

    /// Register a server with context awareness (personal or organizational)
    #[allow(dead_code)]
    pub async fn register_server_for_context(
        &self,
        session: &TenantSession,
        config: MCPServerConfig,
    ) -> Result<(), RegistryError> {
        let context_id = session.context.get_context_id();
        self.register_server(&context_id, config).await
    }

    /// Connect to a server with context awareness
    #[allow(dead_code)]
    pub async fn connect_server_for_context(
        &self,
        session: &TenantSession,
        server_id: &str,
        credentials: Option<HashMap<String, String>>,
    ) -> Result<(), RegistryError> {
        let context_id = session.context.get_context_id();
        self.connect_server(&context_id, server_id, credentials)
            .await
    }

    /// List servers for a context
    #[allow(dead_code)]
    pub async fn list_servers_for_context(
        &self,
        session: &TenantSession,
    ) -> Result<Vec<MCPServerInfo>, RegistryError> {
        let context_id = session.context.get_context_id();
        self.list_servers(&context_id).await
    }

    pub async fn register_server(
        &self,
        tenant_id: &str,
        config: MCPServerConfig,
    ) -> Result<(), RegistryError> {
        info!(
            "Registering MCP server: {} for tenant: {}",
            config.id, tenant_id
        );

        // Store configuration in DynamoDB
        self.store_server_config(tenant_id, &config).await?;

        // Initialize connection
        let connection = MCPServerConnection {
            config: config.clone(),
            process: None,
            container_id: None,
            endpoint: None,
            status: ConnectionStatus::Disconnected,
            last_health_check: std::time::Instant::now(),
            tools: Vec::new(),
        };

        let mut servers = self.servers.write().await;
        let key = format!("{}-{}", tenant_id, config.id);
        servers.insert(key, connection);

        Ok(())
    }

    pub async fn connect_server(
        &self,
        tenant_id: &str,
        server_id: &str,
        credentials: Option<HashMap<String, String>>,
    ) -> Result<(), RegistryError> {
        let key = format!("{}-{}", tenant_id, server_id);

        let mut servers = self.servers.write().await;
        let connection = servers
            .get_mut(&key)
            .ok_or_else(|| RegistryError::ServerNotFound(server_id.to_string()))?;

        if connection.config.server_type != MCPServerType::Stdio {
            return Err(RegistryError::UnsupportedServerType(format!(
                "{:?}",
                connection.config.server_type
            )));
        }

        info!("Connecting to MCP server: {}", server_id);
        connection.status = ConnectionStatus::Connecting;

        // Build environment variables
        let mut env_vars = connection.config.env.clone();

        // Inject credentials if provided
        if let Some(creds) = credentials {
            for (key, value) in creds {
                env_vars.insert(key, value);
            }
        }

        // Inject auth credentials based on auth method
        match &connection.config.auth_method {
            AuthMethod::ApiKey { key_field } => {
                if let Some(api_key) = self.get_credential(tenant_id, server_id, "api_key").await? {
                    env_vars.insert(key_field.clone(), api_key);
                }
            }
            AuthMethod::OAuth2 {
                client_id: _,
                client_secret: _,
            } => {
                if let Some(stored_client_id) = self
                    .get_credential(tenant_id, server_id, "client_id")
                    .await?
                {
                    env_vars.insert("CLIENT_ID".to_string(), stored_client_id);
                }
                if let Some(stored_client_secret) = self
                    .get_credential(tenant_id, server_id, "client_secret")
                    .await?
                {
                    env_vars.insert("CLIENT_SECRET".to_string(), stored_client_secret);
                }
            }
            AuthMethod::Basic { username, password } => {
                env_vars.insert("USERNAME".to_string(), username.clone());
                env_vars.insert("PASSWORD".to_string(), password.clone());
            }
            AuthMethod::None => {}
        }

        // Start the MCP server based on deployment type
        match &connection.config.deployment {
            DeploymentConfig::Docker {
                image,
                tag,
                ports,
                volumes,
                network,
                runtime,
            } => {
                info!("Starting Docker container for MCP server: {}", server_id);

                let container_name = format!("mcp-{}-{}", tenant_id, server_id);
                let mut docker_cmd = Command::new("docker");

                docker_cmd
                    .arg("run")
                    .arg("-d") // Detached mode
                    .arg("--name")
                    .arg(&container_name)
                    .arg("--rm"); // Remove container when stopped

                // Add runtime if specified (e.g., nvidia for GPU)
                if let Some(runtime) = runtime {
                    docker_cmd.arg("--runtime").arg(runtime);
                }

                // Add network if specified
                if let Some(net) = network {
                    docker_cmd.arg("--network").arg(net);
                }

                // Add port mappings
                for port in ports {
                    docker_cmd.arg("-p").arg(port);
                }

                // Add volume mounts
                for volume in volumes {
                    docker_cmd.arg("-v").arg(volume);
                }

                // Add environment variables
                for (key, value) in &env_vars {
                    docker_cmd.arg("-e").arg(format!("{}={}", key, value));
                }

                // Image and tag
                docker_cmd.arg(format!("{}:{}", image, tag));

                match docker_cmd.output().await {
                    Ok(output) => {
                        if output.status.success() {
                            let container_id =
                                String::from_utf8_lossy(&output.stdout).trim().to_string();
                            connection.container_id = Some(container_id.clone());
                            connection.status = ConnectionStatus::Connected;

                            // Set endpoint for HTTP/WebSocket connections
                            if !ports.is_empty() {
                                let port = ports[0].split(':').nth(0).unwrap_or("8080");
                                connection.endpoint = Some(format!("http://localhost:{}", port));
                            }

                            info!("Docker container started: {}", container_id);

                            // Initialize the connection
                            self.initialize_mcp_connection(&key).await?;

                            // Fetch available tools
                            self.fetch_server_tools(&key).await?;

                            Ok(())
                        } else {
                            let error = String::from_utf8_lossy(&output.stderr);
                            error!("Failed to start Docker container: {}", error);
                            connection.status = ConnectionStatus::Failed(error.to_string());
                            Err(RegistryError::ConnectionFailed(error.to_string()))
                        }
                    }
                    Err(e) => {
                        error!("Failed to execute Docker command: {}", e);
                        connection.status = ConnectionStatus::Failed(e.to_string());
                        Err(RegistryError::ConnectionFailed(e.to_string()))
                    }
                }
            }
            DeploymentConfig::Process { command, args } => {
                info!("Starting process for MCP server: {}", server_id);

                let mut cmd = Command::new(command);
                cmd.args(args)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());

                for (key, value) in env_vars {
                    cmd.env(key, value);
                }

                match cmd.spawn() {
                    Ok(child) => {
                        connection.process = Some(child);
                        connection.status = ConnectionStatus::Connected;

                        // Initialize the connection
                        self.initialize_mcp_connection(&key).await?;

                        // Fetch available tools
                        self.fetch_server_tools(&key).await?;

                        info!("Successfully connected to MCP server: {}", server_id);
                        Ok(())
                    }
                    Err(e) => {
                        error!("Failed to spawn MCP server process: {}", e);
                        connection.status = ConnectionStatus::Failed(e.to_string());
                        Err(RegistryError::ConnectionFailed(e.to_string()))
                    }
                }
            }
            DeploymentConfig::Lambda {
                function_name,
                region,
            } => {
                info!(
                    "Connecting to Lambda function {} in region {}",
                    function_name, region
                );

                // For Lambda, we just store the endpoint
                connection.endpoint = Some(format!("lambda://{}:{}", region, function_name));
                connection.status = ConnectionStatus::Connected;

                // Initialize the connection
                self.initialize_mcp_connection(&key).await?;

                // Fetch available tools
                self.fetch_server_tools(&key).await?;

                Ok(())
            }
        }
    }

    pub async fn disconnect_server(
        &self,
        tenant_id: &str,
        server_id: &str,
    ) -> Result<(), RegistryError> {
        let key = format!("{}-{}", tenant_id, server_id);

        let mut servers = self.servers.write().await;
        if let Some(connection) = servers.get_mut(&key) {
            // Handle process termination
            if let Some(mut process) = connection.process.take() {
                match process.kill().await {
                    Ok(_) => info!("MCP server process {} terminated", server_id),
                    Err(e) => warn!("Failed to kill MCP server process: {}", e),
                }
            }

            // Handle Docker container termination
            if let Some(_container_id) = &connection.container_id {
                let container_name = format!("mcp-{}-{}", tenant_id, server_id);
                let mut docker_cmd = Command::new("docker");
                docker_cmd.arg("stop").arg(&container_name);

                match docker_cmd.output().await {
                    Ok(output) => {
                        if output.status.success() {
                            info!("Docker container {} stopped", container_name);
                        } else {
                            warn!(
                                "Failed to stop Docker container: {}",
                                String::from_utf8_lossy(&output.stderr)
                            );
                        }
                    }
                    Err(e) => warn!("Failed to execute docker stop: {}", e),
                }

                connection.container_id = None;
            }

            connection.status = ConnectionStatus::Disconnected;
            connection.endpoint = None;
            connection.tools.clear();
        }

        Ok(())
    }

    pub async fn list_servers(&self, tenant_id: &str) -> Result<Vec<MCPServerInfo>, RegistryError> {
        let servers = self.servers.read().await;
        let mut result = Vec::new();

        for (key, connection) in servers.iter() {
            if key.starts_with(&format!("{}-", tenant_id)) {
                result.push(MCPServerInfo {
                    id: connection.config.id.clone(),
                    name: connection.config.name.clone(),
                    description: connection.config.description.clone(),
                    status: format!("{:?}", connection.status),
                    tool_count: connection.tools.len(),
                });
            }
        }

        Ok(result)
    }

    pub async fn execute_tool(
        &self,
        tenant_id: &str,
        server_id: &str,
        tool_name: &str,
        arguments: Value,
    ) -> Result<Value, RegistryError> {
        let key = format!("{}-{}", tenant_id, server_id);

        let servers = self.servers.read().await;
        let connection = servers
            .get(&key)
            .ok_or_else(|| RegistryError::ServerNotFound(server_id.to_string()))?;

        if connection.status != ConnectionStatus::Connected {
            return Err(RegistryError::ServerNotConnected(server_id.to_string()));
        }

        // Check if tool exists
        let tool_exists = connection.tools.iter().any(|t| t.name == tool_name);
        if !tool_exists {
            return Err(RegistryError::ToolNotFound(tool_name.to_string()));
        }

        // Execute tool via stdio
        if let Some(process) = &connection.process {
            self.execute_stdio_tool(process, tool_name, arguments).await
        } else {
            Err(RegistryError::ServerNotConnected(server_id.to_string()))
        }
    }

    async fn initialize_mcp_connection(&self, key: &str) -> Result<(), RegistryError> {
        let servers = self.servers.read().await;
        let connection = servers
            .get(key)
            .ok_or_else(|| RegistryError::ServerNotFound(key.to_string()))?;

        if let Some(_process) = &connection.process {
            let _request = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {
                        "tools": {}
                    }
                }
            });

            // Send initialization request via stdin
            // Implementation would handle stdio communication
            debug!("Sent initialization request to MCP server");
        }

        Ok(())
    }

    async fn fetch_server_tools(&self, key: &str) -> Result<(), RegistryError> {
        let mut servers = self.servers.write().await;
        let connection = servers
            .get_mut(key)
            .ok_or_else(|| RegistryError::ServerNotFound(key.to_string()))?;

        if let Some(_process) = &connection.process {
            let _request = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            });

            // TODO: Send tool list request and parse response
            // This would be implemented with proper stdio handling per MCP spec
            debug!("Fetching tools from MCP server");

            // For now, return empty tools
            connection.tools = Vec::new();
        }

        Ok(())
    }

    async fn execute_stdio_tool(
        &self,
        _process: &Child,
        tool_name: &str,
        arguments: Value,
    ) -> Result<Value, RegistryError> {
        let _request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        });

        // TODO: Send request via stdin and read response from stdout
        // This would be implemented with proper stdio handling per MCP spec
        debug!("Executing tool {} via stdio", tool_name);

        Ok(serde_json::json!({
            "success": true,
            "result": "Tool execution placeholder"
        }))
    }

    async fn store_server_config(
        &self,
        tenant_id: &str,
        config: &MCPServerConfig,
    ) -> Result<(), RegistryError> {
        let key = format!("mcp-registry-{}-{}", tenant_id, config.id);
        let value = serde_json::to_string(config)
            .map_err(|e| RegistryError::SerializationError(e.to_string()))?;

        self.aws_service
            .kv_set_direct(&key, &value, Some(24 * 30)) // 30 days TTL
            .await
            .map_err(|e| RegistryError::StorageError(e.to_string()))?;

        Ok(())
    }

    async fn get_credential(
        &self,
        tenant_id: &str,
        server_id: &str,
        credential_name: &str,
    ) -> Result<Option<String>, RegistryError> {
        let key = format!(
            "mcp-credential-{}-{}-{}",
            tenant_id, server_id, credential_name
        );

        match self.aws_service.kv_get_direct(&key).await {
            Ok(value) => Ok(value),
            Err(e) => {
                debug!("No credential found for {}: {}", key, e);
                Ok(None)
            }
        }
    }

    #[allow(dead_code)]
    pub async fn health_check(&self) {
        let mut servers = self.servers.write().await;

        for (key, connection) in servers.iter_mut() {
            if connection.status == ConnectionStatus::Connected {
                let elapsed = connection.last_health_check.elapsed();

                if elapsed.as_secs() >= connection.config.health_check_interval_secs {
                    debug!("Health check for server: {}", key);

                    // Check if process is still running
                    if let Some(process) = &mut connection.process {
                        match process.try_wait() {
                            Ok(Some(status)) => {
                                warn!("MCP server {} exited with status: {}", key, status);
                                connection.status =
                                    ConnectionStatus::Failed(format!("Process exited: {}", status));
                                connection.process = None;
                            }
                            Ok(None) => {
                                // Process is still running
                                connection.last_health_check = std::time::Instant::now();
                            }
                            Err(e) => {
                                error!("Failed to check process status: {}", e);
                            }
                        }
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub tool_count: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    #[error("Server not found: {0}")]
    ServerNotFound(String),
    #[error("Server not connected: {0}")]
    ServerNotConnected(String),
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Unsupported server type: {0}")]
    UnsupportedServerType(String),
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}
