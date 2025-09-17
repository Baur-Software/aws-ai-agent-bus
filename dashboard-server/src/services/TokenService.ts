import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../utils/Logger.js';
import crypto from 'crypto';

export interface OAuthToken {
  tokenId: string;
  userId: string;
  organizationId: string;
  appType: string; // 'google-analytics', 'slack', 'github', etc.
  connectionName: string; // User-friendly name like "Work Account", "Personal"
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface MCPContext {
  contextId: string;
  organizationId: string;
  contextName: string;
  sharedWith: string[]; // User IDs who have access
  permissions: string[]; // MCP tool permissions
  oauthGrants: string[]; // Token IDs that this context can use
  workflows: string[]; // Workflow IDs available in this context
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowDefinition {
  workflowId: string;
  organizationId: string;
  contextId: string;
  name: string;
  description: string;
  definition: any; // Workflow JSON definition
  requiredApps: string[]; // Required app integrations
  sharedWith: string[]; // User IDs who can execute
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Secure token and context management service
 * Handles OAuth tokens, MCP contexts, and workflow sharing
 */
export class TokenService {
  private docClient: DynamoDBDocumentClient;
  private logger: Logger;
  private tableName: string;
  private encryptionKey: Buffer;

  constructor(dynamodb: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamodb);
    this.logger = new Logger('TokenService');
    this.tableName = process.env.AGENT_MESH_KV_TABLE || 'agent-mesh-kv';

    // Use environment encryption key or generate one (in prod, use AWS KMS)
    const keyString = process.env.TOKEN_ENCRYPTION_KEY || 'default-dev-key-change-in-production';
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
  }

  /**
   * Encrypt sensitive token data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive token data
   */
  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Store OAuth token securely
   */
  async storeOAuthToken(token: Omit<OAuthToken, 'tokenId' | 'createdAt' | 'updatedAt'>): Promise<OAuthToken> {
    const tokenId = `oauth_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    const encryptedToken: OAuthToken = {
      ...token,
      tokenId,
      accessToken: this.encrypt(token.accessToken),
      refreshToken: token.refreshToken ? this.encrypt(token.refreshToken) : undefined,
      createdAt: now,
      updatedAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        key: `TOKEN#${tokenId}`,
        ...encryptedToken,
        expires_at: Math.floor((now + (30 * 24 * 60 * 60 * 1000)) / 1000) // 30 days TTL
      }
    }));

    this.logger.info(`Stored OAuth token for user ${token.userId}, org ${token.organizationId}, app ${token.appType}`);
    return encryptedToken;
  }

  /**
   * Get OAuth token by ID
   */
  async getOAuthToken(tokenId: string): Promise<OAuthToken | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { key: `TOKEN#${tokenId}` }
      }));

      if (!result.Item) {
        return null;
      }

      const token = result.Item as OAuthToken;

      // Decrypt sensitive fields
      token.accessToken = this.decrypt(token.accessToken);
      if (token.refreshToken) {
        token.refreshToken = this.decrypt(token.refreshToken);
      }

      return token;
    } catch (error) {
      this.logger.error(`Failed to get OAuth token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get all OAuth tokens for a user in an organization
   */
  async getUserOAuthTokens(userId: string, organizationId: string): Promise<OAuthToken[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'UserOrgIndex', // Would need to create this GSI
        KeyConditionExpression: 'userId = :userId AND organizationId = :orgId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':orgId': organizationId
        }
      }));

      return (result.Items || []).map(item => {
        const token = item as OAuthToken;
        token.accessToken = this.decrypt(token.accessToken);
        if (token.refreshToken) {
          token.refreshToken = this.decrypt(token.refreshToken);
        }
        return token;
      });
    } catch (error) {
      this.logger.error(`Failed to get user tokens for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create MCP context for organization
   */
  async createMCPContext(context: Omit<MCPContext, 'contextId' | 'createdAt' | 'updatedAt'>): Promise<MCPContext> {
    const contextId = `mcp_ctx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    const newContext: MCPContext = {
      ...context,
      contextId,
      createdAt: now,
      updatedAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        key: `CONTEXT#${contextId}`,
        ...newContext
      }
    }));

    this.logger.info(`Created MCP context ${contextId} for org ${context.organizationId}`);
    return newContext;
  }

  /**
   * Get MCP contexts for organization
   */
  async getOrganizationContexts(organizationId: string): Promise<MCPContext[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'OrganizationIndex', // Would need to create this GSI
        KeyConditionExpression: 'organizationId = :orgId',
        ExpressionAttributeValues: {
          ':orgId': organizationId
        }
      }));

      return (result.Items || []) as MCPContext[];
    } catch (error) {
      this.logger.error(`Failed to get contexts for org ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Get MCP contexts accessible to user
   */
  async getUserAccessibleContexts(userId: string, organizationId: string): Promise<MCPContext[]> {
    const orgContexts = await this.getOrganizationContexts(organizationId);

    return orgContexts.filter(context =>
      context.createdBy === userId || context.sharedWith.includes(userId)
    );
  }

  /**
   * Store workflow definition
   */
  async storeWorkflow(workflow: Omit<WorkflowDefinition, 'workflowId' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition> {
    const workflowId = `workflow_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    const newWorkflow: WorkflowDefinition = {
      ...workflow,
      workflowId,
      createdAt: now,
      updatedAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        key: `WORKFLOW#${workflowId}`,
        ...newWorkflow
      }
    }));

    this.logger.info(`Stored workflow ${workflowId} for context ${workflow.contextId}`);
    return newWorkflow;
  }

  /**
   * Get workflows for MCP context
   */
  async getContextWorkflows(contextId: string): Promise<WorkflowDefinition[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'ContextIndex', // Would need to create this GSI
        KeyConditionExpression: 'contextId = :contextId',
        ExpressionAttributeValues: {
          ':contextId': contextId
        }
      }));

      return (result.Items || []) as WorkflowDefinition[];
    } catch (error) {
      this.logger.error(`Failed to get workflows for context ${contextId}:`, error);
      return [];
    }
  }

  /**
   * Get workflows accessible to user
   */
  async getUserAccessibleWorkflows(userId: string, organizationId: string): Promise<WorkflowDefinition[]> {
    const contexts = await this.getUserAccessibleContexts(userId, organizationId);
    const workflows: WorkflowDefinition[] = [];

    for (const context of contexts) {
      const contextWorkflows = await this.getContextWorkflows(context.contextId);
      workflows.push(...contextWorkflows.filter(w =>
        w.createdBy === userId || w.sharedWith.includes(userId)
      ));
    }

    return workflows;
  }

  /**
   * Validate user access to MCP context
   */
  async validateContextAccess(userId: string, contextId: string): Promise<MCPContext | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { key: `CONTEXT#${contextId}` }
      }));

      if (!result.Item) {
        return null;
      }

      const context = result.Item as MCPContext;

      if (context.createdBy === userId || context.sharedWith.includes(userId)) {
        return context;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to validate context access for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get OAuth tokens for MCP context
   */
  async getContextOAuthTokens(contextId: string): Promise<OAuthToken[]> {
    const context = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { key: `CONTEXT#${contextId}` }
    }));

    if (!context.Item) {
      return [];
    }

    const mcpContext = context.Item as MCPContext;
    const tokens: OAuthToken[] = [];

    for (const tokenId of mcpContext.oauthGrants) {
      const token = await this.getOAuthToken(tokenId);
      if (token) {
        tokens.push(token);
      }
    }

    return tokens;
  }
}

export default TokenService;