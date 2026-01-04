import { Router, Request, Response } from 'express';
import multer from 'multer';
import MCPServiceFactory from '../services/MCPServiceFactory.js';
import { Logger } from '../utils/Logger.js';

const router = Router();
const logger = new Logger('ArtifactsRoutes');

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /artifacts/upload - Upload a file to S3 via MCP
 * Accepts multipart/form-data with file field
 * Optional: key field to override filename
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).send({ error: 'No file uploaded' });
      return;
    }

    const file = req.file;
    const key = req.body.key || file.originalname;

    // Always convert to base64 - MCP server expects base64
    const content = file.buffer.toString('base64');

    logger.info(`Uploading file: ${key}, size: ${file.size}, type: ${file.mimetype}`);

    // Call MCP artifacts_put tool
    const mcpService = MCPServiceFactory.getInstance();
    const result = await mcpService.executeTool('artifacts_put', {
      key,
      content,
      content_type: file.mimetype || 'application/octet-stream',
    });

    // Use res.end() with JSON string to avoid Express mime issues
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({
      success: true,
      key,
      size: file.size,
      contentType: file.mimetype,
      result,
    }));
  } catch (error) {
    logger.error('File upload failed:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).end(JSON.stringify({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
});

/**
 * GET /artifacts/list - List artifacts with optional prefix
 */
router.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const prefix = req.query.prefix as string || '';

    const mcpService = MCPServiceFactory.getInstance();
    const result = await mcpService.executeTool('artifacts_list', { prefix });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify(result));
  } catch (error) {
    logger.error('Failed to list artifacts:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).end(JSON.stringify({
      error: 'Failed to list artifacts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
});

/**
 * GET /artifacts/:key - Get artifact content
 */
router.get('/:key(*)', async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key;

    const mcpService = MCPServiceFactory.getInstance();
    const result = await mcpService.executeTool('artifacts_get', { key });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify(result));
  } catch (error) {
    logger.error(`Failed to get artifact ${req.params.key}:`, error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).end(JSON.stringify({
      error: 'Failed to get artifact',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
});

export default router;
