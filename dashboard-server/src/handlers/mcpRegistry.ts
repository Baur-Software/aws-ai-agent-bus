import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCP Registry handler for managing connected MCP servers and tenant context
 */
export class MCPRegistryHandler {
  private static dynamoClient: DynamoDBClient | null = null;

  // Environment-based table names
  private static get env() {
    return process.env.NODE_ENV || 'dev';
  }

  private static get mcpServersTableName() {
    return `agent-mesh-${this.env}-mcp-servers`;
  }

  private static get mcpConnectionsTableName() {
    return `agent-mesh-${this.env}-mcp-connections`;
  }

  private static get publishedWorkflowsTableName() {
    return `agent-mesh-${this.env}-published-workflows`;
  }

  /**
   * Initialize AWS clients
   */
  private static getDynamoClient(): DynamoDBClient {
    if (!this.dynamoClient) {
      this.dynamoClient = new DynamoDBClient({
        region: process.env.AWS_REGION || 'us-west-2'
      });
    }
    return this.dynamoClient;
  }

  // MCP SERVER REGISTRY OPERATIONS

  /**
   * Register a new MCP server or version
   */
  static async registerMCPServer(params: {
    serverId: string;
    version: string;
    name: string;
    description?: string;
    category: string;
    capabilities: any[];
    tools: any[];
    authType?: string;
    authConfig?: any;
    forkedFrom?: string;
    maintainer?: string;
    isLatest?: boolean;
  }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const now = new Date().toISOString();

      // If this is marked as latest, mark other versions as not latest
      if (params.isLatest) {
        await this.markOtherVersionsNotLatest(params.serverId);
      }

      const serverItem = {
        serverId: params.serverId,
        version: params.version,
        name: params.name,
        description: params.description || '',
        category: params.category,
        capabilities: params.capabilities,
        tools: params.tools,
        authType: params.authType || 'none',
        authConfig: params.authConfig || {},
        forkedFrom: params.forkedFrom || '',
        maintainer: params.maintainer || '',
        isLatest: params.isLatest ? 'true' : 'false',
        createdAt: now,
        updatedAt: now
      };

      const putCommand = new PutItemCommand({
        TableName: this.mcpServersTableName,
        Item: marshall(serverItem),
        ConditionExpression: 'attribute_not_exists(serverId) OR attribute_not_exists(version)'
      });

      await dynamoClient.send(putCommand);

      return {
        success: true,
        server: serverItem,
        message: 'MCP server registered successfully'
      };
    } catch (error) {
      console.error('Error registering MCP server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List available MCP servers by category
   */
  static async listMCPServers(params: { category?: string; latestOnly?: boolean }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();

      let command: QueryCommand;

      if (params.category) {
        command = new QueryCommand({
          TableName: this.mcpServersTableName,
          IndexName: 'category-index',
          KeyConditionExpression: 'category = :category',
          ExpressionAttributeValues: marshall({
            ':category': params.category
          }),
          ScanIndexForward: false // Most recent first
        });
      } else {
        // TODO: Implement scan for all servers (consider pagination)
        command = new QueryCommand({
          TableName: this.mcpServersTableName,
          IndexName: 'category-index',
          KeyConditionExpression: 'category = :category',
          ExpressionAttributeValues: marshall({
            ':category': 'general' // Default category for now
          })
        });
      }

      const result = await dynamoClient.send(command);
      let servers = result.Items?.map(item => unmarshall(item)) || [];

      // Filter to latest versions only if requested
      if (params.latestOnly) {
        servers = servers.filter(server => server.isLatest === 'true');
      }

      return {
        success: true,
        servers,
        count: servers.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error listing MCP servers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        servers: []
      };
    }
  }

  /**
   * Get specific MCP server version
   */
  static async getMCPServer(serverId: string, version?: string): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();

      if (!version) {
        // Get latest version
        const latestQuery = new QueryCommand({
          TableName: this.mcpServersTableName,
          IndexName: 'latest-version-index',
          KeyConditionExpression: 'serverId = :serverId AND isLatest = :isLatest',
          ExpressionAttributeValues: marshall({
            ':serverId': serverId,
            ':isLatest': 'true'
          })
        });

        const latestResult = await dynamoClient.send(latestQuery);
        if (!latestResult.Items || latestResult.Items.length === 0) {
          return {
            success: false,
            error: 'MCP server not found'
          };
        }

        return {
          success: true,
          server: unmarshall(latestResult.Items[0])
        };
      } else {
        // Get specific version
        const getCommand = new GetItemCommand({
          TableName: this.mcpServersTableName,
          Key: marshall({ serverId, version })
        });

        const result = await dynamoClient.send(getCommand);
        if (!result.Item) {
          return {
            success: false,
            error: 'MCP server version not found'
          };
        }

        return {
          success: true,
          server: unmarshall(result.Item)
        };
      }
    } catch (error) {
      console.error('Error getting MCP server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // USER/ORG MCP CONNECTION OPERATIONS

  /**
   * Connect MCP server to user/org context
   */
  static async connectMCPServer(params: {
    ownerType: 'organization' | 'user';
    ownerId: string;
    serverId: string;
    version: string;
    authCredentials?: any;
    config?: any;
  }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const connectionId = uuidv4();
      const now = new Date().toISOString();

      const connectionItem = {
        connectionId,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        serverId: params.serverId,
        version: params.version,
        authCredentials: params.authCredentials || {},
        config: params.config || {},
        status: 'connected',
        connectedAt: now,
        lastHealthCheck: now
      };

      const putCommand = new PutItemCommand({
        TableName: this.mcpConnectionsTableName,
        Item: marshall(connectionItem)
      });

      await dynamoClient.send(putCommand);

      return {
        success: true,
        connection: connectionItem,
        message: 'MCP server connected successfully'
      };
    } catch (error) {
      console.error('Error connecting MCP server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List connected MCP servers for user/org
   */
  static async listConnectedMCPServers(params: { ownerType: 'organization' | 'user'; ownerId: string }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();

      const command = new QueryCommand({
        TableName: this.mcpConnectionsTableName,
        IndexName: 'owner-index',
        KeyConditionExpression: 'ownerType = :ownerType AND ownerId = :ownerId',
        ExpressionAttributeValues: marshall({
          ':ownerType': params.ownerType,
          ':ownerId': params.ownerId
        })
      });

      const result = await dynamoClient.send(command);
      const connections = result.Items?.map(item => unmarshall(item)) || [];

      // Enrich with server details
      const enrichedConnections = await Promise.all(
        connections.map(async (connection) => {
          const serverDetails = await this.getMCPServer(connection.serverId, connection.version);
          return {
            ...connection,
            serverDetails: serverDetails.success ? serverDetails.server : null
          };
        })
      );

      return {
        success: true,
        connections: enrichedConnections,
        count: enrichedConnections.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error listing connected MCP servers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connections: []
      };
    }
  }

  /**
   * Disconnect MCP server
   */
  static async disconnectMCPServer(connectionId: string): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();

      const deleteCommand = new DeleteItemCommand({
        TableName: this.mcpConnectionsTableName,
        Key: marshall({ connectionId })
      });

      await dynamoClient.send(deleteCommand);

      return {
        success: true,
        message: 'MCP server disconnected successfully'
      };
    } catch (error) {
      console.error('Error disconnecting MCP server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // HELPER METHODS

  /**
   * Mark other versions of a server as not latest
   */
  private static async markOtherVersionsNotLatest(serverId: string): Promise<void> {
    try {
      const dynamoClient = this.getDynamoClient();

      const queryCommand = new QueryCommand({
        TableName: this.mcpServersTableName,
        KeyConditionExpression: 'serverId = :serverId',
        FilterExpression: 'isLatest = :isLatest',
        ExpressionAttributeValues: marshall({
          ':serverId': serverId,
          ':isLatest': 'true'
        })
      });

      const result = await dynamoClient.send(queryCommand);

      for (const item of result.Items || []) {
        const server = unmarshall(item);
        await dynamoClient.send(new UpdateItemCommand({
          TableName: this.mcpServersTableName,
          Key: marshall({ serverId: server.serverId, version: server.version }),
          UpdateExpression: 'SET isLatest = :isLatest',
          ExpressionAttributeValues: marshall({ ':isLatest': 'false' })
        }));
      }
    } catch (error) {
      console.error('Error marking versions as not latest:', error);
    }
  }
}

export default MCPRegistryHandler;