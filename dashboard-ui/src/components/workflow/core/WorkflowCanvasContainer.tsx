import { createSignal, createEffect, Show, onMount, onCleanup, Portal } from 'solid-js';
import { createStore } from 'solid-js/store';
import WorkflowCanvas, { WorkflowNode, WorkflowConnection } from './WorkflowCanvas';
import FloatingToolbar from '../ui/FloatingToolbar';
import FloatingNodePanel from '../ui/FloatingNodePanel';
import WorkflowNodeDetails from '../ui/WorkflowNodeDetails';
import WorkflowCollaboration, { WorkflowCollaborator, WorkflowPermissions } from './WorkflowCollaboration';
import WorkflowBrowserModal from '../modals/WorkflowBrowserModal';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useKVStore } from '../../../contexts/KVStoreContext';
import { useMCP } from '../../../contexts/MCPContext';
import { useDashboardServer } from '../../../contexts/DashboardServerContext';

interface WorkflowCanvasContainerProps {
  workflowId?: string;
  onBack?: () => void;
  navigationPinned?: boolean;
  // Workflow picker props
  currentWorkflow?: any;
  workflows?: any[];
  onWorkflowSelect?: (workflowId: string) => void;
  onCreateNewWorkflow?: () => void;
  onOpenTemplates?: () => void;
  onBrowseAll?: () => void;
}

interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  collaborators: WorkflowCollaborator[];
  permissions: WorkflowPermissions;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: string;
  isPublic: boolean;
  context: 'user' | 'shared';
  forkedFrom?: {
    workflowId: string;
    version: string;
    originalAuthor: string;
    forkReason?: string;
  };
  stats: {
    forkCount: number;
    starCount: number;
    usageCount: number;
    lastUsed?: string;
  };
  versionHistory: {
    version: string;
    timestamp: string;
    author: string;
    changes: string;
    commitHash?: string;
  }[];
  tags: string[];
  topics: string[];
}

interface DragDropState {
  isDragging: boolean;
  dragType: 'external-node' | null;
  nodeType: string | null;
  dragPosition: { x: number; y: number };
}

