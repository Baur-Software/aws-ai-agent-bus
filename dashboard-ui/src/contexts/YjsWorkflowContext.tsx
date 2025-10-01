/**
 * Yjs Workflow Context
 * Replaces WorkflowContext with Yjs-backed collaborative state
 */

import { createContext, useContext, createSignal, onCleanup, JSX, createEffect } from 'solid-js';
import { YjsWorkflowManager, type WorkflowNode, type WorkflowEdge } from '../services/YjsWorkflowManager';
import { useAuth } from './AuthContext';

interface YjsWorkflowContextValue {
  manager: YjsWorkflowManager | null;
  nodes: () => WorkflowNode[];
  edges: () => WorkflowEdge[];
  synced: () => boolean;
  connected: () => boolean;

  // Node operations
  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  deleteNode: (nodeId: string) => void;

  // Edge operations
  addEdge: (edge: WorkflowEdge) => void;
  deleteEdge: (edgeId: string) => void;

  // Agent execution
  queueAgentExecution: (task: any) => string;

  // Awareness (other users)
  awareness: () => Map<number, any>;
}

const YjsWorkflowContext = createContext<YjsWorkflowContextValue>();

export function YjsWorkflowProvider(props: {
  workflowId: string;
  wsUrl?: string;
  children: JSX.Element;
}) {
  const { user } = useAuth();
  const currentUser = user();

  if (!currentUser) {
    throw new Error('User must be authenticated to use collaborative workflows');
  }

  // Signals for reactive state
  const [nodes, setNodes] = createSignal<WorkflowNode[]>([]);
  const [edges, setEdges] = createSignal<WorkflowEdge[]>([]);
  const [synced, setSynced] = createSignal(false);
  const [connected, setConnected] = createSignal(false);
  const [awareness, setAwareness] = createSignal<Map<number, any>>(new Map());
  const [manager, setManager] = createSignal<YjsWorkflowManager | null>(null);

  // Initialize Yjs manager
  const wsUrl = props.wsUrl || `ws://localhost:3001/workflow/${props.workflowId}`;

  // Create manager immediately
  const mgr = new YjsWorkflowManager(
    props.workflowId,
    wsUrl,
    currentUser.userId
  );
  setManager(mgr);

  // Connect asynchronously
  mgr.connect().then(() => {
    setSynced(true);

    // Subscribe to changes with cleanup
    const unsubNodes = mgr.onNodesChange((newNodes) => {
      setNodes(newNodes);
    });

    const unsubEdges = mgr.onEdgesChange((newEdges) => {
      setEdges(newEdges);
    });

    const unsubAwareness = mgr.onAwarenessChange((states) => {
      setAwareness(states);
    });

    // Monitor connection status
    if (mgr.wsProvider) {
      mgr.wsProvider.on('status', (event: any) => {
        setConnected(event.status === 'connected');
      });
    }

    // Initial state
    setNodes(mgr.getAllNodes());
    setEdges(mgr.getAllEdges());

    // Store cleanup functions
    onCleanup(() => {
      unsubNodes();
      unsubEdges();
      unsubAwareness();
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    manager()?.disconnect();
  });

  const contextValue: YjsWorkflowContextValue = {
    manager: manager(),
    nodes,
    edges,
    synced,
    connected,

    addNode: (node: WorkflowNode) => {
      manager()?.addNode(node);
    },

    updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => {
      manager()?.updateNode(nodeId, updates);
    },

    deleteNode: (nodeId: string) => {
      manager()?.deleteNode(nodeId);
    },

    addEdge: (edge: WorkflowEdge) => {
      manager()?.addEdge(edge);
    },

    deleteEdge: (edgeId: string) => {
      manager()?.deleteEdge(edgeId);
    },

    queueAgentExecution: (task: any) => {
      return manager()?.queueAgentExecution(task) || '';
    },

    awareness
  };

  return (
    <YjsWorkflowContext.Provider value={contextValue}>
      {props.children}
    </YjsWorkflowContext.Provider>
  );
}

export function useYjsWorkflow() {
  const context = useContext(YjsWorkflowContext);
  if (!context) {
    throw new Error('useYjsWorkflow must be used within YjsWorkflowProvider');
  }
  return context;
}
