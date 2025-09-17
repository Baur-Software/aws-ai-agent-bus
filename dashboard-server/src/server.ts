#!/usr/bin/env node

import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// Dashboard-specific imports
import { setupDashboardRoutes } from './routes/dashboard.js';
import { setupWebSocketHandlers } from './websocket/handlers.js';
import { EventSubscriber } from './events/subscriber.js';
import { MetricsAggregator } from './services/metrics.js';
import mcpRoutes from './routes/mcpRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

interface ServerDependencies {
  eventBridge: EventBridgeClient;
  dynamodb: DynamoDBClient;
  s3: S3Client;
  metricsAggregator: MetricsAggregator;
  eventSubscriber: EventSubscriber;
}

const app: Application = express();
const PORT: string | number = process.env.DASHBOARD_PORT || 3001;

// AWS clients
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-west-2' });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// Middleware
app.use(cors({
  origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Create HTTP server
const server: Server = createServer(app);

// WebSocket server for real-time updates
const wss: WebSocketServer = new WebSocketServer({ server });

// Services
const metricsAggregator = new MetricsAggregator(dynamodb, s3);
const eventSubscriber = new EventSubscriber(eventBridge, wss);

// Setup routes
setupDashboardRoutes(app, {
  eventBridge,
  dynamodb,
  s3,
  metricsAggregator,
  eventSubscriber
});

// Setup MCP routes
app.use('/mcp', mcpRoutes);

// Setup workflow routes
app.use('/api/workflows', workflowRoutes);

// Setup chat routes
app.use('/api/chat', chatRoutes);

// Setup MCP context routes (part of chat routes)
app.use('/api/mcp', chatRoutes);

// Setup WebSocket handlers
const { broadcast } = setupWebSocketHandlers(wss, {
  metricsAggregator,
  eventSubscriber
});

// Make WebSocket broadcaster globally available for routes
app.locals.wsBroadcast = broadcast;

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'dashboard-server'
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Dashboard server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard UI should connect to: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available at: ws://localhost:${PORT}`);

  // Initialize event subscriptions
  eventSubscriber.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Dashboard server shutting down...');
  eventSubscriber.stop();
  server.close(() => {
    console.log('✅ Dashboard server stopped');
    process.exit(0);
  });
});