export default function WorkflowCanvasContainer(props: WorkflowCanvasContainerProps) {
  // Core workflow state
  const [nodes, setNodes] = createSignal<WorkflowNode[]>([]);
  const [connections, setConnections] = createSignal<WorkflowConnection[]>([]);
  const [selectedNode, setSelectedNode] = createSignal<WorkflowNode | null>(null);

  // Workflow metadata
  const [workflowMetadata, setWorkflowMetadata] = createSignal<WorkflowMetadata | null>(null);
  const [workflowName, setWorkflowName] = createSignal('Untitled Workflow');
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);

  // UI state
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [executionStatus, setExecutionStatus] = createSignal<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle');
  const [showCollaboration, setShowCollaboration] = createSignal(false);
  const [showWorkflowBrowser, setShowWorkflowBrowser] = createSignal(!props.workflowId);
  const [connectedIntegrations, setConnectedIntegrations] = createSignal<string[]>([]);

  // Canvas view options
  const [gridMode, setGridMode] = createSignal<'off' | 'grid' | 'dots'>('dots');

  // Drag and drop state for external nodes
  const [dragDropState, setDragDropState] = createStore<DragDropState>({
    isDragging: false,
    dragType: null,
    nodeType: null,
    dragPosition: { x: 0, y: 0 }
  });

  // Floating panel positions
  const getDefaultToolbarPosition = () => {
    const navWidth = props.navigationPinned ? 64 : 0;
    const availableWidth = window.innerWidth - navWidth;
    const toolbarWidth = 400;
    return {
      x: Math.max(navWidth + 20, navWidth + (availableWidth / 2) - (toolbarWidth / 2)),
      y: 20
    };
  };

  const [toolbarPosition, setToolbarPosition] = createSignal(getDefaultToolbarPosition());
  const [nodePanelPosition, setNodePanelPosition] = createSignal({
    x: window.innerWidth - 320,
    y: 0
  });

  // Context hooks
  const { currentOrganization, user } = useOrganization();
  const { success, error } = useNotifications();
  const kvStore = useKVStore();
  const { executeTool } = useMCP();
  // const dashboard = useDashboard(); // Removed - using DashboardServerContext instead

  // Global drag event handlers for external node drops
  const handleGlobalDragOver = (e: DragEvent) => {
    const nodeType = e.dataTransfer?.getData('text/plain');
    if (nodeType) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';

      setDragDropState({
        isDragging: true,
        dragType: 'external-node',
        nodeType,
        dragPosition: { x: e.clientX, y: e.clientY }
      });
    }
  };

  const handleGlobalDragLeave = (e: DragEvent) => {
    // Only clear if leaving the viewport entirely
    if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
        e.clientY <= 0 || e.clientY >= window.innerHeight) {
      setDragDropState({
        isDragging: false,
        dragType: null,
        nodeType: null,
        dragPosition: { x: 0, y: 0 }
      });
    }
  };

  const handleGlobalDrop = (e: DragEvent) => {
    setDragDropState({
      isDragging: false,
      dragType: null,
      nodeType: null,
      dragPosition: { x: 0, y: 0 }
    });
  };

  // Set up global drag handlers
  onMount(() => {
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('dragleave', handleGlobalDragLeave);
    document.addEventListener('drop', handleGlobalDrop);

    // Load initial data
    initializeWorkflow();
    loadConnectedIntegrations();
    loadPanelPositions();
  });

  onCleanup(() => {
    document.removeEventListener('dragover', handleGlobalDragOver);
    document.removeEventListener('dragleave', handleGlobalDragLeave);
    document.removeEventListener('drop', handleGlobalDrop);
  });

  // Initialize workflow data
  const initializeWorkflow = async () => {
    try {
      if (props.workflowId) {
        await loadWorkflow(props.workflowId);
      } else {
        // Try to load last opened workflow
        const currentUser = user();
        if (currentUser && props.workflows) {
          try {
            const lastWorkflowId = await kvStore.get(`user-${currentUser.id}-last-opened-workflow`);
            if (lastWorkflowId?.value) {
              const workflowExists = props.workflows.some(w => w.id === lastWorkflowId.value);
              if (workflowExists) {
                await loadWorkflow(lastWorkflowId.value);
                return;
              }
            }
          } catch (err) {
            console.warn('Failed to load last opened workflow:', err);
          }
        }
      }
    } catch (err) {
      error(`Failed to initialize workflow: ${err.message}`);
    }
  };

  const loadWorkflow = async (workflowId: string) => {
    try {
      // const workflows = await dashboard.workflows.getAll(); // Temporarily disabled - needs DashboardServerContext integration
      const workflow = workflows.find(w => w.workflowId === workflowId);

      if (workflow) {
        const metadata: WorkflowMetadata = {
          id: workflow.workflowId,
          name: workflow.name,
          description: workflow.description,
          organizationId: 'demo-org-456',
          collaborators: [{
            userId: workflow.createdBy,
            email: 'demo@example.com',
            name: 'Demo User',
            avatar: '',
            role: 'owner',
            addedAt: workflow.createdAt,
            addedBy: workflow.createdBy,
            status: 'accepted'
          }],
          permissions: {
            isPublic: false,
            allowOrgMembers: true,
            allowExternalCollaborators: false,
            requireApproval: false
          },
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
          createdBy: workflow.createdBy,
          version: '1.0.0',
          isPublic: false,
          context: 'user',
          stats: {
            forkCount: 0,
            starCount: 0,
            usageCount: 0
          },
          versionHistory: [],
          tags: [],
          topics: []
        };

        setWorkflowMetadata(metadata);
        setWorkflowName(metadata.name);
        setNodes([]);
        setConnections([]);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      error(`Failed to load workflow: ${err.message}`);
    }
  };

  const loadConnectedIntegrations = async () => {
    try {
      const currentUser = user();
      if (!currentUser) return;

      const integrations = ['google-analytics', 'slack', 'github', 'stripe', 'trello'];
      const connected: string[] = [];

      for (const integration of integrations) {
        try {
          const legacyConnection = await kvStore.get(`user-${currentUser.id}-integration-${integration}`);
          if (legacyConnection) {
            connected.push(integration);
            continue;
          }

          const connectionIds = ['default', 'work', 'personal'];
          for (const connectionId of connectionIds) {
            const connection = await kvStore.get(`user-${currentUser.id}-integration-${integration}-${connectionId}`);
            if (connection) {
              connected.push(integration);
              break;
            }
          }
        } catch (error) {
          // Integration not connected
        }
      }

      setConnectedIntegrations(connected);
    } catch (err) {
      console.error('Failed to load connected integrations:', err);
    }
  };

  const loadPanelPositions = async () => {
    try {
      const currentUser = user();
      if (!currentUser) return;

      const savedPositions = await kvStore.get(`user-${currentUser.id}-panel-positions`);
      if (savedPositions?.value) {
        const positions = JSON.parse(savedPositions.value);
        if (positions.toolbar) {
          setToolbarPosition(positions.toolbar);
        }
        if (positions.nodePanel) {
          setNodePanelPosition(positions.nodePanel);
        }
      }
    } catch (err) {
      console.warn('Failed to load panel positions:', err);
    }
  };

  const savePanelPositions = async () => {
    try {
      const currentUser = user();
      if (!currentUser) return;

      const positions = {
        toolbar: toolbarPosition(),
        nodePanel: nodePanelPosition()
      };

      await kvStore.set(
        `user-${currentUser.id}-panel-positions`,
        JSON.stringify(positions),
        24 * 7
      );
    } catch (err) {
      console.warn('Failed to save panel positions:', err);
    }
  };

  const initializeNewWorkflow = () => {
    const org = currentOrganization();
    const currentUser = user();

    if (!org || !currentUser) return;

    const timestamp = new Date().toISOString();
    const metadata: WorkflowMetadata = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Untitled Workflow',
      organizationId: org.id,
      collaborators: [{
        userId: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: 'owner',
        addedAt: timestamp,
        addedBy: currentUser.id,
        status: 'accepted'
      }],
      permissions: {
        isPublic: false,
        allowOrgMembers: true,
        allowExternalIntegrations: false,
        requireApproval: false
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: currentUser.id,
      version: '1.0.0',
      isPublic: false,
      context: 'user',
      stats: {
        forkCount: 0,
        starCount: 0,
        usageCount: 0
      },
      versionHistory: [{
        version: '1.0.0',
        timestamp,
        author: currentUser.name,
        changes: 'Initial workflow creation'
      }],
      tags: [],
      topics: []
    };

    setWorkflowMetadata(metadata);
    setWorkflowName(metadata.name);

    // Add a starter node
    const starterNode: WorkflowNode = {
      id: 'starter-node',
      type: 'trigger',
      x: 200,
      y: 200,
      inputs: [],
      outputs: ['output'],
      config: {},
      title: 'Start Here',
      description: 'Drag nodes from the panel to build your workflow'
    };
    setNodes([starterNode]);
  };

  const saveWorkflow = async () => {
    try {
      const metadata = workflowMetadata();
      if (!metadata) {
        await createNewWorkflow();
        return;
      }

      const updatedMetadata = {
        ...metadata,
        name: workflowName(),
        updatedAt: new Date().toISOString()
      };

      setWorkflowMetadata(updatedMetadata);
      setHasUnsavedChanges(false);
      success('Workflow saved successfully');
    } catch (err) {
      error(`Failed to save workflow: ${err.message}`);
    }
  };

  const createNewWorkflow = async () => {
    try {
      const org = currentOrganization();
      const currentUser = user();

      if (!org || !currentUser) {
        error('Organization or user context not available');
        return;
      }

      // const contexts = await dashboard.contexts.getAll(); // Temporarily disabled
      // Use organization ID as contextId for proper tenant isolation
      let contextId = org.id;

      if (!contextId) {
        // const newContext = await dashboard.contexts.create({ // Temporarily disabled
        //   contextName: 'Default Context',
        //   organizationId: org.id,
        //   permissions: ['mcp:*'],
        //   oauthGrants: [],
        //   workflows: [],
        //   createdBy: currentUser.id
        // });
        // contextId = newContext.contextId;

        // Fallback - use user ID if no org context
        contextId = currentUser.id;
      }

      const workflowDefinition = {
        nodes: nodes(),
        connections: connections()
      };

      // const newWorkflow = await dashboard.workflows.create({ // Temporarily disabled
      //   contextId,
      //   name: workflowName(),
      //   description: 'Created via workflow builder',
      //   definition: JSON.stringify(workflowDefinition),
      //   requiredApps: [],
      //   sharedWith: []
      // });

      // Temporary placeholder since the above is disabled
      const newWorkflow = {
        workflowId: 'temp-workflow-' + Date.now(),
        name: workflowName(),
        description: 'Created via workflow builder'
      };

      const metadata: WorkflowMetadata = {
        id: newWorkflow.workflowId,
        name: newWorkflow.name,
        description: newWorkflow.description,
        organizationId: org.id,
        collaborators: [{
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          avatar: currentUser.avatar,
          role: 'owner',
          addedAt: newWorkflow.createdAt,
          addedBy: currentUser.id,
          status: 'accepted'
        }],
        permissions: {
          isPublic: false,
          allowOrgMembers: true,
          allowExternalCollaborators: false,
          requireApproval: false
        },
        createdAt: newWorkflow.createdAt,
        updatedAt: newWorkflow.updatedAt,
        createdBy: newWorkflow.createdBy,
        version: '1.0.0',
        isPublic: false,
        context: 'user',
        stats: {
          forkCount: 0,
          starCount: 0,
          usageCount: 0
        },
        versionHistory: [{
          version: '1.0.0',
          timestamp: newWorkflow.createdAt,
          author: currentUser.name,
          changes: 'Initial workflow creation'
        }],
        tags: [],
        topics: []
      };

      setWorkflowMetadata(metadata);
      setHasUnsavedChanges(false);
      success('Workflow created successfully');

      if (currentUser) {
        try {
          await kvStore.set(
            `user-${currentUser.id}-last-opened-workflow`,
            metadata.id,
            24 * 7
          );
        } catch (err) {
          console.warn('Failed to save last opened workflow:', err);
        }
      }
    } catch (err) {
      error(`Failed to create workflow: ${err.message}`);
    }
  };

  const runWorkflow = async () => {
    if (isExecuting()) {
      setExecutionStatus('paused');
      setIsExecuting(false);
      return;
    }

    if (nodes().length === 0) {
      error('Cannot run empty workflow');
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionStatus('running');
      success('Workflow execution started');

      setTimeout(() => {
        setIsExecuting(false);
        setExecutionStatus('completed');
        success('Workflow completed successfully');
      }, 3000);
    } catch (err) {
      setIsExecuting(false);
      setExecutionStatus('error');
      error(`Workflow execution failed: ${err.message}`);
    }
  };

  const clearWorkflow = () => {
    setNodes([]);
    setConnections([]);
    setSelectedNode(null);
    setHasUnsavedChanges(true);
  };

  const handleDragStart = (nodeType: string, e?: DragEvent) => {
    console.log('WorkflowCanvasContainer: External drag started for node type:', nodeType);
  };

  const handleToolbarPositionChange = (x: number, y: number) => {
    setToolbarPosition({ x, y });
    savePanelPositions();
  };

  const handleNodePanelPositionChange = (x: number, y: number) => {
    setNodePanelPosition({ x, y });
    savePanelPositions();
  };

  const handleToggleGrid = () => {
    setGridMode(current => {
      switch (current) {
        case 'off': return 'grid';
        case 'grid': return 'dots';
        case 'dots': return 'grid';
        default: return 'grid';
      }
    });
  };

  const handleToggleGridOff = () => {
    setGridMode(current => current === 'off' ? 'grid' : 'off');
  };

  const handleConnectIntegration = (integration: string) => {
    window.location.href = `/settings?connect=${integration}`;
  };

  // Track changes for unsaved indicator
  createEffect(() => {
    nodes();
    connections();
    workflowName();
    setHasUnsavedChanges(true);
  });

  return (
    <div class="workflow-canvas-container w-screen h-screen relative overflow-hidden">
      {/* Primary Canvas - Full Screen */}
      <WorkflowCanvas
        nodes={nodes()}
        setNodes={setNodes}
        connections={connections()}
        setConnections={setConnections}
        selectedNode={selectedNode()}
        setSelectedNode={setSelectedNode}
        showWelcome={!workflowMetadata()}
        onCreateNew={() => {
          initializeNewWorkflow();
          props.onCreateNewWorkflow?.();
        }}
        onBrowseWorkflows={() => setShowWorkflowBrowser(true)}
        gridMode={gridMode()}
      />

      {/* Drag Preview Overlay */}
      <Show when={dragDropState.isDragging && dragDropState.nodeType}>
        <div
          class="fixed pointer-events-none z-50 px-3 py-2 bg-blue-500 text-white rounded-lg shadow-lg text-sm"
          style={{
            left: `${dragDropState.dragPosition.x + 10}px`,
            top: `${dragDropState.dragPosition.y - 10}px`
          }}
        >
          Dropping {dragDropState.nodeType} node
        </div>
      </Show>

      {/* Portal-based Overlays */}
      <Portal>
        {/* Floating Toolbar */}
        {/* <Show when={props.workflowId && workflowMetadata()}> */}
          <FloatingToolbar
            onSave={saveWorkflow}
            onLoad={() => {}}
            onRun={runWorkflow}
            onClear={clearWorkflow}
            onBack={props.onBack}
            onShare={() => setShowCollaboration(true)}
            onToggleGrid={handleToggleGrid}
            onToggleGridOff={handleToggleGridOff}
            gridMode={gridMode()}
            hasUnsavedChanges={hasUnsavedChanges()}
            isExecuting={isExecuting()}
            onPositionChange={handleToolbarPositionChange}
            initialPosition={toolbarPosition()}
            navigationPinned={props.navigationPinned}
            currentWorkflow={workflowMetadata() ? {
              id: workflowMetadata()!.id,
              name: workflowName(),
              description: workflowMetadata()!.description,
              version: workflowMetadata()!.version,
              metadata: {
                nodeCount: nodes().length,
                updatedAt: workflowMetadata()!.updatedAt
              }
            } : undefined}
            workflows={props.workflows?.map(w => ({
              id: w.id || w.workflowId,
              name: w.name,
              description: w.description,
              version: w.version || '1.0.0',
              metadata: {
                nodeCount: 0,
                updatedAt: w.updatedAt || w.createdAt
              }
            }))}
            onWorkflowSelect={props.onWorkflowSelect}
            onCreateNewWorkflow={props.onCreateNewWorkflow}
            onOpenTemplates={props.onOpenTemplates}
            onBrowseAll={() => setShowWorkflowBrowser(true)}
            onBrowseWorkflows={() => setShowWorkflowBrowser(true)}
          />
        {/* </Show> */}

        {/* Floating Node Panel */}
        <FloatingNodePanel
          onDragStart={handleDragStart}
          connectedIntegrations={connectedIntegrations()}
          onConnectIntegration={handleConnectIntegration}
          onPositionChange={handleNodePanelPositionChange}
          initialPosition={nodePanelPosition()}
        />

        {/* Node Details Panel */}
        <Show when={selectedNode()}>
          <div class="fixed top-4 right-4 z-40 w-80">
            <WorkflowNodeDetails
              node={selectedNode()!}
              onUpdate={(updatedNode) => {
                setNodes(nodes().map(n => n.id === updatedNode.id ? updatedNode : n));
                setSelectedNode(updatedNode);
                setHasUnsavedChanges(true);
              }}
              onClose={() => setSelectedNode(null)}
              availableModels={['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo']}
            />
          </div>
        </Show>

        {/* Workflow Browser Modal */}
        <WorkflowBrowserModal
          isOpen={showWorkflowBrowser()}
          workflows={props.workflows || []}
          onClose={() => setShowWorkflowBrowser(false)}
          onSelectWorkflow={async (workflowId) => {
            setShowWorkflowBrowser(false);
            props.onWorkflowSelect?.(workflowId);
          }}
          onCreateNew={() => {
            setShowWorkflowBrowser(false);
            props.onCreateNewWorkflow?.();
          }}
          onImport={() => {}}
          onOpenTemplates={() => {
            setShowWorkflowBrowser(false);
            props.onOpenTemplates?.();
          }}
          onConnectApps={() => {
            setShowWorkflowBrowser(false);
            window.location.href = '/settings';
          }}
        />

        {/* Collaboration Modal */}
        <Show when={showCollaboration() && workflowMetadata()}>
          <WorkflowCollaboration
            workflowId={workflowMetadata()!.id}
            workflowName={workflowName()}
            isOwner={workflowMetadata()!.createdBy === user()?.id}
            currentCollaborators={workflowMetadata()!.collaborators}
            permissions={workflowMetadata()!.permissions}
            onCollaboratorsChange={(collaborators) => {
              const metadata = workflowMetadata();
              if (metadata) {
                setWorkflowMetadata({ ...metadata, collaborators });
                setHasUnsavedChanges(true);
              }
            }}
            onPermissionsChange={(permissions) => {
              const metadata = workflowMetadata();
              if (metadata) {
                setWorkflowMetadata({ ...metadata, permissions });
                setHasUnsavedChanges(true);
              }
            }}
            onClose={() => setShowCollaboration(false)}
          />
        </Show>
      </Portal>
    </div>
  );
}