import { Router, Request, Response } from 'express';
import { MCPServiceRegistry } from '../services/MCPServiceRegistry.js';
import AuthMiddleware, { JWTPayload, OrganizationMembership, AuthenticatedRequest } from '../middleware/auth.js';

interface TestRequest extends AuthenticatedRequest {
  body: {
    toolName: string;
    args: Record<string, any>;
    organizationId?: string;
  };
}

/**
 * Create test routes for MCP functionality with authentication
 */
export function createMCPTestRoutes(mcpRegistry: MCPServiceRegistry): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(AuthMiddleware.authenticate);

  /**
   * Test MCP tool execution with organization context
   */
  router.post('/test-tool', async (req: TestRequest, res: Response) => {
    try {
      const { toolName, args, organizationId } = req.body;

      if (!toolName) {
        return res.status(400).json({ error: 'toolName is required' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log(`🧪 Testing MCP tool: ${toolName}`);
      console.log(`📋 Args:`, args);
      console.log(`🏢 Organization:`, organizationId);
      console.log(`👤 User:`, req.user.userId);

      // Create JWT payload from authenticated user
      const userJWT: JWTPayload = {
        userId: req.user.userId,
        email: req.user.email || '',
        name: req.user.name || '',
        organizationMemberships: [{
          orgId: req.user.organizationId,
          orgSlug: req.user.organizationId,
          role: req.user.role === 'admin' ? 'admin' : 'member'
        }],
        personalNamespace: req.user.userId
      };

      // Execute tool with authenticated user context
      const result = await mcpRegistry.executeTool(
        toolName,
        args || {},
        userJWT,
        organizationId || req.user.organizationId
      );

      res.json({
        success: true,
        tool: toolName,
        organizationId,
        result
      });

    } catch (error) {
      console.error('❌ MCP tool test failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * List all available MCP tools
   */
  router.get('/list-tools', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      console.log('📋 Listing available MCP tools...');

      // Create JWT payload from authenticated user
      const userJWT: JWTPayload = {
        userId: req.user.userId,
        email: req.user.email || '',
        name: req.user.name || '',
        organizationMemberships: [{
          orgId: req.user.organizationId,
          orgSlug: req.user.organizationId,
          role: req.user.role === 'admin' ? 'admin' : 'member'
        }],
        personalNamespace: req.user.userId
      };

      const tools = await mcpRegistry.listAllTools(userJWT);

      res.json({
        success: true,
        toolCount: tools.length,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          serverName: (tool as any).serverName
        }))
      });

    } catch (error) {
      console.error('❌ Failed to list MCP tools:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Test AWS CLI specifically with organization context
   */
  router.post('/test-aws', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { service_name = 'sts', operation_name = 'get-caller-identity', organizationId } = req.body;

      console.log(`🧪 Testing AWS CLI MCP: ${service_name} ${operation_name}`);
      console.log(`🏢 Organization:`, organizationId || req.user.organizationId);

      // Create JWT payload from authenticated user
      const userJWT: JWTPayload = {
        userId: req.user.userId,
        email: req.user.email || '',
        name: req.user.name || '',
        organizationMemberships: [{
          orgId: req.user.organizationId,
          orgSlug: req.user.organizationId,
          role: req.user.role === 'admin' ? 'admin' : 'member'
        }],
        personalNamespace: req.user.userId
      };

      const result = await mcpRegistry.executeTool(
        'use_aws',
        {
          service_name,
          operation_name,
          region: 'us-west-2'
        },
        userJWT,
        organizationId || req.user.organizationId
      );

      res.json({
        success: true,
        service: service_name,
        operation: operation_name,
        organizationId,
        result
      });

    } catch (error) {
      console.error('❌ AWS CLI MCP test failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get MCP server health status
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await mcpRegistry.getHealthStatus();

      res.json({
        success: true,
        servers: health
      });

    } catch (error) {
      console.error('❌ Failed to get MCP health status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createMCPTestRoutes;