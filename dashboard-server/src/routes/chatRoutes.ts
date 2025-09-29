import { Router, Request, Response } from 'express';
import TokenService from '../services/TokenService.js';
import { ChatService } from '../services/ChatService.js';
import { Logger } from '../utils/Logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { MCPServiceRegistry } from '../services/MCPServiceRegistry.js';
import crypto from 'crypto';

const router = Router();
const logger = new Logger('ChatRoutes');

// Initialize services
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-west-2' });
const tokenService = new TokenService(dynamodb);

// Initialize MCP registry and ChatService
const mcpRegistry = new MCPServiceRegistry();
const chatService = new ChatService(dynamodb, eventBridge, mcpRegistry, {
  bedrock: {
    region: process.env.AWS_REGION || 'us-west-2',
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'
  },
  ollama: {
    endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama2'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    baseURL: process.env.OPENAI_BASE_URL
  }
});

interface ChatSession {
  sessionId: string;
  userId: string;
  contextId: string;
  contextType: 'personal' | 'organization';
  organizationId?: string;
  title: string;
  lastMessage?: string;
  createdAt: number;
  updatedAt: number;
}

interface MCPContextScope {
  id: string;
  type: 'personal' | 'organization';
  name: string;
  description?: string;
  permissions: string[];
  oauthGrants: string[];
  workflows: string[];
  organizationId?: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Middleware to extract user context from request
 */
const extractUserContext = (req: Request): { userId: string; organizationId?: string } => {
  const userId = req.headers['x-user-id'] as string || 'demo-user';
  const organizationId = req.headers['x-organization-id'] as string;

  return { userId, organizationId };
};

/**
 * POST /chat/message - Send message and get AI response
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const { sessionId, message, contextId, backend } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let targetSessionId = sessionId;

    // Create session if not provided
    if (!targetSessionId) {
      const session = await chatService.createSession(
        userId,
        'New Chat',
        backend || 'bedrock',
        organizationId,
        contextId
      );
      targetSessionId = session.sessionId;
    }

    const response = await chatService.sendMessage({
      sessionId: targetSessionId,
      message,
      userId,
      organizationId,
      context: {
        mcpContextId: contextId
      }
    });

    res.json({
      sessionId: targetSessionId,
      message: response,
      timestamp: response.timestamp
    });
  } catch (error) {
    logger.error('Failed to process chat message:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /chat/sessions - Get user's chat sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);

    // Get sessions from ChatService
    const userSessions = chatService.getUserSessions(userId);

    // Transform to expected format
    const sessions = userSessions.map(session => ({
      sessionId: session.sessionId,
      userId: session.userId,
      contextId: session.context.mcpContextId || `personal_${userId}`,
      contextType: session.organizationId ? 'organization' as const : 'personal' as const,
      organizationId: session.organizationId,
      title: session.title,
      lastMessage: session.messages.length > 0
        ? session.messages[session.messages.length - 1].content
        : undefined,
      backend: session.backend,
      model: session.model,
      messageCount: session.messages.length,
      createdAt: new Date(session.createdAt).getTime(),
      updatedAt: new Date(session.updatedAt).getTime()
    }));

    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    logger.error('Failed to get chat sessions:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /chat/sessions - Create new chat session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const { title, contextId } = req.body;

    if (!title || !contextId) {
      return res.status(400).json({
        error: 'Title and context ID are required'
      });
    }

    // Determine context type based on contextId pattern
    const contextType: 'personal' | 'organization' = contextId.startsWith('personal_') ? 'personal' : 'organization';

    const session: ChatSession = {
      sessionId: `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      contextId,
      contextType,
      organizationId: contextType === 'organization' ? organizationId : undefined,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // In production, store in DynamoDB
    logger.info(`Created chat session ${session.sessionId} for user ${userId} with context ${contextId}`);

    res.status(201).json(session);
  } catch (error) {
    logger.error('Failed to create chat session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /chat/sessions/:sessionId - Update chat session
 */
router.put('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { userId } = extractUserContext(req);
    const { sessionId } = req.params;
    const updates = req.body;

    // In production, update in DynamoDB with proper user ownership validation
    const updatedSession: ChatSession = {
      sessionId,
      userId,
      ...updates,
      updatedAt: Date.now()
    };

    logger.info(`Updated chat session ${sessionId} for user ${userId}`);

    res.json(updatedSession);
  } catch (error) {
    logger.error('Failed to update chat session:', error);
    res.status(500).json({
      error: 'Failed to update session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /chat/sessions/:sessionId - Get specific chat session
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { userId } = extractUserContext(req);
    const { sessionId } = req.params;

    // In production, fetch from DynamoDB with user ownership validation
    const mockSession: ChatSession = {
      sessionId,
      userId,
      contextId: `personal_${userId}`,
      contextType: 'personal',
      title: 'Mock Session',
      lastMessage: 'This is a mock session',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000
    };

    res.json(mockSession);
  } catch (error) {
    logger.error('Failed to get chat session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /chat/sessions/:sessionId - Delete chat session
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { userId } = extractUserContext(req);
    const { sessionId } = req.params;

    // In production, delete from DynamoDB with user ownership validation
    logger.info(`Deleted chat session ${sessionId} for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete chat session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /mcp/contexts - Get available MCP contexts for user
 */
router.get('/contexts', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);

    // Create mock contexts based on user and organization
    const contexts: MCPContextScope[] = [
      {
        id: `personal_${userId}`,
        type: 'personal',
        name: 'Personal Context',
        description: 'Your personal MCP context with your integrations',
        permissions: ['mcp:*'],
        oauthGrants: [], // Would be populated from TokenService
        workflows: [],
        userId,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000
      }
    ];

    if (organizationId) {
      contexts.push({
        id: `org_${organizationId}`,
        type: 'organization',
        name: 'Team Context',
        description: 'Shared context for your organization',
        permissions: ['mcp:*'],
        oauthGrants: [], // Would be populated from TokenService
        workflows: [],
        organizationId,
        userId,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000
      });
    }

    // In production, would also load user's custom contexts from DynamoDB
    const userContexts = await tokenService.getUserAccessibleContexts(userId, organizationId || '');

    res.json({
      contexts: [...contexts, ...userContexts.map(ctx => ({
        id: ctx.contextId,
        type: ctx.organizationId ? 'organization' as const : 'personal' as const,
        name: ctx.contextName,
        description: ctx.contextName,
        permissions: ctx.permissions,
        oauthGrants: ctx.oauthGrants,
        workflows: ctx.workflows,
        organizationId: ctx.organizationId,
        userId,
        createdAt: ctx.createdAt,
        updatedAt: ctx.updatedAt
      }))],
      count: contexts.length
    });
  } catch (error) {
    logger.error('Failed to get MCP contexts:', error);
    res.status(500).json({
      error: 'Failed to get contexts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /mcp/contexts - Create new MCP context
 */
router.post('/contexts', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const { type, name, description } = req.body;

    if (!type || !name) {
      return res.status(400).json({
        error: 'Type and name are required'
      });
    }

    if (type === 'organization' && !organizationId) {
      return res.status(400).json({
        error: 'Organization ID required for organization contexts'
      });
    }

    // Use TokenService to create the context
    const context = await tokenService.createMCPContext({
      organizationId: type === 'organization' ? organizationId! : undefined,
      contextName: name,
      sharedWith: [],
      permissions: ['mcp:*'],
      oauthGrants: [],
      workflows: [],
      createdBy: userId
    });

    // Transform to expected format
    const responseContext: MCPContextScope = {
      id: context.contextId,
      type: type as 'personal' | 'organization',
      name: context.contextName,
      description,
      permissions: context.permissions,
      oauthGrants: context.oauthGrants,
      workflows: context.workflows,
      organizationId: context.organizationId,
      userId,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt
    };

    res.status(201).json(responseContext);
  } catch (error) {
    logger.error('Failed to create MCP context:', error);
    res.status(500).json({
      error: 'Failed to create context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;