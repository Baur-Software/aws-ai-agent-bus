import { Logger } from '../utils/Logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';

interface ChatSessionMetadata {
  sessionId: string;
  userId: string;
  organizationId?: string; // If set, this is an org chat
  contextType: 'personal' | 'organization';
  title: string;
  isGroupChat: boolean; // For future group chat support
  participants?: string[]; // User IDs for group chats
  backend: 'bedrock' | 'ollama' | 'openai';
  model: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface StoredChatMessage {
  sessionId: string;
  messageId: string;
  userId: string;
  organizationId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: {
    organizationId?: string;
    userId: string;
    mcpContextId?: string;
    tools?: string[];
    toolsUsed?: string[];
    mcpCalls?: any[];
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export class ChatHistoryService {
  private logger: Logger;
  private docClient: DynamoDBDocumentClient;
  private sessionsTableName: string;
  private messagesTableName: string;

  constructor(
    dynamodb: DynamoDBClient,
    sessionsTableName: string,
    messagesTableName: string
  ) {
    this.logger = new Logger('ChatHistoryService');
    this.docClient = DynamoDBDocumentClient.from(dynamodb);
    this.sessionsTableName = sessionsTableName;
    this.messagesTableName = messagesTableName;
  }

  /**
   * Create a new chat session (personal or organization)
   */
  async createSession(
    sessionId: string,
    userId: string,
    title: string,
    contextType: 'personal' | 'organization' = 'personal',
    organizationId?: string,
    backend: 'bedrock' | 'ollama' | 'openai' = 'bedrock',
    model: string = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
  ): Promise<ChatSessionMetadata> {
    const now = new Date().toISOString();

    const session: ChatSessionMetadata = {
      sessionId,
      userId,
      organizationId,
      contextType,
      title,
      isGroupChat: false,
      backend,
      model,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now
    };

    // Store in DynamoDB
    await this.docClient.send(new PutCommand({
      TableName: this.sessionsTableName,
      Item: {
        PK: contextType === 'organization' && organizationId
          ? `ORG#${organizationId}`
          : `USER#${userId}`,
        SK: `SESSION#${sessionId}`,
        ...session,
        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
      }
    }));

    this.logger.info(`Created ${contextType} chat session ${sessionId} for user ${userId}`);

    return session;
  }

  /**
   * Store a chat message
   */
  async storeMessage(message: StoredChatMessage): Promise<void> {
    const contextType = message.organizationId ? 'organization' : 'personal';

    await this.docClient.send(new PutCommand({
      TableName: this.messagesTableName,
      Item: {
        PK: `SESSION#${message.sessionId}`,
        SK: `MSG#${message.timestamp}#${message.messageId}`,
        ...message,
        contextType,
        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
      }
    }));

    // Update session message count and last message time
    await this.updateSessionMetadata(
      message.sessionId,
      message.userId,
      message.organizationId,
      {
        lastMessageAt: message.timestamp,
        messageCount: 1 // Will be incremented
      }
    );

    this.logger.info(`Stored ${message.role} message for session ${message.sessionId}`);
  }

  /**
   * Get session metadata
   */
  async getSession(
    sessionId: string,
    userId: string,
    organizationId?: string
  ): Promise<ChatSessionMetadata | null> {
    const contextType = organizationId ? 'organization' : 'personal';
    const PK = contextType === 'organization' && organizationId
      ? `ORG#${organizationId}`
      : `USER#${userId}`;

    const result = await this.docClient.send(new GetCommand({
      TableName: this.sessionsTableName,
      Key: {
        PK,
        SK: `SESSION#${sessionId}`
      }
    }));

    if (!result.Item) {
      return null;
    }

    return result.Item as ChatSessionMetadata;
  }

  /**
   * Get session messages with pagination
   */
  async getSessionMessages(
    sessionId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<{
    messages: StoredChatMessage[];
    lastEvaluatedKey?: any;
  }> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.messagesTableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SESSION#${sessionId}`
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
      ScanIndexForward: true // Oldest first
    }));

    return {
      messages: (result.Items || []) as StoredChatMessage[],
      lastEvaluatedKey: result.LastEvaluatedKey
    };
  }

