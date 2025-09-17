import { Application, Request, Response, Router } from 'express';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { MetricsAggregator } from '../services/metrics.js';
import { EventSubscriber } from '../events/subscriber.js';

interface RoutesDependencies {
  eventBridge: EventBridgeClient;
  dynamodb: DynamoDBClient;
  s3: S3Client;
  metricsAggregator: MetricsAggregator;
  eventSubscriber: EventSubscriber;
}

export function setupDashboardRoutes(app: Application, deps: RoutesDependencies): void {
  const router = Router();

  // Dashboard metrics endpoint
  router.get('/api/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await deps.metricsAggregator.getAllMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // KV store metrics
  router.get('/api/metrics/kv', async (req: Request, res: Response) => {
    try {
      const kvMetrics = await deps.metricsAggregator.getKVMetrics();
      res.json(kvMetrics);
    } catch (error) {
      console.error('Error fetching KV metrics:', error);
      res.status(500).json({ error: 'Failed to fetch KV metrics' });
    }
  });

  // Artifacts metrics
  router.get('/api/metrics/artifacts', async (req: Request, res: Response) => {
    try {
      const artifactsMetrics = await deps.metricsAggregator.getArtifactsMetrics();
      res.json(artifactsMetrics);
    } catch (error) {
      console.error('Error fetching artifacts metrics:', error);
      res.status(500).json({ error: 'Failed to fetch artifacts metrics' });
    }
  });

  // Recent activity
  router.get('/api/activity', async (req: Request, res: Response) => {
    try {
      const activity = await deps.metricsAggregator.getRecentActivity();
      res.json(activity);
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  // Subscribe to events
  router.post('/api/events/subscribe', async (req: Request, res: Response) => {
    try {
      const { eventTypes }: { eventTypes: string[] } = req.body;
      await deps.eventSubscriber.subscribe(eventTypes);
      res.json({ success: true });
    } catch (error) {
      console.error('Error subscribing to events:', error);
      res.status(500).json({ error: 'Failed to subscribe to events' });
    }
  });

  app.use(router);
}