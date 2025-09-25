use std::sync::Arc;
use tracing::info;

mod aws;
mod handlers;
mod mcp;
mod tenant;

use mcp::MCPServer;
use tenant::TenantManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("Starting Multi-Tenant MCP Rust Server");

    // Create tenant manager
    let tenant_manager = Arc::new(TenantManager::new().await?);

    // Create MCP server with tenant isolation
    let server = MCPServer::new(tenant_manager).await?;

    // Start the server
    server.run().await?;

    Ok(())
}