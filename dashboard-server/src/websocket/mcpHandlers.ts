import { WebSocket } from 'ws';
import { mcpMarketplace, MCPServerListing } from '../services/MCPMarketplace';
import { KVHandler } from '../handlers/kv';
import { EventsHandler } from '../handlers/events';
import * as crypto from 'crypto';

export interface MCPMessage {
  type: string;
  requestId?: string;
  payload: any;
  userId?: string;
  orgId?: string;
}

export const MCP_MESSAGE_TYPES = {
  // Client requests
  DISCOVER_MCP_SERVERS: 'mcp:discover_servers',
  SEARCH_MCP_SERVERS: 'mcp:search_servers',
  GET_FEATURED_SERVERS: 'mcp:get_featured_servers',
  GET_POPULAR_SERVERS: 'mcp:get_popular_servers',
  CONNECT_INTEGRATION: 'mcp:connect_integration',
  LIST_TENANT_MCPS: 'mcp:list_tenant_mcps',
  DISCONNECT_INTEGRATION: 'mcp:disconnect_integration',

  // Server responses
  MCP_SERVERS_DISCOVERED: 'mcp:servers_discovered',
  MCP_SERVERS_SEARCHED: 'mcp:servers_searched',
  FEATURED_SERVERS: 'mcp:featured_servers',
  POPULAR_SERVERS: 'mcp:popular_servers',
  INTEGRATION_CONNECTED: 'mcp:integration_connected',
  TENANT_MCPS_LISTED: 'mcp:tenant_mcps_listed',
  INTEGRATION_DISCONNECTED: 'mcp:integration_disconnected',
  MCP_ERROR: 'mcp:error'
};

export class MCPWebSocketHandler {
  private encryptionKey: Buffer;

