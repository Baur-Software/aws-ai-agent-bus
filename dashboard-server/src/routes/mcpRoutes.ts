import { Router, Request, Response } from 'express';
import MCPServiceFactory from '../services/MCPServiceFactory.js';
import { Logger } from '../utils/Logger.js';

const router = Router();
const logger = new Logger('MCPRoutes');

/**
 * GET /mcp/tools - List available MCP tools
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const mcpService = MCPServiceFactory.getInstance();
    const result = await mcpService.listTools();

    res.json(result);
  } catch (error) {
    logger.error('Failed to list MCP tools:', error);
    res.status(500).json({
      error: 'Failed to list MCP tools',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /mcp/call - Execute an MCP tool
 */
router.post('/call', async (req: Request, res: Response) => {
  try {
    const { name, arguments: args = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const mcpService = MCPServiceFactory.getInstance();
    const result = await mcpService.executeTool(name, args);

    res.json(result);
  } catch (error) {
    logger.error(`Failed to execute MCP tool '${req.body.name}':`, error);
    res.status(500).json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /mcp - JSON-RPC endpoint for MCP protocol compatibility
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { method, params, id = 1 } = req.body;

    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Method is required' }
      });
    }

    const mcpService = MCPServiceFactory.getInstance();
    let result;

    switch (method) {
      case 'tools/list':
        result = await mcpService.listTools();
        break;

      case 'tools/call':
        if (!params?.name) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Tool name is required in params' }
          });
        }
        result = await mcpService.executeTool(
          params.name,
          params.arguments || {}
        );
        break;

      default:
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
    }

    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
  } catch (error) {
    logger.error('MCP JSON-RPC error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || 1,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /mcp/health - Health check for MCP service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const mcpService = MCPServiceFactory.getInstance();
    const health = mcpService.getHealth ? await mcpService.getHealth() : {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };

    res.json({
      ...health,
      service: 'mcp-bridge',
      version: '1.0.0',
      transport: process.env.NODE_ENV === 'production' ? 'eventbridge' : 'stdio'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup on process exit
process.on('SIGTERM', () => {
  MCPServiceFactory.getInstance().cleanup();
});

process.on('SIGINT', () => {
  MCPServiceFactory.getInstance().cleanup();
});

export default router;