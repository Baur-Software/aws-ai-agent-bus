use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::handlers::{Handler, HandlerError};
use crate::registry::{MCPServerRegistry, MCPTool};
use crate::tenant::{Permission, TenantSession};

pub struct MCPProxyHandler {
    registry: Arc<MCPServerRegistry>,
}

impl MCPProxyHandler {
    pub fn new(registry: Arc<MCPServerRegistry>) -> Self {
        Self { registry }
    }

    async fn find_server_for_tool(
        &self,
        tenant_id: &str,
        tool_name: &str,
    ) -> Result<String, HandlerError> {
        // Parse tool name format: "server_id.tool_name" or just "tool_name"
        if let Some(dot_pos) = tool_name.find('.') {
            let server_id = &tool_name[..dot_pos];
            return Ok(server_id.to_string());
        }

        // Search through all registered servers to find the tool
        let servers = self.registry.list_servers(tenant_id).await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // For now, we'll need to enhance the registry to expose tool listings
        // This is a simplified version
        for server in servers {
            // Try to execute on this server and see if it has the tool
            // In production, we'd cache this mapping
            return Ok(server.id);
        }

        Err(HandlerError::Internal(format!("No server found for tool: {}", tool_name)))
    }
}

#[async_trait]
impl Handler for MCPProxyHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: MCPProxyArgs = serde_json::from_value(arguments)
            .map_err(|e| HandlerError::InvalidArguments(e.to_string()))?;

        info!(
            "Proxying MCP tool call '{}' for tenant {}",
            args.tool_name, session.context.get_context_id()
        );

        // Find the server that handles this tool
        let server_id = self.find_server_for_tool(&session.context.get_context_id(), &args.tool_name).await?;

        // Execute the tool on the target server
        let result = self.registry
            .execute_tool(
                &session.context.get_context_id(),
                &server_id,
                &args.tool_name,
                args.arguments,
            )
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        Ok(result)
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Execute)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "Execute a tool on a registered MCP server",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "Name of the tool (optionally prefixed with server_id.)"
                    },
                    "arguments": {
                        "type": "object",
                        "description": "Arguments to pass to the tool"
                    }
                },
                "required": ["tool_name"]
            }
        })
    }
}

#[derive(Debug, Deserialize)]
struct MCPProxyArgs {
    tool_name: String,
    arguments: Value,
}

pub struct MCPListToolsHandler {
    registry: Arc<MCPServerRegistry>,
}

impl MCPListToolsHandler {
    pub fn new(registry: Arc<MCPServerRegistry>) -> Self {
        Self { registry }
    }
}

#[async_trait]
impl Handler for MCPListToolsHandler {
    async fn handle(
        &self,
        session: &TenantSession,
        arguments: Value,
    ) -> Result<Value, HandlerError> {
        let args: Option<MCPListToolsArgs> = serde_json::from_value(arguments).ok();

        debug!("Listing MCP tools for tenant {}", session.context.get_context_id());

        let servers = self.registry
            .list_servers(&session.context.get_context_id())
            .await
            .map_err(|e| HandlerError::Internal(e.to_string()))?;

        // If specific server requested, filter to just that server
        let filtered_servers = if let Some(args) = args {
            if let Some(server_id) = args.server_id {
                servers.into_iter()
                    .filter(|s| s.id == server_id)
                    .collect()
            } else {
                servers
            }
        } else {
            servers
        };

        // Build tool list with server prefixes
        let mut all_tools = Vec::new();
        for server in filtered_servers {
            // For each server, we'd fetch its tools
            // This is simplified - in production we'd get actual tools from the registry
            let tools = vec![
                MCPToolInfo {
                    name: format!("{}.example_tool", server.id),
                    description: format!("Example tool from {}", server.name),
                    server_id: server.id.clone(),
                    server_name: server.name.clone(),
                },
            ];

            all_tools.extend(tools);
        }

        Ok(serde_json::json!({
            "tools": all_tools
        }))
    }

    fn required_permission(&self) -> Option<Permission> {
        Some(Permission::Read)
    }

    fn tool_schema(&self) -> Value {
        serde_json::json!({
            "description": "List available tools from registered MCP servers",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "server_id": {
                        "type": "string",
                        "description": "Optional: filter tools to specific server"
                    }
                }
            }
        })
    }
}

#[derive(Debug, Deserialize)]
struct MCPListToolsArgs {
    server_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct MCPToolInfo {
    name: String,
    description: String,
    server_id: String,
    server_name: String,
}