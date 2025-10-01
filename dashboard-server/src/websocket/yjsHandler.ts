/**
 * Yjs WebSocket Handler for Dashboard Server
 * Enables real-time collaborative workflows with CRDT conflict resolution
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IncomingMessage } from 'http';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

interface YjsDocument {
  doc: Y.Doc;
  awareness: any;
  connections: Set<WebSocket>;
  lastActivity: number;
}

interface YjsHandlerOptions {
  eventBridge?: EventBridgeClient;
  eventBusName?: string;
  gcInterval?: number; // Garbage collection interval in ms
}

export class YjsWebSocketHandler {
  private documents = new Map<string, YjsDocument>();
  private eventBridge?: EventBridgeClient;
  private eventBusName?: string;
  private gcInterval: number;
  private gcTimer?: NodeJS.Timeout;

  constructor(private wss: WebSocketServer, options: YjsHandlerOptions = {}) {
    this.eventBridge = options.eventBridge;
    this.eventBusName = options.eventBusName;
    this.gcInterval = options.gcInterval || 60000; // 1 minute default

    // Start garbage collection for inactive documents
    this.startGarbageCollection();
  }

  /**
   * Handle Yjs WebSocket connection
   */
  handleConnection(ws: WebSocket, req: IncomingMessage, userContext: any) {
    // Extract workflow ID from URL path
    // Expected format: /workflow/{workflowId}
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/');
    const workflowIndex = pathParts.indexOf('workflow');

    if (workflowIndex === -1 || !pathParts[workflowIndex + 1]) {
      console.error('[Yjs] Invalid workflow URL:', req.url);
      ws.close(1008, 'Invalid workflow URL');
      return;
    }

    const workflowId = pathParts[workflowIndex + 1];
    console.log(`[Yjs] Client connecting to workflow: ${workflowId}`);

    // Get or create Yjs document for this workflow
    let yjsDoc = this.documents.get(workflowId);
    if (!yjsDoc) {
      yjsDoc = this.createDocument(workflowId);
    }

    // Add connection
    yjsDoc.connections.add(ws);
    yjsDoc.lastActivity = Date.now();

    // Store metadata on WebSocket
    (ws as any).workflowId = workflowId;
    (ws as any).userContext = userContext;

    console.log(`[Yjs] Client connected to workflow ${workflowId}, total connections: ${yjsDoc.connections.size}`);

    // Set up Yjs message handling
    this.setupYjsSync(ws, yjsDoc);

    // Monitor agent execution queue
    this.monitorExecutionQueue(workflowId, yjsDoc.doc);

    // Handle disconnect
    ws.on('close', () => {
      yjsDoc!.connections.delete(ws);
      console.log(`[Yjs] Client disconnected from workflow ${workflowId}, remaining: ${yjsDoc!.connections.size}`);

      if (yjsDoc!.connections.size === 0) {
        yjsDoc!.lastActivity = Date.now();
      }
    });
  }

  /**
   * Create new Yjs document
   */
  private createDocument(workflowId: string): YjsDocument {
    const doc = new Y.Doc();

    // Initialize shared data structures
    doc.getMap('nodes');
    doc.getArray('edges');
    doc.getArray('executionQueue');
    doc.getMap('metadata');

    const yjsDoc: YjsDocument = {
      doc,
      awareness: null, // Will be set per connection
      connections: new Set(),
      lastActivity: Date.now()
    };

    this.documents.set(workflowId, yjsDoc);

    // Set up persistence observer
    doc.on('update', (update: Uint8Array, origin: any) => {
      // TODO: Persist to DynamoDB/S3 for durability
      // For now, just log
      console.log(`[Yjs] Document ${workflowId} updated (${update.length} bytes)`);
    });

    console.log(`[Yjs] Created new document: ${workflowId}`);
    return yjsDoc;
  }

  /**
   * Set up Yjs sync protocol for WebSocket
   */
  private setupYjsSync(ws: WebSocket, yjsDoc: YjsDocument) {
    const doc = yjsDoc.doc;

    // Handle Yjs sync messages
    ws.on('message', (data: Buffer) => {
      try {
        // Yjs messages are binary
        const message = new Uint8Array(data);

        // Apply update to document
        Y.applyUpdate(doc, message);

        // Broadcast to other connections
        yjsDoc.connections.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });

        yjsDoc.lastActivity = Date.now();
      } catch (error) {
        console.error('[Yjs] Error handling sync message:', error);
      }
    });

    // Send initial state sync
    const stateVector = Y.encodeStateVector(doc);
    const update = Y.encodeStateAsUpdate(doc, stateVector);
    ws.send(update);
  }

  /**
   * Monitor agent execution queue for new tasks
   */
  private monitorExecutionQueue(workflowId: string, doc: Y.Doc) {
    const executionQueue = doc.getArray('executionQueue');

    // Observe queue changes
    executionQueue.observe((event) => {
      event.changes.added.forEach((item) => {
        const task = item.content.getJSON();

        if (task.status === 'queued') {
          console.log(`[Yjs] New agent execution queued:`, task);

          // Send to EventBridge for processing
          this.sendAgentExecutionEvent(task);

          // Update task status to 'pending'
          const tasks = executionQueue.toArray();
          const index = tasks.findIndex((t: any) => t.id === task.id);
          if (index >= 0) {
            doc.transact(() => {
              executionQueue.delete(index, 1);
              executionQueue.insert(index, [{
                ...task,
                status: 'pending'
              }]);
            });
          }
        }
      });
    });
  }

  /**
   * Send agent execution event to EventBridge
   */
  private async sendAgentExecutionEvent(task: any) {
    if (!this.eventBridge || !this.eventBusName) {
      console.warn('[Yjs] EventBridge not configured, skipping event send');
      return;
    }

    try {
      await this.eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'yjs.workflow.execution',
          DetailType: 'agent.execute.requested',
          Detail: JSON.stringify({
            taskId: task.id,
            workflowId: task.workflowId,
            nodeId: task.nodeId,
            agentId: task.agentId,
            model: task.model,
            input: task.input,
            userId: task.userId,
            timestamp: task.timestamp
          }),
          EventBusName: this.eventBusName
        }]
      }));

      console.log(`[Yjs] Sent agent execution event for task ${task.id}`);
    } catch (error) {
      console.error('[Yjs] Failed to send agent execution event:', error);
    }
  }

  /**
   * Handle agent execution completion (called from event subscriber)
   */
  async handleExecutionComplete(event: any) {
    const { taskId, workflowId, result, error } = event;

    const yjsDoc = this.documents.get(workflowId);
    if (!yjsDoc) {
      console.warn(`[Yjs] Workflow ${workflowId} not found for task completion`);
      return;
    }

    const doc = yjsDoc.doc;
    const executionQueue = doc.getArray('executionQueue');
    const tasks = executionQueue.toArray();
    const index = tasks.findIndex((t: any) => t.id === taskId);

    if (index >= 0) {
      const task = tasks[index];
      doc.transact(() => {
        executionQueue.delete(index, 1);
        executionQueue.insert(index, [{
          ...task,
          status: error ? 'failed' : 'completed',
          result,
          error
        }]);
      });

      console.log(`[Yjs] Updated task ${taskId} status to ${error ? 'failed' : 'completed'}`);
    }
  }

  /**
   * Garbage collection: remove inactive documents
   */
  private startGarbageCollection() {
    this.gcTimer = setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      this.documents.forEach((yjsDoc, workflowId) => {
        if (yjsDoc.connections.size === 0 && (now - yjsDoc.lastActivity) > timeout) {
          console.log(`[Yjs] Garbage collecting inactive document: ${workflowId}`);
          yjsDoc.doc.destroy();
          this.documents.delete(workflowId);
        }
      });
    }, this.gcInterval);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    // Destroy all documents
    this.documents.forEach((yjsDoc, workflowId) => {
      console.log(`[Yjs] Destroying document: ${workflowId}`);
      yjsDoc.doc.destroy();
    });

    this.documents.clear();
  }

  /**
   * Get document statistics
   */
  getStats() {
    const stats = {
      totalDocuments: this.documents.size,
      activeConnections: 0,
      documents: [] as any[]
    };

    this.documents.forEach((yjsDoc, workflowId) => {
      stats.activeConnections += yjsDoc.connections.size;
      stats.documents.push({
        workflowId,
        connections: yjsDoc.connections.size,
        lastActivity: new Date(yjsDoc.lastActivity).toISOString(),
        size: yjsDoc.doc.store.clients.size
      });
    });

    return stats;
  }
}
