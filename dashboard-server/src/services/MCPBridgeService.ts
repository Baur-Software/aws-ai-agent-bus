import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '../utils/Logger.js';

export interface MCPToolCall {
  userId: string;
  sessionId: string;
  toolName: string;
  arguments: Record<string, any>;
  timestamp: string;
  requestId: string;
}

export interface MCPToolResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: string;
}

export interface AuthContext {
  userId: string;
  sessionId: string;
  permissions: string[];
  authenticated: boolean;
}

/**
 * Service for communicating with MCP server via EventBridge
 * Provides authentication and event-driven MCP tool execution
 */
export class MCPBridgeService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    this.eventBridge = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-west-2'
    });
    this.logger = new Logger('MCPBridgeService');
  }

  /**
   * Execute an MCP tool with authentication
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    authContext: AuthContext
  ): Promise<any> {
    // Validate authentication
    if (!authContext.authenticated) {
      throw new Error('Authentication required for MCP tool access');
    }

    // Validate permissions (simplified for now)
    if (!this.hasPermission(authContext, toolName)) {
      throw new Error(`Insufficient permissions for tool: ${toolName}`);
    }

    const requestId = this.generateRequestId();
    const toolCall: MCPToolCall = {
      userId: authContext.userId,
      sessionId: authContext.sessionId,
      toolName,
      arguments: args,
      timestamp: new Date().toISOString(),
      requestId
    };

    // Send authentication event first
    await this.sendAuthEvent(authContext, toolName);

    // Send tool execution event
    await this.sendToolExecutionEvent(toolCall);

    // Wait for response (implement timeout)
    return this.waitForResponse(requestId);
  }

  /**
   * List available MCP tools
   */
  async listTools(authContext: AuthContext): Promise<any> {
    if (!authContext.authenticated) {
      throw new Error('Authentication required for MCP tool listing');
    }

    const requestId = this.generateRequestId();

    await this.eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'dashboard-server',
        DetailType: 'MCP.ListTools',
        Detail: JSON.stringify({
          requestId,
          userId: authContext.userId,
          sessionId: authContext.sessionId,
          timestamp: new Date().toISOString()
        }),
        EventBusName: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
      }]
    }));

    return this.waitForResponse(requestId);
  }

  /**
   * Send authentication event for audit trail
   */
  private async sendAuthEvent(authContext: AuthContext, toolName: string): Promise<void> {
    try {
      await this.eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'dashboard-server',
          DetailType: 'Auth.ToolAccess',
          Detail: JSON.stringify({
            userId: authContext.userId,
            sessionId: authContext.sessionId,
            toolName,
            permissions: authContext.permissions,
            timestamp: new Date().toISOString(),
            action: 'tool-execution-request'
          }),
          EventBusName: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
        }]
      }));
    } catch (error) {
      this.logger.warn('Failed to send auth event:', error);
      // Don't fail tool execution if audit logging fails
    }
  }

  /**
   * Send tool execution event to MCP server
   */
  private async sendToolExecutionEvent(toolCall: MCPToolCall): Promise<void> {
    await this.eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'dashboard-server',
        DetailType: 'MCP.ExecuteTool',
        Detail: JSON.stringify(toolCall),
        EventBusName: process.env.AGENT_MESH_EVENT_BUS || 'agent-mesh-events'
      }]
    }));
  }

  /**
   * Wait for MCP server response
   */
  private async waitForResponse(requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('MCP tool execution timeout'));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });
    });
  }

  /**
   * Handle response from MCP server (called by event listener)
   */
  public handleResponse(response: MCPToolResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      this.logger.warn(`Received response for unknown request: ${response.requestId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'MCP tool execution failed'));
    }
  }

  /**
   * Check if user has permission for specific tool
   */
  private hasPermission(authContext: AuthContext, toolName: string): boolean {
    // Simplified permission check - in production this would be more sophisticated
    if (authContext.permissions.includes('mcp:*')) {
      return true;
    }

    const toolCategory = toolName.split('.')[0]; // e.g., 'kv' from 'kv.get'
    return authContext.permissions.includes(`mcp:${toolCategory}:*`) ||
           authContext.permissions.includes(`mcp:${toolName}`);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create authenticated context for demo purposes
   */
  public createDemoAuthContext(userId: string = 'demo-user'): AuthContext {
    return {
      userId,
      sessionId: `session_${Date.now()}`,
      permissions: ['mcp:*'], // Full permissions for demo
      authenticated: true
    };
  }

  /**
   * Clean up pending requests on shutdown
   */
  public cleanup(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Service shutting down'));
    }
    this.pendingRequests.clear();
  }
}

export default MCPBridgeService;