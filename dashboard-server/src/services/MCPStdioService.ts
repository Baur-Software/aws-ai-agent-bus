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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private config: MCPServerConfig | null = null;
  private circuitBreakerFailures = 0;
  private maxCircuitBreakerFailures = 3; // Reduced from 5 - fail faster for broken servers
  private circuitBreakerResetTime = 300000; // 5 minutes instead of 1 - broken servers need more time
  private circuitBreakerOpenUntil = 0;
  private permanentlyDisabled = false;

  constructor() {
    this.logger = new Logger('MCPStdioService');

    // Check for environment variable to disable MCP completely
    if (process.env.DISABLE_MCP === 'true') {
      this.logger.info('MCP service disabled via environment variable');
      this.permanentlyDisabled = true;
    }
  }

  /**
   * Connect to MCP server via stdio
   */
  async connect(config?: MCPServerConfig): Promise<void> {
    if (this.connected) {
      return;
    }

    // Store config for reconnection
    if (config) {
      this.config = config;
    }

    const effectiveConfig = this.config || config;

    try {
      let command: string;
      let args: string[];
      let cwd: string;
      let env: Record<string, string>;

      if (effectiveConfig) {
        // Use provided configuration
        command = effectiveConfig.command;
        args = effectiveConfig.args;
        cwd = effectiveConfig.cwd || process.cwd();
        env = { ...process.env, ...effectiveConfig.env };
      } else {
        // Default configuration (original MCP server)
        const projectRoot = process.cwd();
        const mcpServerPath = path.resolve(projectRoot, '../mcp-server');
        const serverScript = path.join(mcpServerPath, 'src/server.js');

        command = 'node';
        args = [serverScript];
        cwd = mcpServerPath;
        env = { ...process.env, NODE_ENV: 'development' };

        // Store default config for reconnection
        this.config = { command, args, cwd, env };
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

      // Set up connection event handlers
      this.setupConnectionHandlers();

      // Connect client to transport
      await this.client.connect(this.transport);

      // Check if permanent disable was triggered during connection
      if (this.permanentlyDisabled) {
        this.connected = false;
        throw new Error('MCP service permanently disabled due to critical server failures during connection');
      }

      this.connected = true;
      this.reconnectAttempts = 0; // Reset on successful connection

      this.logger.info('Successfully connected to MCP server via stdio');
    } catch (error) {
      this.logger.error('Failed to connect to MCP server:', error);
      await this.disconnect();

      // Attempt reconnection if we haven't exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (this.transport) {
      // Monitor transport for disconnections
      this.transport.onclose = () => {
        this.logger.warn('MCP transport closed unexpectedly');
        this.connected = false;
        if (!this.permanentlyDisabled) {
          this.scheduleReconnect();
        }
      };

      this.transport.onerror = (error: any) => {
        this.logger.error('MCP transport error:', error);
        this.connected = false;

        // Check for critical errors
        const errorStr = error?.toString() || '';
        if (errorStr.includes('JSON Parse error') ||
            errorStr.includes('ZodError') ||
            errorStr.includes('invalid_union') ||
            errorStr.includes('deserializeMessage')) {
          this.logger.error('Critical MCP transport error detected - permanently disabling service');
          this.permanentlyDisabled = true;
        } else if (!this.permanentlyDisabled) {
          this.scheduleReconnect();
        }
      };
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.permanentlyDisabled) {
      this.logger.info('MCP service permanently disabled - skipping reconnection');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    this.logger.info(`Scheduling MCP reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.logger.warn(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      }
    }, delay);
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.connected = false;

    // Clear any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
    // Check if permanently disabled due to fundamental issues
    if (this.permanentlyDisabled) {
      throw new Error('MCP service permanently disabled due to critical failures (malformed JSON/schema violations)');
    }

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error('MCP service circuit breaker is open - too many recent failures');
    }

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.client || !this.connected) {
          await this.connect();
        }

        if (!this.client) {
          throw new Error('MCP client not available');
        }

        // Add timeout to tool calls
        const timeoutMs = 15000; // 15 second timeout
        const result = await Promise.race([
          this.client.callTool({
            name,
            arguments: args
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`MCP tool call '${name}' timed out after ${timeoutMs}ms`)), timeoutMs)
          )
        ]) as any;

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

        // Reset circuit breaker on success
        this.circuitBreakerFailures = 0;
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Error executing tool '${name}' (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

        // Check for critical errors that indicate fundamentally broken server
        if (error.message?.includes('JSON Parse error') ||
            error.message?.includes('ZodError') ||
            error.message?.includes('invalid_union') ||
            error.message?.includes('deserializeMessage')) {
          this.logger.error('Critical MCP server error detected - permanently disabling service');
          this.permanentlyDisabled = true;
          throw new Error('MCP service permanently disabled due to critical server failures');
        }

        // If this is a connection error, mark as disconnected and try to reconnect
        if (error.message?.includes('Connection closed') || error.message?.includes('EPIPE')) {
          this.connected = false;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
        }

        // If this is our last attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    this.logger.error(`Failed to execute tool '${name}' after ${maxRetries + 1} attempts:`, lastError);
    this.recordCircuitBreakerFailure();
    throw lastError;
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<MCPTool[]> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.client || !this.connected) {
          await this.connect();
        }

        if (!this.client) {
          throw new Error('MCP client not available');
        }

        const result = await this.client.listTools();
        return result.tools as MCPTool[];
      } catch (error) {
        lastError = error;
        this.logger.warn(`Error listing tools (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

        // If this is a connection error, mark as disconnected and try to reconnect
        if (error.message?.includes('Connection closed') || error.message?.includes('EPIPE')) {
          this.connected = false;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
        }

        // If this is our last attempt, throw the error
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    this.logger.error(`Failed to list tools after ${maxRetries + 1} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Check if connected to MCP server
   */
  isConnected(): boolean {
    return this.connected && !this.permanentlyDisabled;
  }

  /**
   * Get service status
   */
  getServiceStatus(): { status: string; reason?: string; failures: number } {
    if (this.permanentlyDisabled) {
      return {
        status: 'permanently_disabled',
        reason: 'Critical server errors detected',
        failures: this.circuitBreakerFailures
      };
    }

    if (this.isCircuitBreakerOpen()) {
      return {
        status: 'circuit_breaker_open',
        reason: 'Too many recent failures',
        failures: this.circuitBreakerFailures
      };
    }

    if (this.connected) {
      return {
        status: 'connected',
        failures: this.circuitBreakerFailures
      };
    }

    return {
      status: 'disconnected',
      failures: this.circuitBreakerFailures
    };
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
   * Circuit breaker methods
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerOpenUntil > Date.now()) {
      return true;
    }

    // Reset if enough time has passed
    if (this.circuitBreakerFailures >= this.maxCircuitBreakerFailures &&
        this.circuitBreakerOpenUntil <= Date.now()) {
      this.circuitBreakerFailures = 0;
      this.logger.info('Circuit breaker reset - attempting MCP operations again');
    }

    return false;
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;

    if (this.circuitBreakerFailures >= this.maxCircuitBreakerFailures) {
      this.circuitBreakerOpenUntil = Date.now() + this.circuitBreakerResetTime;
      this.logger.warn(`Circuit breaker opened after ${this.circuitBreakerFailures} failures. Will retry in ${this.circuitBreakerResetTime}ms`);
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