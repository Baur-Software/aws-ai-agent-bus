import { Router, Request, Response } from 'express';
import KVHandler from '../handlers/kv.js';
import { Logger } from '../utils/Logger.js';

const router = Router();
const logger = new Logger('KVRoutes');

/**
 * GET /api/kv/:key - Get a value from KV store
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const result = await KVHandler.get({ key });

    if (result.value === null) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json({ key, value: result.value });
  } catch (error) {
    logger.error(`Failed to get KV key '${req.params.key}':`, error);
    res.status(500).json({
      error: 'Failed to get KV pair',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/kv/:key - Set a value in KV store
 */
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, ttl_hours = 24 } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const result = await KVHandler.set({ key, value, ttl_hours });

    if (result.success) {
      res.json({ success: true, key, message: 'Value stored successfully' });
    } else {
      res.status(500).json({ error: 'Failed to store value', warning: result.warning });
    }
  } catch (error) {
    logger.error(`Failed to set KV key '${req.params.key}':`, error);
    res.status(500).json({
      error: 'Failed to set KV pair',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/kv/:key - Delete a value from KV store
 */
router.delete('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // Delete by setting to null with minimal TTL
    const result = await KVHandler.set({ key, value: null, ttl_hours: 0.001 });

    if (result.success) {
      res.json({ success: true, key, message: 'Value deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete value', warning: result.warning });
    }
  } catch (error) {
    logger.error(`Failed to delete KV key '${req.params.key}':`, error);
    res.status(500).json({
      error: 'Failed to delete KV pair',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/kv/batch - Batch operations
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations array is required' });
    }

    const results = [];

    for (const op of operations) {
      try {
        if (op.operation === 'set') {
          const result = await KVHandler.set({
            key: op.key,
            value: op.value,
            ttl_hours: op.ttl_hours || 24
          });
          results.push({ key: op.key, success: result.success });
        } else if (op.operation === 'get') {
          const result = await KVHandler.get({ key: op.key });
          results.push({ key: op.key, value: result.value });
        }
      } catch (error) {
        results.push({
          key: op.key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({ results });
  } catch (error) {
    logger.error('Failed to execute batch KV operations:', error);
    res.status(500).json({
      error: 'Failed to execute batch operations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;