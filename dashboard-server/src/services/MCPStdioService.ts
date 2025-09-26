import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Logger } from '../utils/Logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Local development MCP service using stdio transport
 * More secure and faster than EventBridge for local dev
 */
export class MCPStdioService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private logger: Logger;
  private connected = false;

  constructor() {
    this.logger = new Logger('MCPStdioService');
  }

  /**
   * Connect to MCP server via stdio
   */
  async connect(config?: MCPServerConfig): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      let command: string;
      let args: string[];
      let cwd: string;
      let env: Record<string, string>;

      if (config) {
        // Use provided configuration
        command = config.command;
        args = config.args;
        cwd = config.cwd || process.cwd();
        env = { ...process.env, ...config.env };
      } else {
        // Default configuration (original MCP server)
        const projectRoot = process.cwd();
        const mcpServerPath = path.resolve(projectRoot, '../mcp-server');
        const serverScript = path.join(mcpServerPath, 'src/server.js');

        command = 'node';
        args = [serverScript];
        cwd = mcpServerPath;
        env = { ...process.env, NODE_ENV: 'development' };
      }

      this.logger.info(`Starting MCP server: ${command} ${args.join(' ')}`);
      this.logger.info(`Working directory: ${cwd}`);

      // Create stdio transport - let the SDK handle process spawning
      this.transport = new StdioClientTransport({
        command,
        args,
        env
      });

      // Create MCP client
      this.client = new Client(
        {
          name: 'dashboard-server',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // The SDK will handle process management

      // Connect client to transport
      await this.client.connect(this.transport);
      this.connected = true;

      this.logger.info('Successfully connected to MCP server via stdio');
    } catch (error) {
      this.logger.error('Failed to connect to MCP server:', error);
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.connected = false;

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        this.logger.warn('Error closing MCP client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        this.logger.warn('Error closing MCP transport:', error);
      }
      this.transport = null;
    }

    this.logger.info('Disconnected from MCP server');
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('MCP client not available');
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });

      // Extract result from MCP response format
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0];
        if (content.type === 'text') {
          try {
            return JSON.parse(content.text);
          } catch {
            return content.text;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error executing tool '${name}':`, error);
      throw error;
    }
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('MCP client not available');
    }

    try {
      const result = await this.client.listTools();
      return result.tools as MCPTool[];
    } catch (error) {
      this.logger.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    const isHealthy = this.connected || await this.testConnection();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test connection by attempting to list tools
   */
  private async testConnection(): Promise<boolean> {
    try {
      await this.listTools();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async cleanup(): Promise<void> {
    await this.disconnect();
  }
}

export default MCPStdioService;