  constructor(private ws: WebSocket) {
    // Use environment encryption key or fail in production
    const keyString = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!keyString && process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY must be set in production');
    }
    // In development, use a default key (still not secure, but better than plaintext)
    this.encryptionKey = crypto.scryptSync(
      keyString || 'dev-only-change-in-production',
      'mcp-credentials-salt',
      32
    );
  }

  async handleMessage(message: MCPMessage): Promise<void> {
    try {
      switch (message.type) {
        case MCP_MESSAGE_TYPES.DISCOVER_MCP_SERVERS:
          await this.handleDiscoverServers(message);
          break;

        case MCP_MESSAGE_TYPES.SEARCH_MCP_SERVERS:
          await this.handleSearchServers(message);
          break;

        case MCP_MESSAGE_TYPES.GET_FEATURED_SERVERS:
          await this.handleGetFeaturedServers(message);
          break;

        case MCP_MESSAGE_TYPES.GET_POPULAR_SERVERS:
          await this.handleGetPopularServers(message);
          break;

        case MCP_MESSAGE_TYPES.CONNECT_INTEGRATION:
          await this.handleConnectIntegration(message);
          break;

        case MCP_MESSAGE_TYPES.LIST_TENANT_MCPS:
          await this.handleListTenantMCPs(message);
          break;

        case MCP_MESSAGE_TYPES.DISCONNECT_INTEGRATION:
          await this.handleDisconnectIntegration(message);
          break;

        default:
          this.sendError(message.requestId, `Unknown MCP message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling MCP message:', error);
      this.sendError(message.requestId, error.message);
    }
  }

  private async handleDiscoverServers(message: MCPMessage): Promise<void> {
    const { integration } = message.payload;
    const servers = await mcpMarketplace.searchServers(integration);

    this.sendResponse(MCP_MESSAGE_TYPES.MCP_SERVERS_DISCOVERED, message.requestId, {
      integration,
      servers
    });
  }

  private async handleSearchServers(message: MCPMessage): Promise<void> {
    const { query } = message.payload;
    const servers = await mcpMarketplace.searchServers(query);

    this.sendResponse(MCP_MESSAGE_TYPES.MCP_SERVERS_SEARCHED, message.requestId, {
      query,
      servers
    });
  }

  private async handleGetFeaturedServers(message: MCPMessage): Promise<void> {
    const servers = await mcpMarketplace.getFeaturedServers();

    this.sendResponse(MCP_MESSAGE_TYPES.FEATURED_SERVERS, message.requestId, {
      servers
    });
  }

  private async handleGetPopularServers(message: MCPMessage): Promise<void> {
    const servers = await mcpMarketplace.getPopularServers();

    this.sendResponse(MCP_MESSAGE_TYPES.POPULAR_SERVERS, message.requestId, {
      servers
    });
  }

  private async handleConnectIntegration(message: MCPMessage): Promise<void> {
    const { integration, connectionName, serverConfig, credentials } = message.payload;
    const { userId, orgId } = message;

    if (!userId || !orgId) {
      this.sendError(message.requestId, 'User and organization required');
      return;
    }

    // Store tenant MCP configuration
    const tenantMCPKey = `user-${userId}-org-${orgId}-mcp-servers`;
    const kvResult = await KVHandler.get({ key: tenantMCPKey });
    const existingMCPs = kvResult.value ? JSON.parse(kvResult.value) : {};

    const mcpConfig = {
      connectionName: connectionName || integration,
      serverConfig,
      credentials: this.encryptCredentials(credentials),
      connectedAt: new Date().toISOString(),
      integration
    };

    existingMCPs[integration] = mcpConfig;
    await KVHandler.set({ key: tenantMCPKey, value: JSON.stringify(existingMCPs) });

    // Publish event for other services
    await EventsHandler.send({
      detailType: 'Integration Connected',
      detail: {
        userId,
        orgId,
        integration,
        connectionName: mcpConfig.connectionName,
        timestamp: mcpConfig.connectedAt
      },
      source: 'mcp-handler'
    });

    this.sendResponse(MCP_MESSAGE_TYPES.INTEGRATION_CONNECTED, message.requestId, {
      integration,
      connectionName: mcpConfig.connectionName,
      success: true
    });
  }

  private async handleListTenantMCPs(message: MCPMessage): Promise<void> {
    const { userId, orgId } = message;

    if (!userId || !orgId) {
      this.sendError(message.requestId, 'User and organization required');
      return;
    }

    const tenantMCPKey = `user-${userId}-org-${orgId}-mcp-servers`;
    const kvResult = await KVHandler.get({ key: tenantMCPKey });
    const mcpServers = kvResult.value ? JSON.parse(kvResult.value) : {};

    // Remove sensitive credentials from response
    const sanitizedMCPs = Object.entries(mcpServers).reduce((acc, [integration, config]: [string, any]) => {
      acc[integration] = {
        connectionName: config.connectionName,
        integration: config.integration,
        connectedAt: config.connectedAt,
        hasCredentials: !!config.credentials
      };
      return acc;
    }, {} as Record<string, any>);

    this.sendResponse(MCP_MESSAGE_TYPES.TENANT_MCPS_LISTED, message.requestId, {
      mcpServers: sanitizedMCPs
    });
  }

  private async handleDisconnectIntegration(message: MCPMessage): Promise<void> {
    const { integration } = message.payload;
    const { userId, orgId } = message;

    if (!userId || !orgId) {
      this.sendError(message.requestId, 'User and organization required');
      return;
    }

    const tenantMCPKey = `user-${userId}-org-${orgId}-mcp-servers`;
    const kvResult = await KVHandler.get({ key: tenantMCPKey });
    const existingMCPs = kvResult.value ? JSON.parse(kvResult.value) : {};

    if (existingMCPs[integration]) {
      delete existingMCPs[integration];
      await KVHandler.set({ key: tenantMCPKey, value: JSON.stringify(existingMCPs) });

      // Publish event
      await EventsHandler.send({
        detailType: 'Integration Disconnected',
        detail: {
          userId,
          orgId,
          integration,
          timestamp: new Date().toISOString()
        },
        source: 'mcp-handler'
      });
    }

    this.sendResponse(MCP_MESSAGE_TYPES.INTEGRATION_DISCONNECTED, message.requestId, {
      integration,
      success: true
    });
  }

  /**
   * Encrypt credentials using AES-256-GCM for secure storage
   * Returns format: iv:authTag:encryptedData (all hex encoded)
   */
  private encryptCredentials(credentials: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt credentials encrypted with encryptCredentials
   */
  private decryptCredentials(encryptedData: string): any {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted credentials format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  private sendResponse(type: string, requestId: string | undefined, payload: any): void {
    const response = {
      type,
      requestId,
      payload
    };

    this.ws.send(JSON.stringify(response));
  }

  private sendError(requestId: string | undefined, error: string): void {
    this.sendResponse(MCP_MESSAGE_TYPES.MCP_ERROR, requestId, { error });
  }
}