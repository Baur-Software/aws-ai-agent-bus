import { Router, Request, Response } from 'express';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import AuthMiddleware, { AuthenticatedRequest } from '../middleware/auth.js';
import crypto from 'crypto';
import { Logger } from '../utils/Logger.js';

interface WebhookDependencies {
  dynamodb: DynamoDBClient;
  eventBridge: EventBridgeClient;
}

interface WebhookConfig {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
  triggers: string[];
  createdAt: string;
  updatedAt: string;
}

interface WebhookPayload {
  workflowId: string;
  triggerId: string;
  data: any;
  timestamp: string;
  signature: string;
}

export function setupWebhookRoutes(deps: WebhookDependencies): Router {
  const router = Router();
  const logger = new Logger('WebhookRoutes');

  // Store webhook configurations (in production, use DynamoDB)
  const webhookConfigs = new Map<string, WebhookConfig>();

  /**
   * Create new webhook endpoint
   */
  router.post('/', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, triggers, workflowId } = req.body;

      if (!name || !triggers || !Array.isArray(triggers)) {
        return res.status(400).json({ error: 'Name and triggers array are required' });
      }

      const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const secret = crypto.randomBytes(32).toString('hex');
      const url = `/api/webhooks/${webhookId}/trigger`;

      const config: WebhookConfig = {
        id: webhookId,
        userId: req.user!.userId,
        organizationId: req.user!.organizationId || '',
        name,
        url,
        secret,
        enabled: true,
        triggers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      webhookConfigs.set(webhookId, config);

      logger.info(`Created webhook: ${webhookId} for user: ${req.user!.userId}`);

      res.status(201).json({
        id: webhookId,
        name,
        url: `${req.protocol}://${req.get('host')}${url}`,
        secret,
        triggers,
        enabled: true,
        createdAt: config.createdAt
      });
    } catch (error) {
      logger.error('Failed to create webhook:', error);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  /**
   * Get user's webhooks
   */
  router.get('/', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userWebhooks = Array.from(webhookConfigs.values())
        .filter(config => config.userId === req.user!.userId)
        .map(config => ({
          id: config.id,
          name: config.name,
          url: `${req.protocol}://${req.get('host')}${config.url}`,
          triggers: config.triggers,
          enabled: config.enabled,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }));

      res.json({ webhooks: userWebhooks });
    } catch (error) {
      logger.error('Failed to get webhooks:', error);
      res.status(500).json({ error: 'Failed to get webhooks' });
    }
  });

  /**
   * Update webhook configuration
   */
  router.put('/:webhookId', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { webhookId } = req.params;
      const { name, triggers, enabled } = req.body;

      const config = webhookConfigs.get(webhookId);
      if (!config || config.userId !== req.user!.userId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      // Update configuration
      if (name !== undefined) config.name = name;
      if (triggers !== undefined) config.triggers = triggers;
      if (enabled !== undefined) config.enabled = enabled;
      config.updatedAt = new Date().toISOString();

      webhookConfigs.set(webhookId, config);

      res.json({
        id: config.id,
        name: config.name,
        url: `${req.protocol}://${req.get('host')}${config.url}`,
        triggers: config.triggers,
        enabled: config.enabled,
        updatedAt: config.updatedAt
      });
    } catch (error) {
      logger.error('Failed to update webhook:', error);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  });

  /**
   * Delete webhook
   */
  router.delete('/:webhookId', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { webhookId } = req.params;

      const config = webhookConfigs.get(webhookId);
      if (!config || config.userId !== req.user!.userId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      webhookConfigs.delete(webhookId);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  /**
   * Webhook trigger endpoint (public, no auth required)
   */
  router.post('/:webhookId/trigger', async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;
      const payload = req.body;

      const config = webhookConfigs.get(webhookId);
      if (!config || !config.enabled) {
        return res.status(404).json({ error: 'Webhook not found or disabled' });
      }

      // Verify webhook signature if provided
      const signature = req.headers['x-webhook-signature'] as string;
      if (signature && config.secret) {
        const expectedSignature = crypto
          .createHmac('sha256', config.secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        if (signature !== `sha256=${expectedSignature}`) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Create webhook event
      const webhookEvent = {
        type: 'webhook_triggered',
        data: {
          webhookId,
          webhookName: config.name,
          userId: config.userId,
          organizationId: config.organizationId,
          payload,
          timestamp: new Date().toISOString(),
          triggers: config.triggers
        }
      };

      // Broadcast to WebSocket clients
      if (req.app.locals.wsBroadcast) {
        req.app.locals.wsBroadcast(webhookEvent);
      }

      // Process triggers
      for (const triggerType of config.triggers) {
        await processTrigger(triggerType, payload, config, deps);
      }

      logger.info(`Webhook triggered: ${webhookId} for user: ${config.userId}`);

      res.json({
        success: true,
        webhookId,
        triggersProcessed: config.triggers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to process webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  /**
   * Test webhook endpoint
   */
  router.post('/:webhookId/test', AuthMiddleware.authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { webhookId } = req.params;
      const testPayload = req.body.payload || { test: true, timestamp: new Date().toISOString() };

      const config = webhookConfigs.get(webhookId);
      if (!config || config.userId !== req.user!.userId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      // Create test event
      const testEvent = {
        type: 'webhook_test',
        data: {
          webhookId,
          webhookName: config.name,
          userId: config.userId,
          organizationId: config.organizationId,
          payload: testPayload,
          timestamp: new Date().toISOString(),
          isTest: true
        }
      };

      // Broadcast to WebSocket clients
      if (req.app.locals.wsBroadcast) {
        req.app.locals.wsBroadcast(testEvent);
      }

      logger.info(`Webhook test triggered: ${webhookId} for user: ${req.user!.userId}`);

      res.json({
        success: true,
        message: 'Test webhook triggered successfully',
        payload: testPayload
      });
    } catch (error) {
      logger.error('Failed to test webhook:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  });

  return router;
}

/**
 * Process different trigger types
 */
async function processTrigger(
  triggerType: string,
  payload: any,
  config: WebhookConfig,
  deps: WebhookDependencies
): Promise<void> {
  const logger = new Logger('TriggerProcessor');

  try {
    switch (triggerType) {
      case 'workflow_start':
        await processWorkflowStartTrigger(payload, config, deps);
        break;
      case 'event_send':
        await processEventSendTrigger(payload, config, deps);
        break;
      case 'notification_send':
        await processNotificationTrigger(payload, config, deps);
        break;
      default:
        logger.warn(`Unknown trigger type: ${triggerType}`);
    }
  } catch (error) {
    logger.error(`Failed to process trigger ${triggerType}:`, error);
  }
}

async function processWorkflowStartTrigger(
  payload: any,
  config: WebhookConfig,
  deps: WebhookDependencies
): Promise<void> {
  // Start a workflow with the webhook payload
  // This would integrate with your workflow engine
  const logger = new Logger('WorkflowTrigger');

  logger.info(`Starting workflow for webhook ${config.id} with payload:`, payload);

  // TODO: Integrate with workflow engine to start execution
}

async function processEventSendTrigger(
  payload: any,
  config: WebhookConfig,
  deps: WebhookDependencies
): Promise<void> {
  // Send event to EventBridge
  const logger = new Logger('EventTrigger');

  logger.info(`Sending event for webhook ${config.id}`);

  // TODO: Send event to EventBridge
}

async function processNotificationTrigger(
  payload: any,
  config: WebhookConfig,
  deps: WebhookDependencies
): Promise<void> {
  // Send notification
  const logger = new Logger('NotificationTrigger');

  logger.info(`Sending notification for webhook ${config.id}`);

  // TODO: Send notification via SNS or other service
}

export default setupWebhookRoutes;