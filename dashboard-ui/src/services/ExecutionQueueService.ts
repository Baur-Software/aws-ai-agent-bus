/**
 * Execution Queue Service
 * Manages Web Worker for processing agent execution queue
 */

import { createSignal } from 'solid-js';

export class ExecutionQueueService {
  private worker: Worker | null = null;
  private dashboardServer: any;

  constructor(dashboardServer: any) {
    this.dashboardServer = dashboardServer;
  }

  /**
   * Initialize and start the worker
   */
  async start(workflowId: string, userId: string): Promise<void> {
    // Create worker
    this.worker = new Worker(
      new URL('../workers/executionQueue.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle worker messages
    this.worker.onmessage = (event) => {
      this.handleWorkerMessage(event.data);
    };

    this.worker.onerror = (error) => {
      console.error('[ExecutionQueue] Worker error:', error);
    };

    // Initialize worker
    this.worker.postMessage({
      type: 'init',
      workflowId,
      userId
    });

    // Wait for initialization
    await new Promise<void>((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'initialized') {
          this.worker?.removeEventListener('message', handler);
          resolve();
        }
      };
      this.worker?.addEventListener('message', handler);
    });

    // Start processing
    this.worker.postMessage({ type: 'start' });

    console.log(`[ExecutionQueue] Started for workflow ${workflowId}`);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
      console.log('[ExecutionQueue] Stopped');
    }
  }

  /**
   * Handle messages from worker
   */
  private async handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'task_processing':
        console.log('[ExecutionQueue] Processing task:', data.task.id);
        break;

      case 'send_event':
        // Forward event to dashboard server
        try {
          await this.dashboardServer.sendEvent(data.event);
          console.log('[ExecutionQueue] Sent event for task:', data.event.detail.taskId);
        } catch (error) {
          console.error('[ExecutionQueue] Failed to send event:', error);
        }
        break;

      case 'task_sent':
        console.log('[ExecutionQueue] Task sent:', data.taskId);
        break;

      case 'task_error':
        console.error('[ExecutionQueue] Task error:', data.taskId, data.error);
        break;

      case 'error':
        console.error('[ExecutionQueue] Worker error:', data.message);
        break;

      case 'initialized':
        console.log('[ExecutionQueue] Initialized');
        break;

      case 'started':
        console.log('[ExecutionQueue] Started processing');
        break;

      case 'stopped':
        console.log('[ExecutionQueue] Stopped processing');
        break;
    }
  }
}

/**
 * SolidJS hook for execution queue service
 */
export function useExecutionQueue(dashboardServer: any) {
  const [service] = createSignal(new ExecutionQueueService(dashboardServer));
  return service();
}
