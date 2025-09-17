import MCPStdioService from './MCPStdioService.js';
import MCPBridgeService from './MCPBridgeService.js';
import { Logger } from '../utils/Logger.js';

export interface IMCPService {
  executeTool(name: string, args: Record<string, any>, authContext?: any): Promise<any>;
  listTools(authContext?: any): Promise<any>;
  getHealth?(): Promise<{ status: string; timestamp: string }>;
  cleanup(): Promise<void> | void;
}

/**
 * Factory for creating the appropriate MCP service based on environment
 * - Local development: Uses stdio for security and speed
 * - Production: Uses EventBridge for authentication and scaling
 */
export class MCPServiceFactory {
  private static instance: IMCPService | null = null;
  private static logger = new Logger('MCPServiceFactory');

  /**
   * Get the appropriate MCP service instance
   */
  static getInstance(): IMCPService {
    if (!this.instance) {
      this.instance = this.createService();
    }
    return this.instance;
  }

  /**
   * Create the appropriate service based on environment
   */
  private static createService(): IMCPService {
    const useEventBridge = process.env.NODE_ENV === 'production' ||
                          process.env.MCP_TRANSPORT === 'eventbridge';

    if (useEventBridge) {
      this.logger.info('Creating EventBridge MCP service for production');
      return new EventBridgeMCPAdapter();
    } else {
      this.logger.info('Creating stdio MCP service for local development');
      return new StdioMCPAdapter();
    }
  }

  /**
   * Reset instance (for testing or configuration changes)
   */
  static reset(): void {
    if (this.instance) {
      this.instance.cleanup();
      this.instance = null;
    }
  }
}

/**
 * Adapter for stdio MCP service to match the common interface
 */
class StdioMCPAdapter implements IMCPService {
  private stdioService: MCPStdioService;

  constructor() {
    this.stdioService = new MCPStdioService();
  }

  async executeTool(name: string, args: Record<string, any> = {}): Promise<any> {
    return this.stdioService.executeTool(name, args);
  }

  async listTools(): Promise<any> {
    const tools = await this.stdioService.listTools();
    return { tools }; // Wrap in object for consistency with EventBridge format
  }

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.stdioService.getHealth();
  }

  async cleanup(): Promise<void> {
    return this.stdioService.cleanup();
  }
}

/**
 * Adapter for EventBridge MCP service to match the common interface
 */
class EventBridgeMCPAdapter implements IMCPService {
  private bridgeService: MCPBridgeService;

  constructor() {
    this.bridgeService = new MCPBridgeService();
  }

  async executeTool(name: string, args: Record<string, any> = {}, authContext?: any): Promise<any> {
    const auth = authContext || this.bridgeService.createDemoAuthContext();
    return this.bridgeService.executeTool(name, args, auth);
  }

  async listTools(authContext?: any): Promise<any> {
    const auth = authContext || this.bridgeService.createDemoAuthContext();
    return this.bridgeService.listTools(auth);
  }

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    // EventBridge service doesn't have direct health check
    // Check if we can create auth context and send events
    try {
      this.bridgeService.createDemoAuthContext();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }

  cleanup(): void {
    return this.bridgeService.cleanup();
  }
}

export default MCPServiceFactory;