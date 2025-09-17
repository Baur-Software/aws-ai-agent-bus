export function setupWebSocketHandlers(wss, { metricsAggregator, eventSubscriber }) {

  wss.on('connection', (ws, req) => {
    console.log('📱 Dashboard client connected');

    // Extract userId from connection headers or query params
    const userId = req.headers['x-user-id'] ||
                   new URL(`http://localhost${req.url}`).searchParams.get('userId') ||
                   'anonymous';

    // Store userId on the WebSocket connection
    ws.userId = userId;
    ws.wss = wss; // Reference to the WebSocket server for broadcasting

    console.log(`📱 User ${userId} connected via WebSocket`);

    // Send initial metrics
    sendInitialData(ws, metricsAggregator);

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message, { metricsAggregator, eventSubscriber });
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('📱 Dashboard client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast updates to all connected clients
  const broadcast = (message) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  };

  // Subscribe to events and broadcast updates
  eventSubscriber.onMetricsUpdate((metrics) => {
    broadcast({
      type: 'metrics_update',
      data: metrics
    });
  });

  eventSubscriber.onActivityUpdate((activity) => {
    broadcast({
      type: 'activity_update',
      data: activity
    });
  });

  return { broadcast };
}

// Utility function to broadcast to specific user's connections
function broadcastToUser(wss, userId, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.userId === userId) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  });
}

async function sendInitialData(ws, metricsAggregator) {
  try {
    const [metrics, activity] = await Promise.all([
      metricsAggregator.getAllMetrics(),
      metricsAggregator.getRecentActivity()
    ]);

    ws.send(JSON.stringify({
      type: 'initial_data',
      data: {
        metrics,
        activity
      }
    }));
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}

async function handleWebSocketMessage(ws, message, { metricsAggregator, eventSubscriber }) {
  switch (message.type) {
    case 'subscribe_events':
      await eventSubscriber.subscribe(message.eventTypes);
      ws.send(JSON.stringify({
        type: 'subscription_confirmed',
        eventTypes: message.eventTypes
      }));
      break;

    case 'request_metrics':
      const metrics = await metricsAggregator.getAllMetrics();
      ws.send(JSON.stringify({
        type: 'metrics_response',
        data: metrics
      }));
      break;

    case 'context_switch':
      // Broadcast context switch event to all clients for this user
      const contextSwitchEvent = {
        type: 'context_switched',
        data: {
          userId: message.userId,
          sessionId: message.sessionId,
          fromContextId: message.fromContextId,
          toContextId: message.toContextId,
          contextType: message.contextType,
          timestamp: new Date().toISOString()
        }
      };

      // Broadcast to all clients
      broadcastToUser(ws.wss, message.userId, contextSwitchEvent);

      // Confirm to sender
      ws.send(JSON.stringify({
        type: 'context_switch_confirmed',
        data: contextSwitchEvent.data
      }));
      break;

    case 'session_created':
      // Broadcast new session creation
      const sessionEvent = {
        type: 'session_created',
        data: {
          userId: message.userId,
          sessionId: message.sessionId,
          contextId: message.contextId,
          title: message.title,
          timestamp: new Date().toISOString()
        }
      };

      broadcastToUser(ws.wss, message.userId, sessionEvent);
      break;

    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      }));
  }
}