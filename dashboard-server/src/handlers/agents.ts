import MCPStdioService, { MCPServerConfig } from '../services/MCPStdioService.js';
import { getMCPServerConfig } from '../config/mcpServers.js';
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, DeleteItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import ErrorHandler from '../utils/ErrorHandler.js';

/**
 * Agent operations handler for dashboard-server
 * Follows mutator/accessor pattern for agent operations
 */
export class AgentHandler {
  private static mcpService: MCPStdioService | null = null;
  private static dynamoClient: DynamoDBClient | null = null;
  private static s3Client: S3Client | null = null;

  // Environment-based table and bucket names
  private static get env() {
    return process.env.NODE_ENV || 'dev';
  }

  private static get agentsTableName() {
    return `agent-mesh-${this.env}-agents`;
  }

  private static get agentVersionsTableName() {
    return `agent-mesh-${this.env}-agent-versions`;
  }

  private static get agentsBucketName() {
    return `agent-mesh-${this.env}-agents`;
  }

  /**
   * Initialize MCP service connection
   */
  private static async getMCPService(): Promise<MCPStdioService> {
    if (!this.mcpService) {
      this.mcpService = new MCPStdioService();
      // Use configured AWS MCP server (Rust)
      const config = getMCPServerConfig('aws');
      if (!config) {
        throw new Error('No AWS MCP server configuration found. MCP servers must be explicitly configured.');
      }
      await this.mcpService.connect(config);
    }
    return this.mcpService;
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

  private static getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-west-2'
      });
    }
    return this.s3Client;
  }

  /**
   * Generate S3 key for agent storage based on ownership
   */
  private static generateS3Key(ownerType: 'organization' | 'user' | 'public', ownerId: string, agentId: string): string {
    if (ownerType === 'public') {
      return `agents/public/system/${agentId}.md`;
    }
    if (ownerType === 'organization') {
      return `agents/organizations/${ownerId}/shared/${agentId}.md`;
    }
    return `agents/users/${ownerId}/${agentId}.md`;
  }

  /**
   * Parse frontmatter from markdown content
   */
  private static parseFrontmatter(markdown: string): { frontmatter: any; content: string } {
    const lines = markdown.split('\n');
    if (lines[0] !== '---') {
      return { frontmatter: {}, content: markdown };
    }

    const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line === '---');
    if (frontmatterEnd === -1) {
      return { frontmatter: {}, content: markdown };
    }

    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const content = lines.slice(frontmatterEnd + 1).join('\n');

    const frontmatter: any = {};
    frontmatterLines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else if (value.startsWith('"') && value.endsWith('"')) {
          frontmatter[key] = value.slice(1, -1);
        } else {
          frontmatter[key] = value;
        }
      }
    });

    return { frontmatter, content };
  }

  // ACCESSORS (read operations)

  /**
   * List available agents from MCP server
   */
  static async listAvailableAgents(): Promise<any> {
    try {
      const mcpService = await this.getMCPService();
      const result = await mcpService.executeTool('agent.listAvailableAgents', {});

      // The MCP server returns agents wrapped in an object with agents array
      if (result && Array.isArray(result.agents)) {
        return {
          success: true,
          agents: result.agents,
          timestamp: new Date().toISOString()
        };
      } else if (Array.isArray(result)) {
        // Handle case where result is directly an array
        return {
          success: true,
          agents: result,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: false,
        error: 'Invalid response format from MCP server',
        result
      };
    } catch (error) {
      const categorizedError = await ErrorHandler.handleError(
        error,
        'mcp_list_agents'
      );

      return {
        success: false,
        error: categorizedError.userMessage,
        errorCode: categorizedError.code,
        shouldRetry: categorizedError.shouldRetry,
        fallback: [
          'conductor',
          'critic',
          'sweeper',
          'linkedin-content-creator',
          'terraform-infrastructure-expert',
          'django-backend-expert',
          'react-component-architect',
          'aws-lambda-serverless-expert'
        ]
      };
    }
  }
  
  /**
   * List agents for an organization or user (from DynamoDB)
   */
  static async listAgents(params: { ownerType: 'organization' | 'user'; ownerId: string }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();

      const command = new QueryCommand({
        TableName: this.agentsTableName,
        IndexName: 'owner-index',
        KeyConditionExpression: 'ownerType = :ownerType AND ownerId = :ownerId',
        ExpressionAttributeValues: marshall({
          ':ownerType': params.ownerType,
          ':ownerId': params.ownerId
        })
      });

      const result = await dynamoClient.send(command);
      const agents = result.Items?.map(item => unmarshall(item)) || [];

      return {
        success: true,
        agents,
        count: agents.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error listing agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agents: []
      };
    }
  }

  /**
   * Get agent metadata and markdown (from DynamoDB and S3)
   */
  static async getAgent(params: { agentId: string; ownerType: 'organization' | 'user'; ownerId: string }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const s3Client = this.getS3Client();

      // Get agent metadata from DynamoDB
      const getCommand = new GetItemCommand({
        TableName: this.agentsTableName,
        Key: marshall({ agentId: params.agentId })
      });

      const result = await dynamoClient.send(getCommand);
      if (!result.Item) {
        return {
          success: false,
          error: 'Agent not found',
          agent: null,
          markdown: ''
        };
      }

      const agent = unmarshall(result.Item);

      // Verify ownership
      if (agent.ownerType !== params.ownerType || agent.ownerId !== params.ownerId) {
        return {
          success: false,
          error: 'Access denied - agent ownership mismatch',
          agent: null,
          markdown: ''
        };
      }

      // Get markdown content from S3
      const s3Key = agent.s3Key || this.generateS3Key(params.ownerType, params.ownerId, params.agentId);

      const getObjectCommand = new GetObjectCommand({
        Bucket: this.agentsBucketName,
        Key: s3Key
      });

      let markdown = '';
      try {
        const s3Result = await s3Client.send(getObjectCommand);
        markdown = await s3Result.Body?.transformToString() || '';
      } catch (s3Error) {
        console.warn('Could not fetch markdown from S3:', s3Error);
        // Continue without markdown content
      }

      return {
        success: true,
        agent,
        markdown,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agent: null,
        markdown: ''
      };
    }
  }

  /**
   * Get task status
   */
  static async getTaskStatus(taskId: string): Promise<any> {
    try {
      const mcpService = await this.getMCPService();
      return await mcpService.executeTool('agent.getTaskStatus', { taskId });
    } catch (error) {
      console.error('Error getting task status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // MUTATORS (write operations)

  /**
   * Process agent request through governance
   */
  static async processRequest(params: {
    userId: string;
    sessionId: string;
    request: string;
    context?: Record<string, any>;
  }): Promise<any> {
    try {
      const mcpService = await this.getMCPService();
      return await mcpService.executeTool('agent.processRequest', params);
    } catch (error) {
      console.error('Error processing agent request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delegate task directly to specific agent
   */
  static async delegateToAgent(params: {
    agentType: string;
    prompt: string;
    userId: string;
    sessionId: string;
    context?: Record<string, any>;
  }): Promise<any> {
    try {
      const mcpService = await this.getMCPService();
      return await mcpService.executeTool('agent.delegateToAgent', params);
    } catch (error) {
      console.error('Error delegating to agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cleanup MCP connection
   */
  static async cleanup(): Promise<void> {
    if (this.mcpService) {
      await this.mcpService.cleanup();
      this.mcpService = null;
    }
  }

  /**
   * Create a new agent (metadata in DynamoDB, markdown in S3)
   */
  static async createAgent(params: {
    ownerType: 'organization' | 'user';
    ownerId: string;
    name: string;
    description?: string;
    markdown: string;
    tags?: string[];
    permissions?: Record<string, any>;
  }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const s3Client = this.getS3Client();

      const agentId = uuidv4();
      const now = new Date().toISOString();
      const version = '1.0.0';

      // Parse frontmatter from markdown
      const { frontmatter, content } = this.parseFrontmatter(params.markdown);

      // Generate S3 key
      const s3Key = this.generateS3Key(params.ownerType, params.ownerId, agentId);

      // Store markdown content in S3
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.agentsBucketName,
        Key: s3Key,
        Body: params.markdown,
        ContentType: 'text/markdown',
        Metadata: {
          agentId,
          version,
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          createdAt: now
        }
      });

      await s3Client.send(putObjectCommand);

      // Store agent metadata in DynamoDB
      const agentItem = {
        agentId,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        name: params.name || frontmatter.name || agentId,
        description: params.description || frontmatter.description || '',
        tags: params.tags || frontmatter.tags || [],
        s3Key,
        version,
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      const putCommand = new PutItemCommand({
        TableName: this.agentsTableName,
        Item: marshall(agentItem),
        ConditionExpression: 'attribute_not_exists(agentId)' // Prevent overwrites
      });

      await dynamoClient.send(putCommand);

      // Create version record
      const versionItem = {
        agentId,
        version,
        s3Key,
        createdAt: now,
        isActive: 'true', // String for GSI
        changelog: 'Initial version'
      };

      const putVersionCommand = new PutItemCommand({
        TableName: this.agentVersionsTableName,
        Item: marshall(versionItem)
      });

      await dynamoClient.send(putVersionCommand);

      return {
        success: true,
        agent: agentItem,
        message: 'Agent created successfully'
      };
    } catch (error) {
      console.error('Error creating agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agent: null
      };
    }
  }

  /**
   * Update an agent (metadata in DynamoDB, new markdown version in S3)
   */
  static async updateAgent(params: {
    agentId: string;
    ownerType: 'organization' | 'user';
    ownerId: string;
    markdown: string;
    description?: string;
    tags?: string[];
    permissions?: Record<string, any>;
    changelog?: string;
  }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const s3Client = this.getS3Client();

      // First, verify the agent exists and ownership
      const getCommand = new GetItemCommand({
        TableName: this.agentsTableName,
        Key: marshall({ agentId: params.agentId })
      });

      const result = await dynamoClient.send(getCommand);
      if (!result.Item) {
        return {
          success: false,
          error: 'Agent not found'
        };
      }

      const existingAgent = unmarshall(result.Item);
      if (existingAgent.ownerType !== params.ownerType || existingAgent.ownerId !== params.ownerId) {
        return {
          success: false,
          error: 'Access denied - agent ownership mismatch'
        };
      }

      const now = new Date().toISOString();
      // Generate new version (simple increment for now)
      const currentVersion = existingAgent.version || '1.0.0';
      const versionParts = currentVersion.split('.').map(Number);
      versionParts[2] += 1; // Increment patch version
      const newVersion = versionParts.join('.');

      // Parse frontmatter from new markdown
      const { frontmatter, content } = this.parseFrontmatter(params.markdown);

      // Generate new S3 key for the version
      const s3Key = this.generateS3Key(params.ownerType, params.ownerId, params.agentId);
      const versionedS3Key = `${s3Key.replace('.md', '')}/v${newVersion}.md`;

      // Store new markdown version in S3
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.agentsBucketName,
        Key: versionedS3Key,
        Body: params.markdown,
        ContentType: 'text/markdown',
        Metadata: {
          agentId: params.agentId,
          version: newVersion,
          ownerType: params.ownerType,
          ownerId: params.ownerId,
          updatedAt: now
        }
      });

      await s3Client.send(putObjectCommand);

      // Update agent metadata in DynamoDB
      let updateExpression = 'SET #version = :version, #s3Key = :s3Key, #updatedAt = :updatedAt';
      const expressionAttributeNames: Record<string, string> = {
        '#version': 'version',
        '#s3Key': 's3Key',
        '#updatedAt': 'updatedAt'
      };
      const expressionAttributeValues: Record<string, any> = {
        ':version': newVersion,
        ':s3Key': versionedS3Key,
        ':updatedAt': now
      };

      // Add optional fields to update
      if (params.description !== undefined) {
        updateExpression += ', #description = :description';
        expressionAttributeNames['#description'] = 'description';
        expressionAttributeValues[':description'] = params.description;
      } else if (frontmatter.description) {
        updateExpression += ', #description = :description';
        expressionAttributeNames['#description'] = 'description';
        expressionAttributeValues[':description'] = frontmatter.description;
      }

      if (params.tags !== undefined) {
        updateExpression += ', #tags = :tags';
        expressionAttributeNames['#tags'] = 'tags';
        expressionAttributeValues[':tags'] = params.tags;
      } else if (frontmatter.tags) {
        updateExpression += ', #tags = :tags';
        expressionAttributeNames['#tags'] = 'tags';
        expressionAttributeValues[':tags'] = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
      }

      const updateCommand = new UpdateItemCommand({
        TableName: this.agentsTableName,
        Key: marshall({ agentId: params.agentId }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW'
      });

      const updateResult = await dynamoClient.send(updateCommand);

      // Mark old version as inactive and create new version record
      const oldVersionQuery = new QueryCommand({
        TableName: this.agentVersionsTableName,
        KeyConditionExpression: 'agentId = :agentId',
        FilterExpression: 'isActive = :active',
        ExpressionAttributeValues: marshall({
          ':agentId': params.agentId,
          ':active': 'true'
        })
      });

      const oldVersions = await dynamoClient.send(oldVersionQuery);

      // Mark old versions as inactive
      for (const item of oldVersions.Items || []) {
        const version = unmarshall(item);
        await dynamoClient.send(new UpdateItemCommand({
          TableName: this.agentVersionsTableName,
          Key: marshall({ agentId: params.agentId, version: version.version }),
          UpdateExpression: 'SET isActive = :inactive',
          ExpressionAttributeValues: marshall({ ':inactive': 'false' })
        }));
      }

      // Create new version record
      const versionItem = {
        agentId: params.agentId,
        version: newVersion,
        s3Key: versionedS3Key,
        createdAt: now,
        isActive: 'true',
        changelog: params.changelog || 'Agent updated'
      };

      const putVersionCommand = new PutItemCommand({
        TableName: this.agentVersionsTableName,
        Item: marshall(versionItem)
      });

      await dynamoClient.send(putVersionCommand);

      return {
        success: true,
        agent: updateResult.Attributes ? unmarshall(updateResult.Attributes) : null,
        newVersion,
        message: 'Agent updated successfully'
      };
    } catch (error) {
      console.error('Error updating agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agent: null
      };
    }
  }

  /**
   * Delete an agent (remove metadata from DynamoDB, delete S3 files)
   */
  static async deleteAgent(params: {
    agentId: string;
    ownerType: 'organization' | 'user';
    ownerId: string;
  }): Promise<any> {
    try {
      const dynamoClient = this.getDynamoClient();
      const s3Client = this.getS3Client();

      // First, verify the agent exists and ownership
      const getCommand = new GetItemCommand({
        TableName: this.agentsTableName,
        Key: marshall({ agentId: params.agentId })
      });

      const result = await dynamoClient.send(getCommand);
      if (!result.Item) {
        return {
          success: false,
          error: 'Agent not found'
        };
      }

      const existingAgent = unmarshall(result.Item);
      if (existingAgent.ownerType !== params.ownerType || existingAgent.ownerId !== params.ownerId) {
        return {
          success: false,
          error: 'Access denied - agent ownership mismatch'
        };
      }

      // List and delete all S3 objects for this agent (all versions)
      const s3Prefix = this.generateS3Key(params.ownerType, params.ownerId, params.agentId).replace('.md', '');

      const listCommand = new ListObjectsV2Command({
        Bucket: this.agentsBucketName,
        Prefix: s3Prefix
      });

      const listResult = await s3Client.send(listCommand);

      // Delete all S3 objects for this agent
      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const object of listResult.Contents) {
          if (object.Key) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: this.agentsBucketName,
              Key: object.Key
            }));
          }
        }
      }

      // Delete all version records
      const versionsQuery = new QueryCommand({
        TableName: this.agentVersionsTableName,
        KeyConditionExpression: 'agentId = :agentId',
        ExpressionAttributeValues: marshall({
          ':agentId': params.agentId
        })
      });

      const versionsResult = await dynamoClient.send(versionsQuery);

      if (versionsResult.Items) {
        for (const item of versionsResult.Items) {
          const version = unmarshall(item);
          await dynamoClient.send(new DeleteItemCommand({
            TableName: this.agentVersionsTableName,
            Key: marshall({
              agentId: params.agentId,
              version: version.version
            })
          }));
        }
      }

      // Delete agent metadata
      const deleteCommand = new DeleteItemCommand({
        TableName: this.agentsTableName,
        Key: marshall({ agentId: params.agentId })
      });

      await dynamoClient.send(deleteCommand);

      return {
        success: true,
        message: 'Agent deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default AgentHandler;