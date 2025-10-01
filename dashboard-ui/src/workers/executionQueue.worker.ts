/**
 * Execution Queue Worker
 * Processes agent execution tasks from Yjs queue and sends to EventBridge
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

interface WorkerMessage {
  type: 'init' | 'start' | 'stop';
  workflowId?: string;
  wsUrl?: string;
  userId?: string;
}

let ydoc: Y.Doc | null = null;
let indexeddbProvider: IndexeddbPersistence | null = null;
let processingInterval: number | null = null;
let isProcessing = false;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, workflowId, wsUrl, userId } = event.data;

  switch (type) {
    case 'init':
      if (!workflowId || !userId) {
        self.postMessage({ type: 'error', message: 'workflowId and userId required' });
        return;
      }

      // Initialize Yjs document
      ydoc = new Y.Doc();

      // IndexedDB persistence
      indexeddbProvider = new IndexeddbPersistence(`workflow-${workflowId}`, ydoc);

      await new Promise<void>((resolve) => {
        indexeddbProvider!.on('synced', () => {
          self.postMessage({ type: 'initialized', workflowId });
          resolve();
        });
      });

      break;

    case 'start':
      if (!ydoc) {
        self.postMessage({ type: 'error', message: 'Worker not initialized' });
        return;
      }

      isProcessing = true;
      self.postMessage({ type: 'started' });

      // Start processing queue
      startProcessing();
      break;

    case 'stop':
      isProcessing = false;
      if (processingInterval) {
        clearInterval(processingInterval);
        processingInterval = null;
      }
      self.postMessage({ type: 'stopped' });
      break;
  }
};

function startProcessing() {
  if (!ydoc) return;

  const executionQueue = ydoc.getArray('executionQueue');

  // Process queue every 500ms
  processingInterval = setInterval(() => {
    if (!isProcessing || !ydoc) return;

    const tasks = executionQueue.toArray();
    const queuedTasks = tasks.filter((t: any) => t.status === 'queued');

    queuedTasks.forEach((task: any) => {
      processTask(task);
    });
  }, 500) as unknown as number;
}

async function processTask(task: any) {
  self.postMessage({
    type: 'task_processing',
    task
  });

  try {
    // Send task to backend via main thread
    // Main thread will handle the actual HTTP/WebSocket communication
    self.postMessage({
      type: 'send_event',
      event: {
        detailType: 'agent.execute.requested',
        source: 'execution-queue-worker',
        detail: {
          taskId: task.id,
          workflowId: task.workflowId,
          nodeId: task.nodeId,
          agentId: task.agentId,
          model: task.model,
          input: task.input,
          userId: task.userId,
          timestamp: task.timestamp
        }
      }
    });

    self.postMessage({
      type: 'task_sent',
      taskId: task.id
    });
  } catch (error) {
    self.postMessage({
      type: 'task_error',
      taskId: task.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle cleanup
self.onclose = () => {
  if (processingInterval) {
    clearInterval(processingInterval);
  }
  indexeddbProvider?.destroy();
  ydoc?.destroy();
};
