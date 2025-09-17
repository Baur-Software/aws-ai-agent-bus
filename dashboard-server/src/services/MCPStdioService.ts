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

/**
 * Local development MCP service using stdio transport
 * More secure and faster than EventBridge for local dev
 */
export class MCPStdioService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcess | null = null;
  private logger: Logger;
  private connected = false;

  constructor() {
    this.logger = new Logger('MCPStdioService');
  }

  /**
   * Connect to MCP server via stdio
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Get ES module equivalent of __dirname
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Path to MCP server relative to dashboard-server
      const mcpServerPath = path.resolve(__dirname, '../../../mcp-server');
      const serverScript = path.join(mcpServerPath, 'src/server.js');

      this.logger.info(`Starting MCP server at: ${serverScript}`);

      // Spawn the MCP server process
      this.process = spawn('node', [serverScript], {
        cwd: mcpServerPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      });

      if (!this.process.stdin || !this.process.stdout) {
        throw new Error('Failed to create MCP server process with stdio');
      }

      // Create stdio transport
      this.transport = new StdioClientTransport({
        stdin: this.process.stdin,
        stdout: this.process.stdout
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

      // Handle process errors
      this.process.on('error', (error) => {
        this.logger.error('MCP server process error:', error);
        this.connected = false;
      });

      this.process.on('exit', (code, signal) => {
        this.logger.warn(`MCP server process exited with code ${code}, signal ${signal}`);
        this.connected = false;
      });

      // Handle stderr for debugging
      this.process.stderr?.on('data', (data) => {
        this.logger.debug('MCP server stderr:', data.toString());
      });

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

    if (this.process) {
      this.process.kill();
      this.process = null;
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
      if (result.content && result.content.length > 0) {
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
      return result.tools;
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