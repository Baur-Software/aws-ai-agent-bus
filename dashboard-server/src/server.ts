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
import { MCPServiceRegistry } from './services/MCPServiceRegistry.js';
import { DEFAULT_MCP_SERVERS, getMCPServerConfig } from './config/mcpServers.js';
import mcpRoutes from './routes/mcpRoutes.js';
import { createMCPTestRoutes } from './routes/mcpTestRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import kvRoutes from './routes/kvRoutes.js';
import { setupAuthRoutes } from './routes/authRoutes.js';
import { profile } from 'console';

interface ServerDependencies {
  eventBridge: EventBridgeClient;
  dynamodb: DynamoDBClient;
  s3: S3Client;
  metricsAggregator: MetricsAggregator;
  eventSubscriber: EventSubscriber;
  mcpRegistry: MCPServiceRegistry;
}

const app: Application = express();
const PORT: string | number = process.env.DASHBOARD_PORT || 3001;

// AWS client configuration (AWS SDK will automatically use AWS_PROFILE from environment)
const awsConfig = {
  profile: process.env.AWS_PROFILE,
  region: process.env.AWS_REGION || 'us-west-2'
};

// AWS clients
const eventBridge = new EventBridgeClient(awsConfig);
const dynamodb = new DynamoDBClient(awsConfig);
const s3 = new S3Client(awsConfig);

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
const mcpRegistry = new MCPServiceRegistry();

// Initialize MCP servers
async function initializeMCPServers() {
  console.log('🔧 Initializing MCP servers...');

  for (const serverName of DEFAULT_MCP_SERVERS) {
    try {
      const config = getMCPServerConfig(serverName);
      if (config) {
        await mcpRegistry.registerServer(serverName, config);
        console.log(`✅ Registered MCP server: ${serverName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to register MCP server '${serverName}':`, error);
    }
  }
}

// Dependencies object
const dependencies: ServerDependencies = {
  eventBridge,
  dynamodb,
  s3,
  metricsAggregator,
  eventSubscriber,
  mcpRegistry
};

// Setup routes
setupDashboardRoutes(app, dependencies);

// Setup MCP routes
app.use('/mcp', mcpRoutes);

// Setup MCP test routes
app.use('/api/mcp-test', createMCPTestRoutes(mcpRegistry));

// Setup KV routes
app.use('/api/kv', kvRoutes);

// Setup workflow routes
app.use('/api/workflows', workflowRoutes);

// Setup chat routes
app.use('/api/chat', chatRoutes);

// Setup MCP context routes (part of chat routes)
app.use('/api/mcp', chatRoutes);

// Setup auth routes
app.use('/api/auth', setupAuthRoutes({ dynamodb, eventBridge }));

// Setup WebSocket handlers
const { broadcast, cleanup: cleanupWebSocket } = setupWebSocketHandlers(wss, {
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
server.listen(PORT, async () => {
  console.log(`🚀 Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard UI should connect to: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket available at: ws://localhost:${PORT}`);

  // Initialize MCP servers
  await initializeMCPServers();

  // Initialize event subscriptions
  eventSubscriber.start();
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`📴 Dashboard server shutting down (${signal})...`);

  try {
    // Stop event subscriber
    eventSubscriber.stop();

    // Clean up WebSocket connections
    await cleanupWebSocket();

    // Disconnect MCP servers
    await mcpRegistry.disconnect();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('✅ Dashboard server stopped');
        resolve();
      });
    });
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  } finally {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});