/**
 * Integration Node Definitions
 *
 * NOTE: Third-party service integrations (Slack, Google Sheets, GitHub, etc.)
 * require external MCP servers. These nodes have been removed as they are not
 * backed by the core MCP server implementation.
 *
 * To use third-party integrations:
 * 1. Install the relevant MCP server (e.g., @modelcontextprotocol/server-slack)
 * 2. Configure it in mcp_servers.json
 * 3. Use the MCP Proxy node to call tools from external servers
 *
 * Core integration management tools are available via MCP:
 * - integration_register: Register a new integration
 * - integration_connect: Connect to an integration (OAuth flow)
 * - integration_list: List available integrations
 * - integration_disconnect: Disconnect from an integration
 * - integration_test: Test integration connection
 */

import type { NodeDefinition } from '../NodeRegistry';

export const INTEGRATION_NODES: NodeDefinition[] = [
  // No direct integration nodes - use MCP Proxy for external MCP servers
];
