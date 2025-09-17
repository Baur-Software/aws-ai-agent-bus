import { Router, Request, Response } from 'express';
import TokenService from '../services/TokenService.js';
import { Logger } from '../utils/Logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const router = Router();
const logger = new Logger('WorkflowRoutes');

// Initialize TokenService
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const tokenService = new TokenService(dynamodb);

/**
 * Middleware to extract user context from request
 * In production, this would validate JWT tokens
 */
const extractUserContext = (req: Request): { userId: string; organizationId: string } => {
  // For demo purposes, extract from headers
  // In production, decode from JWT
  const userId = req.headers['x-user-id'] as string || 'demo-user';
  const organizationId = req.headers['x-organization-id'] as string || 'demo-org';

  return { userId, organizationId };
};

/**
 * GET /workflows - Get workflows accessible to user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);

    const workflows = await tokenService.getUserAccessibleWorkflows(userId, organizationId);

    res.json({
      workflows,
      count: workflows.length,
      userId,
      organizationId
    });
  } catch (error) {
    logger.error('Failed to get user workflows:', error);
    res.status(500).json({
      error: 'Failed to get workflows',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflows/contexts - Get MCP contexts accessible to user
 */
router.get('/contexts', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);

    const contexts = await tokenService.getUserAccessibleContexts(userId, organizationId);

    res.json({
      contexts,
      count: contexts.length,
      userId,
      organizationId
    });
  } catch (error) {
    logger.error('Failed to get user contexts:', error);
    res.status(500).json({
      error: 'Failed to get contexts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflows/contexts - Create new MCP context
 */
router.post('/contexts', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const { contextName, permissions, oauthGrants } = req.body;

    if (!contextName) {
      return res.status(400).json({ error: 'Context name is required' });
    }

    const context = await tokenService.createMCPContext({
      organizationId,
      contextName,
      sharedWith: [],
      permissions: permissions || ['mcp:*'],
      oauthGrants: oauthGrants || [],
      workflows: [],
      createdBy: userId
    });

    res.status(201).json(context);
  } catch (error) {
    logger.error('Failed to create MCP context:', error);
    res.status(500).json({
      error: 'Failed to create context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflows/contexts/:contextId - Get specific MCP context
 */
router.get('/contexts/:contextId', async (req: Request, res: Response) => {
  try {
    const { userId } = extractUserContext(req);
    const { contextId } = req.params;

    const context = await tokenService.validateContextAccess(userId, contextId);

    if (!context) {
      return res.status(404).json({ error: 'Context not found or access denied' });
    }

    // Get associated OAuth tokens and workflows
    const oauthTokens = await tokenService.getContextOAuthTokens(contextId);
    const workflows = await tokenService.getContextWorkflows(contextId);

    res.json({
      context,
      oauthTokens: oauthTokens.map(token => ({
        tokenId: token.tokenId,
        appType: token.appType,
        connectionName: token.connectionName,
        scopes: token.scopes,
        expiresAt: token.expiresAt
        // Don't expose actual tokens
      })),
      workflows
    });
  } catch (error) {
    logger.error('Failed to get MCP context:', error);
    res.status(500).json({
      error: 'Failed to get context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflows - Create new workflow
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const { contextId, name, description, definition, requiredApps, sharedWith } = req.body;

    if (!contextId || !name || !definition) {
      return res.status(400).json({
        error: 'Context ID, name, and definition are required'
      });
    }

    // Validate user has access to the context
    const context = await tokenService.validateContextAccess(userId, contextId);
    if (!context) {
      return res.status(403).json({ error: 'Access denied to specified context' });
    }

    const workflow = await tokenService.storeWorkflow({
      organizationId,
      contextId,
      name,
      description: description || '',
      definition,
      requiredApps: requiredApps || [],
      sharedWith: sharedWith || [],
      createdBy: userId
    });

    res.status(201).json(workflow);
  } catch (error) {
    logger.error('Failed to create workflow:', error);
    res.status(500).json({
      error: 'Failed to create workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflows/:contextId - Get workflows for specific context
 */
router.get('/:contextId', async (req: Request, res: Response) => {
  try {
    const { userId } = extractUserContext(req);
    const { contextId } = req.params;

    // Validate user has access to the context
    const context = await tokenService.validateContextAccess(userId, contextId);
    if (!context) {
      return res.status(403).json({ error: 'Access denied to specified context' });
    }

    const workflows = await tokenService.getContextWorkflows(contextId);

    res.json({
      workflows,
      context: {
        contextId: context.contextId,
        contextName: context.contextName,
        permissions: context.permissions
      }
    });
  } catch (error) {
    logger.error('Failed to get context workflows:', error);
    res.status(500).json({
      error: 'Failed to get workflows',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflows/oauth - Store OAuth token for organization
 */
router.post('/oauth', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);
    const {
      appType,
      connectionName,
      accessToken,
      refreshToken,
      expiresAt,
      scopes,
      metadata
    } = req.body;

    if (!appType || !connectionName || !accessToken) {
      return res.status(400).json({
        error: 'App type, connection name, and access token are required'
      });
    }

    const token = await tokenService.storeOAuthToken({
      userId,
      organizationId,
      appType,
      connectionName,
      accessToken,
      refreshToken,
      expiresAt: expiresAt || Date.now() + (3600 * 1000), // 1 hour default
      scopes: scopes || [],
      metadata: metadata || {}
    });

    // Return token info without sensitive data
    res.status(201).json({
      tokenId: token.tokenId,
      appType: token.appType,
      connectionName: token.connectionName,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt
    });
  } catch (error) {
    logger.error('Failed to store OAuth token:', error);
    res.status(500).json({
      error: 'Failed to store OAuth token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflows/oauth - Get user's OAuth tokens
 */
router.get('/oauth', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = extractUserContext(req);

    const tokens = await tokenService.getUserOAuthTokens(userId, organizationId);

    // Return token info without sensitive data
    res.json({
      tokens: tokens.map(token => ({
        tokenId: token.tokenId,
        appType: token.appType,
        connectionName: token.connectionName,
        scopes: token.scopes,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt
      })),
      count: tokens.length
    });
  } catch (error) {
    logger.error('Failed to get OAuth tokens:', error);
    res.status(500).json({
      error: 'Failed to get OAuth tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;