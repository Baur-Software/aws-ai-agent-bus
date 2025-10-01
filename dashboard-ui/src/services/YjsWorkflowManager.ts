/**
 * Yjs Workflow Manager
 * Handles multiplayer collaborative workflows with offline support
 *
 * Features:
 * - CRDT-based conflict resolution
 * - IndexedDB persistence for offline work
 * - WebSocket sync via dashboard-server
 * - Agent execution queue with event integration
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { createSignal, onCleanup } from 'solid-js';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AgentExecutionTask {
  id: string;
  type: 'agent.execute';
  agentId: string;
  model: string;
  input: any;
  status: 'queued' | 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
  userId: string;
  workflowId: string;
  nodeId: string;
}

export class YjsWorkflowManager {
  private ydoc: Y.Doc;
  private indexeddbProvider?: IndexeddbPersistence;
  private wsProvider?: WebsocketProvider;

  // Shared data structures
  public nodes: Y.Map<WorkflowNode>;
  public edges: Y.Array<WorkflowEdge>;
  public executionQueue: Y.Array<AgentExecutionTask>;
  public metadata: Y.Map<any>;

  // Awareness (cursors, selections)
  public awareness?: any;

  constructor(
    public workflowId: string,
    private wsUrl: string,
    private userId: string
  ) {
    // Create Yjs document
    this.ydoc = new Y.Doc();

    // Initialize shared data structures
    this.nodes = this.ydoc.getMap('nodes');
    this.edges = this.ydoc.getArray('edges');
    this.executionQueue = this.ydoc.getArray('executionQueue');
    this.metadata = this.ydoc.getMap('metadata');
  }

  /**
   * Connect to persistence and sync providers
   */
  async connect(): Promise<void> {
    // IndexedDB for offline persistence
    this.indexeddbProvider = new IndexeddbPersistence(
      `workflow-${this.workflowId}`,
      this.ydoc
    );

    // Wait for IndexedDB to load
    await new Promise<void>((resolve) => {
      this.indexeddbProvider!.on('synced', () => {
        console.log('[Yjs] IndexedDB synced');
        resolve();
      });
    });

    // WebSocket provider for real-time sync
    this.wsProvider = new WebsocketProvider(
      this.wsUrl,
      `workflow-${this.workflowId}`,
      this.ydoc,
      {
        connect: true,
        // Add authentication
        params: {
          userId: this.userId
        }
      }
    );

    this.awareness = this.wsProvider.awareness;

    // Set local user awareness state
    this.awareness.setLocalStateField('user', {
      userId: this.userId,
      name: this.userId, // TODO: Get from auth context
      color: this.generateUserColor(this.userId),
      cursor: null
    });

    this.wsProvider.on('status', (event: any) => {
      console.log('[Yjs] WebSocket status:', event.status);
    });

    this.wsProvider.on('sync', (synced: boolean) => {
      console.log('[Yjs] Synced with server:', synced);
    });
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.wsProvider?.disconnect();
    this.wsProvider?.destroy();
    this.indexeddbProvider?.destroy();
    this.ydoc.destroy();
  }

  // ===== Node Operations =====

  addNode(node: WorkflowNode): void {
    this.ydoc.transact(() => {
      this.nodes.set(node.id, node);
    });
  }

  updateNode(nodeId: string, updates: Partial<WorkflowNode>): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.ydoc.transact(() => {
        this.nodes.set(nodeId, { ...node, ...updates });
      });
    }
  }

  deleteNode(nodeId: string): void {
    this.ydoc.transact(() => {
      this.nodes.delete(nodeId);

      // Remove associated edges
      const edgesToRemove: number[] = [];
      this.edges.forEach((edge, index) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          edgesToRemove.push(index);
        }
      });

      // Delete in reverse order to maintain indices
      edgesToRemove.reverse().forEach(index => {
        this.edges.delete(index, 1);
      });
    });
  }

  getNode(nodeId: string): WorkflowNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): WorkflowNode[] {
    return Array.from(this.nodes.values());
  }

  // ===== Edge Operations =====

  addEdge(edge: WorkflowEdge): void {
    this.ydoc.transact(() => {
      this.edges.push([edge]);
    });
  }

  deleteEdge(edgeId: string): void {
    const index = this.edges.toArray().findIndex(e => e.id === edgeId);
    if (index >= 0) {
      this.edges.delete(index, 1);
    }
  }

  getAllEdges(): WorkflowEdge[] {
    return this.edges.toArray();
  }

  // ===== Agent Execution Queue =====

  queueAgentExecution(task: Omit<AgentExecutionTask, 'id' | 'timestamp' | 'userId' | 'workflowId'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullTask: AgentExecutionTask = {
      ...task,
      id: taskId,
      timestamp: Date.now(),
      userId: this.userId,
      workflowId: this.workflowId
    };

    this.ydoc.transact(() => {
      this.executionQueue.push([fullTask]);
    });

    return taskId;
  }

  updateTaskStatus(
    taskId: string,
    status: AgentExecutionTask['status'],
    result?: any,
    error?: string
  ): void {
    const tasks = this.executionQueue.toArray();
    const index = tasks.findIndex(t => t.id === taskId);

    if (index >= 0) {
      const task = tasks[index];
      this.ydoc.transact(() => {
        this.executionQueue.delete(index, 1);
        this.executionQueue.insert(index, [{
          ...task,
          status,
          result,
          error
        }]);
      });
    }
  }

  getTask(taskId: string): AgentExecutionTask | undefined {
    return this.executionQueue.toArray().find(t => t.id === taskId);
  }

  getPendingTasks(): AgentExecutionTask[] {
    return this.executionQueue.toArray().filter(t =>
      t.status === 'queued' || t.status === 'pending'
    );
  }

  // ===== Observability =====

  onNodesChange(callback: (nodes: WorkflowNode[]) => void): () => void {
    const observer = () => {
      callback(this.getAllNodes());
    };

    this.nodes.observe(observer);

    return () => {
      this.nodes.unobserve(observer);
    };
  }

  onEdgesChange(callback: (edges: WorkflowEdge[]) => void): () => void {
    const observer = () => {
      callback(this.getAllEdges());
    };

    this.edges.observe(observer);

    return () => {
      this.edges.unobserve(observer);
    };
  }

  onQueueChange(callback: (tasks: AgentExecutionTask[]) => void): () => void {
    const observer = () => {
      callback(this.executionQueue.toArray());
    };

    this.executionQueue.observe(observer);

    return () => {
      this.executionQueue.unobserve(observer);
    };
  }

  onAwarenessChange(callback: (states: Map<number, any>) => void): () => void {
    if (!this.awareness) {
      console.warn('[Yjs] Awareness not initialized');
      return () => {};
    }

    const handler = () => {
      callback(this.awareness.getStates());
    };

    this.awareness.on('change', handler);

    return () => {
      this.awareness.off('change', handler);
    };
  }

  // ===== Utilities =====

  private generateUserColor(userId: string): string {
    // Generate consistent color from userId
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  /**
   * Export workflow to JSON (for backup/sharing)
   */
  exportWorkflow(): { nodes: WorkflowNode[]; edges: WorkflowEdge[]; metadata: any } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      metadata: Object.fromEntries(this.metadata.entries())
    };
  }

  /**
   * Import workflow from JSON
   */
  importWorkflow(data: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; metadata?: any }): void {
    this.ydoc.transact(() => {
      // Clear existing data
      this.nodes.clear();
      this.edges.delete(0, this.edges.length);

      // Import nodes
      data.nodes.forEach(node => {
        this.nodes.set(node.id, node);
      });

      // Import edges
      this.edges.push(data.edges);

      // Import metadata
      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          this.metadata.set(key, value);
        });
      }
    });
  }
}

/**
 * SolidJS hook for using Yjs workflow manager
 */
export function useYjsWorkflow(
  workflowId: string,
  wsUrl: string,
  userId: string
) {
  const [manager] = createSignal(
    new YjsWorkflowManager(workflowId, wsUrl, userId)
  );

  const [synced, setSynced] = createSignal(false);
  const [connected, setConnected] = createSignal(false);

  // Connect on mount
  (async () => {
    await manager().connect();
    setSynced(true);
  })();

  // Monitor WebSocket connection status
  if (manager().wsProvider) {
    manager().wsProvider!.on('status', (event: any) => {
      setConnected(event.status === 'connected');
    });
  }

  // Cleanup on unmount
  onCleanup(() => {
    manager().disconnect();
  });

  return {
    manager: manager(),
    synced,
    connected
  };
}