  /**
   * List user's chat sessions (personal)
   */
  async listUserSessions(
    userId: string,
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{
    sessions: ChatSessionMetadata[];
    lastEvaluatedKey?: any;
  }> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.sessionsTableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SESSION#'
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
      ScanIndexForward: false // Newest first
    }));

    return {
      sessions: (result.Items || []) as ChatSessionMetadata[],
      lastEvaluatedKey: result.LastEvaluatedKey
    };
  }

  /**
   * List organization's chat sessions (group chats)
   */
  async listOrganizationSessions(
    organizationId: string,
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{
    sessions: ChatSessionMetadata[];
    lastEvaluatedKey?: any;
  }> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.sessionsTableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `ORG#${organizationId}`,
        ':sk': 'SESSION#'
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
      ScanIndexForward: false // Newest first
    }));

    return {
      sessions: (result.Items || []) as ChatSessionMetadata[],
      lastEvaluatedKey: result.LastEvaluatedKey
    };
  }

  /**
   * Update session metadata
   */
  private async updateSessionMetadata(
    sessionId: string,
    userId: string,
    organizationId: string | undefined,
    updates: Partial<ChatSessionMetadata>
  ): Promise<void> {
    const contextType = organizationId ? 'organization' : 'personal';
    const PK = contextType === 'organization' && organizationId
      ? `ORG#${organizationId}`
      : `USER#${userId}`;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression
    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Always update updatedAt
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // Increment message count if provided
    if (updates.messageCount !== undefined) {
      updateExpression[updateExpression.findIndex(expr => expr.includes('messageCount'))] =
        'messageCount = if_not_exists(messageCount, :zero) + :val' +
        Object.keys(expressionAttributeValues).findIndex(k => k.includes('messageCount'));
      expressionAttributeValues[':zero'] = 0;
    }

    await this.docClient.send(new UpdateCommand({
      TableName: this.sessionsTableName,
      Key: {
        PK,
        SK: `SESSION#${sessionId}`
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
  }

  /**
   * Update session title
   */
  async updateSessionTitle(
    sessionId: string,
    userId: string,
    organizationId: string | undefined,
    title: string
  ): Promise<void> {
    await this.updateSessionMetadata(sessionId, userId, organizationId, { title });
    this.logger.info(`Updated session ${sessionId} title to: ${title}`);
  }

  /**
   * Delete a session and all its messages
   */
  async deleteSession(
    sessionId: string,
    userId: string,
    organizationId?: string
  ): Promise<void> {
    const contextType = organizationId ? 'organization' : 'personal';
    const PK = contextType === 'organization' && organizationId
      ? `ORG#${organizationId}`
      : `USER#${userId}`;

    // Delete session metadata
    await this.docClient.send(new DeleteCommand({
      TableName: this.sessionsTableName,
      Key: {
        PK,
        SK: `SESSION#${sessionId}`
      }
    }));

    // Delete all messages (batch delete would be more efficient for production)
    let lastEvaluatedKey: any = undefined;
    do {
      const messages = await this.getSessionMessages(sessionId, 25, lastEvaluatedKey);

      for (const message of messages.messages) {
        await this.docClient.send(new DeleteCommand({
          TableName: this.messagesTableName,
          Key: {
            PK: `SESSION#${sessionId}`,
            SK: `MSG#${message.timestamp}#${message.messageId}`
          }
        }));
      }

      lastEvaluatedKey = messages.lastEvaluatedKey;
    } while (lastEvaluatedKey);

    this.logger.info(`Deleted session ${sessionId} and all messages`);
  }

  /**
   * Search sessions by title (for personal context)
   */
  async searchSessions(
    userId: string,
    searchTerm: string,
    contextType: 'personal' | 'organization' = 'personal',
    organizationId?: string,
    limit: number = 10
  ): Promise<ChatSessionMetadata[]> {
    const PK = contextType === 'organization' && organizationId
      ? `ORG#${organizationId}`
      : `USER#${userId}`;

    const result = await this.docClient.send(new QueryCommand({
      TableName: this.sessionsTableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'contains(#title, :searchTerm)',
      ExpressionAttributeNames: {
        '#title': 'title'
      },
      ExpressionAttributeValues: {
        ':pk': PK,
        ':sk': 'SESSION#',
        ':searchTerm': searchTerm
      },
      Limit: limit,
      ScanIndexForward: false
    }));

    return (result.Items || []) as ChatSessionMetadata[];
  }

  /**
   * Get chat statistics for a user
   */
  async getUserChatStats(userId: string): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalTokensUsed: number;
    mostUsedModel: string;
  }> {
    const sessions = await this.listUserSessions(userId, 100);

    const stats = {
      totalSessions: sessions.sessions.length,
      totalMessages: sessions.sessions.reduce((sum, s) => sum + s.messageCount, 0),
      totalTokensUsed: 0,
      mostUsedModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    };

    // Count model usage
    const modelCounts: Record<string, number> = {};
    sessions.sessions.forEach(session => {
      modelCounts[session.model] = (modelCounts[session.model] || 0) + 1;
    });

    stats.mostUsedModel = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || stats.mostUsedModel;

    return stats;
  }
}

export default ChatHistoryService;
