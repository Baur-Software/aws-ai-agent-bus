import { MCPServerConfig } from '../services/MCPStdioService.js';

/**
 * Configuration for all registered MCP servers
 */
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  aws: {
    command: '../mcp-rust/target/release/mcp-multi-tenant.exe',
    args: [],
    env: {
      AWS_REGION: process.env.AWS_REGION || 'us-west-2',
      AWS_PROFILE: process.env.AWS_PROFILE,
      AGENT_MESH_KV_TABLE: process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-kv',
      AGENT_MESH_ARTIFACTS_BUCKET: process.env.AGENT_MESH_ARTIFACTS_BUCKET || 'agent-mesh-artifacts',
      AGENT_MESH_EVENT_BUS: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
    }
  },

  // Original JavaScript MCP server (for comparison/fallback)
  'aws-js': {
    command: 'node',
    args: ['src/server.js'],
    cwd: '../mcp-server',
    env: {
      NODE_ENV: 'development',
      AWS_REGION: process.env.AWS_REGION || 'us-west-2'
    }
  }

  // Future MCP servers can be added here:
  // github: {
  //   command: 'github-mcp',
  //   args: [],
  //   env: {
  //     GITHUB_TOKEN: process.env.GITHUB_TOKEN
  //   }
  // },
  //
  // slack: {
  //   command: 'slack-mcp',
  //   args: [],
  //   env: {
  //     SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN
  //   }
  // }
};

/**
 * Default MCP servers to register on startup
 */
export const DEFAULT_MCP_SERVERS = ['aws']; // Test Rust server with fixed path issues

/**
 * Get MCP server configuration by name
 */
export function getMCPServerConfig(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS[name];
}

/**
 * List all available MCP server names
 */
export function listMCPServers(): string[] {
  return Object.keys(MCP_SERVERS);
}