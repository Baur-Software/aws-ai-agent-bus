use std::sync::Arc;
use tracing::info;

mod aws;
mod handlers;
mod mcp;
mod rate_limiting;
mod registry;
mod tenant;

use mcp::MCPServer;
use tenant::TenantManager;

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing to stderr (stdout must be reserved for JSON-RPC)
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_ansi(false) // Disable ANSI color codes
        .init();

    info!("Starting Multi-Tenant MCP Rust Server");

    // Create tenant manager
    let tenant_manager = Arc::new(TenantManager::new().await?);

    // Create MCP server with tenant isolation
    let server = MCPServer::new(tenant_manager.clone()).await?;

    // Start the server - this will block until stdin closes or error occurs
    let result = server.run().await;

    // Graceful shutdown
    eprintln!("[MCP Server] Shutting down gracefully...");

    // Give background tasks a moment to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    eprintln!("[MCP Server] Shutdown complete");

    // Explicitly exit to ensure clean shutdown
    std::process::exit(if result.is_ok() { 0 } else { 1 });
}
