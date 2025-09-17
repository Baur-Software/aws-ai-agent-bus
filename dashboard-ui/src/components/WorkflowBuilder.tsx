import { createSignal, createEffect, Show, onMount } from 'solid-js';
import { useOrganization } from '../contexts/OrganizationContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { useMCP } from '../contexts/MCPContext';
import { useDashboard } from '../contexts/DashboardContext';
import WorkflowCanvas, { WorkflowNode, WorkflowConnection } from './WorkflowCanvas';
import WorkflowToolbar from './WorkflowToolbar';
import NodeSidebar from './NodeSidebar';
import WorkflowNodeDetails from './WorkflowNodeDetails';
import WorkflowCollaboration, { WorkflowCollaborator, WorkflowPermissions } from './WorkflowCollaboration';

interface WorkflowBuilderProps {
  workflowId?: string;
  onBack?: () => void;
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

  // Git-like versioning and forking
  version: string; // e.g., "1.2.3"
  isPublic: boolean; // Public in org or private to user
  context: 'user' | 'shared'; // User context vs shared context

  // Fork/template information
  forkedFrom?: {
    workflowId: string;
    version: string;
    originalAuthor: string;
    forkReason?: string;
  };

  // Repository-like stats
  stats: {
    forkCount: number;
    starCount: number;
    usageCount: number; // Number of times executed
    lastUsed?: string;
  };

  // Version history
  versionHistory: {
    version: string;
    timestamp: string;
    author: string;
    changes: string;
    commitHash?: string;
  }[];

  // GitHub-like labels and topics
  tags: string[];
  topics: string[]; // e.g., ['automation', 'analytics', 'marketing']
}

export default function WorkflowBuilder(props: WorkflowBuilderProps) {
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
  const [connectedIntegrations, setConnectedIntegrations] = createSignal<string[]>([]);

  // Context hooks
  const { currentOrganization, user } = useOrganization();
  const { success, error } = useNotifications();
  const kvStore = useKVStore();
  const { executeTool } = useMCP();
  const dashboard = useDashboard();

  // Load workflow data if workflowId is provided
  createEffect(async () => {
    if (props.workflowId) {
      await loadWorkflow(props.workflowId);
    } else {
      // New workflow - initialize with default metadata
      initializeNewWorkflow();
    }
  });

  // Load connected integrations
  createEffect(async () => {
    await loadConnectedIntegrations();
  });

  // Track changes for unsaved indicator
  createEffect(() => {
    // Trigger change detection when nodes or connections change
    nodes();
    connections();
    workflowName();
    setHasUnsavedChanges(true);
  });

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
        allowExternalCollaborators: false,
        requireApproval: false
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: currentUser.id,

      // Git-like versioning
      version: '1.0.0',
      isPublic: false,
      context: 'user', // Start in user context

      // Repository stats
      stats: {
        forkCount: 0,
        starCount: 0,
        usageCount: 0
      },

      // Version history
      versionHistory: [{
        version: '1.0.0',
        timestamp,
        author: currentUser.name,
        changes: 'Initial workflow creation'
      }],

      // GitHub-like categorization
      tags: [],
      topics: []
    };

    setWorkflowMetadata(metadata);
    setWorkflowName(metadata.name);
  };

  const loadWorkflow = async (workflowId: string) => {
    try {
      // TODO: Update to use dashboard.workflows.getById when implemented
      // For now, load from all workflows and find by ID
      const workflows = await dashboard.workflows.getAll();
      const workflow = workflows.find(w => w.workflowId === workflowId);

      if (workflow) {
        // Convert dashboard workflow to our metadata format
        const metadata: WorkflowMetadata = {
          id: workflow.workflowId,
          name: workflow.name,
          description: workflow.description,
          organizationId: 'demo-org-456', // TODO: Get from organization context
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
          version: '1.0.0', // TODO: Implement versioning in backend
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

        // TODO: Load actual workflow definition from backend
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

      // Check for connected integrations
      const integrations = ['google-analytics', 'slack', 'github', 'stripe', 'trello'];
      const connected: string[] = [];

      for (const integration of integrations) {
        try {
          // Check for any connection pattern
          const legacyConnection = await kvStore.get(`user-${currentUser.id}-integration-${integration}`);
          if (legacyConnection) {
            connected.push(integration);
            continue;
          }

          // Check new pattern with connection IDs
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

  const saveWorkflow = async () => {
    try {
      const metadata = workflowMetadata();
      if (!metadata) {
        // Create new workflow
        await createNewWorkflow();
        return;
      }

      // TODO: Implement workflow update API in dashboard-server
      // For now, just simulate a successful save
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

      // Get available contexts
      const contexts = await dashboard.contexts.getAll();
      let contextId = contexts[0]?.contextId;

      // Create a default context if none exists
      if (!contextId) {
        const newContext = await dashboard.contexts.create({
          contextName: 'Default Context',
          organizationId: org.id,
          permissions: ['mcp:*'],
          oauthGrants: [],
          workflows: [],
          createdBy: currentUser.id
        });
        contextId = newContext.contextId;
      }

      // Create workflow through dashboard API
      const workflowDefinition = {
        nodes: nodes(),
        connections: connections()
      };

      const newWorkflow = await dashboard.workflows.create({
        contextId,
        name: workflowName(),
        description: 'Created via workflow builder',
        definition: JSON.stringify(workflowDefinition),
        requiredApps: [],
        sharedWith: []
      });

      // Convert to our metadata format
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

    } catch (err) {
      error(`Failed to create workflow: ${err.message}`);
    }
  };

  const runWorkflow = async () => {
    if (isExecuting()) {
      // Pause execution
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

      // Simple execution simulation - in production, this would use the WorkflowEngine
      success('Workflow execution started');

      // Simulate execution time
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

  const exportWorkflow = () => {
    const exportData = {
      metadata: workflowMetadata(),
      nodes: nodes(),
      connections: connections()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWorkflow = (workflowData: any) => {
    try {
      if (workflowData.nodes) {
        setNodes(workflowData.nodes);
        setConnections(workflowData.connections || []);
        if (workflowData.metadata?.name) {
          setWorkflowName(workflowData.metadata.name);
        }
        setHasUnsavedChanges(true);
        success('Workflow imported successfully');
      } else {
        error('Invalid workflow format');
      }
    } catch (err) {
      error(`Failed to import workflow: ${err.message}`);
    }
  };

  const handleDragStart = (nodeType: string) => {
    // Handled by the canvas drop event
  };

  const handleCollaboratorsChange = (collaborators: WorkflowCollaborator[]) => {
    const metadata = workflowMetadata();
    if (metadata) {
      setWorkflowMetadata({ ...metadata, collaborators });
      setHasUnsavedChanges(true);
    }
  };

  const handlePermissionsChange = (permissions: WorkflowPermissions) => {
    const metadata = workflowMetadata();
    if (metadata) {
      setWorkflowMetadata({ ...metadata, permissions });
      setHasUnsavedChanges(true);
    }
  };

  const handleConnectIntegration = (integration: string) => {
    // Navigate to settings page to connect integration
    window.location.href = `/settings?connect=${integration}`;
  };

  // GitHub-like action handlers
  const forkWorkflow = async () => {
    try {
      const metadata = workflowMetadata();
      const currentUser = user();
      const org = currentOrganization();

      if (!metadata || !currentUser || !org) return;

      const timestamp = new Date().toISOString();
      const forkId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const forkedMetadata: WorkflowMetadata = {
        ...metadata,
        id: forkId,
        name: `${metadata.name} (Fork)`,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: currentUser.id,
        context: 'user', // Forks start in user context
        version: '1.0.0', // Reset version for fork
        forkedFrom: {
          workflowId: metadata.id,
          version: metadata.version,
          originalAuthor: metadata.collaborators.find(c => c.role === 'owner')?.name || 'Unknown',
          forkReason: 'Manual fork'
        },
        stats: {
          forkCount: 0,
          starCount: 0,
          usageCount: 0
        },
        versionHistory: [{
          version: '1.0.0',
          timestamp,
          author: currentUser.name,
          changes: `Forked from ${metadata.name} v${metadata.version}`
        }],
        collaborators: [{
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          avatar: currentUser.avatar,
          role: 'owner',
          addedAt: timestamp,
          addedBy: currentUser.id,
          status: 'accepted'
        }]
      };

      // Update original workflow's fork count
      const updatedOriginal = {
        ...metadata,
        stats: {
          ...metadata.stats,
          forkCount: metadata.stats.forkCount + 1
        }
      };

      // Save forked workflow
      await kvStore.set(`workflow-${forkId}-metadata`, JSON.stringify(forkedMetadata));
      await kvStore.set(`workflow-${forkId}-content`, JSON.stringify({
        nodes: nodes(),
        connections: connections()
      }));

      // Update original workflow stats
      await kvStore.set(`workflow-${metadata.id}-metadata`, JSON.stringify(updatedOriginal));

      // Update workflow index
      const workflowIndex = await kvStore.get(`org-${org.id}-workflows-index`);
      const workflowIds = workflowIndex ? JSON.parse(workflowIndex) : [];
      if (!workflowIds.includes(forkId)) {
        workflowIds.push(forkId);
        await kvStore.set(`org-${org.id}-workflows-index`, JSON.stringify(workflowIds));
      }

      success(`Workflow forked successfully! Navigate to the new fork to continue working.`);
    } catch (err) {
      error(`Failed to fork workflow: ${err.message}`);
    }
  };

  const publishToOrg = async () => {
    try {
      const metadata = workflowMetadata();
      if (!metadata) return;

      const updatedMetadata = {
        ...metadata,
        context: 'shared',
        isPublic: true,
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`workflow-${metadata.id}-metadata`, JSON.stringify(updatedMetadata));
      setWorkflowMetadata(updatedMetadata);

      success('Workflow published to organization successfully!');
    } catch (err) {
      error(`Failed to publish workflow: ${err.message}`);
    }
  };

  const createVersion = async () => {
    try {
      const metadata = workflowMetadata();
      const currentUser = user();
      if (!metadata || !currentUser) return;

      // Simple semantic versioning increment (patch version)
      const versionParts = metadata.version.split('.');
      const newPatch = parseInt(versionParts[2] || '0') + 1;
      const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatch}`;

      const timestamp = new Date().toISOString();
      const updatedMetadata = {
        ...metadata,
        version: newVersion,
        updatedAt: timestamp,
        versionHistory: [
          ...metadata.versionHistory,
          {
            version: newVersion,
            timestamp,
            author: currentUser.name,
            changes: 'Version created via UI' // TODO: Allow user to enter changes
          }
        ]
      };

      await kvStore.set(`workflow-${metadata.id}-metadata`, JSON.stringify(updatedMetadata));
      setWorkflowMetadata(updatedMetadata);

      success(`Created version ${newVersion} successfully!`);
    } catch (err) {
      error(`Failed to create version: ${err.message}`);
    }
  };

  const starWorkflow = async () => {
    try {
      const metadata = workflowMetadata();
      const currentUser = user();
      if (!metadata || !currentUser) return;

      // Toggle star status
      const isStarred = metadata.stats.starCount > 0; // Simplified - in production, track per-user
      const newStarCount = isStarred ? metadata.stats.starCount - 1 : metadata.stats.starCount + 1;

      const updatedMetadata = {
        ...metadata,
        stats: {
          ...metadata.stats,
          starCount: Math.max(0, newStarCount)
        },
        updatedAt: new Date().toISOString()
      };

      await kvStore.set(`workflow-${metadata.id}-metadata`, JSON.stringify(updatedMetadata));
      setWorkflowMetadata(updatedMetadata);

      success(isStarred ? 'Workflow unstarred!' : 'Workflow starred!');
    } catch (err) {
      error(`Failed to star workflow: ${err.message}`);
    }
  };

  const viewVersionHistory = () => {
    const metadata = workflowMetadata();
    if (!metadata) return;

    // Create a simple alert showing version history (TODO: Create proper modal)
    const historyText = metadata.versionHistory
      .map(v => `v${v.version} - ${v.author} - ${new Date(v.timestamp).toLocaleDateString()} - ${v.changes}`)
      .join('\n');

    alert(`Version History:\n\n${historyText}`);
  };

  // Check if current user is the workflow owner
  const isOwner = () => {
    const metadata = workflowMetadata();
    const currentUser = user();
    return metadata && currentUser && metadata.createdBy === currentUser.id;
  };

  return (
    <div class="workflow-builder h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <WorkflowToolbar
        onSave={saveWorkflow}
        onLoad={importWorkflow}
        onRun={runWorkflow}
        onClear={clearWorkflow}
        onBack={props.onBack}
        onShare={() => setShowCollaboration(true)}
        onExport={exportWorkflow}
        onImport={() => {/* TODO: Implement file picker */}}
        isExecuting={isExecuting()}
        workflowName={workflowName()}
        onNameChange={setWorkflowName}
        hasUnsavedChanges={hasUnsavedChanges()}
        executionStatus={executionStatus()}
        workflowMetadata={workflowMetadata()}
        onFork={forkWorkflow}
        onPublishToOrg={publishToOrg}
        onCreateVersion={createVersion}
        onStar={starWorkflow}
        onViewHistory={viewVersionHistory}
      />

      {/* Main Content */}
      <div class="flex-1 flex">
        {/* Node Sidebar */}
        <NodeSidebar
          onDragStart={handleDragStart}
          nodeTypes={[]} // Will be populated by NodeSidebar component
          connectedIntegrations={connectedIntegrations()}
          onConnectIntegration={handleConnectIntegration}
        />

        {/* Canvas */}
        <div class="flex-1 relative">
          <WorkflowCanvas
            nodes={nodes()}
            setNodes={setNodes}
            connections={connections()}
            setConnections={setConnections}
            selectedNode={selectedNode()}
            setSelectedNode={setSelectedNode}
          />

          {/* Node Details Panel */}
          <Show when={selectedNode()}>
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
          </Show>
        </div>
      </div>

      {/* Collaboration Modal */}
      <Show when={showCollaboration() && workflowMetadata()}>
        <WorkflowCollaboration
          workflowId={workflowMetadata()!.id}
          workflowName={workflowName()}
          isOwner={isOwner()}
          currentCollaborators={workflowMetadata()!.collaborators}
          permissions={workflowMetadata()!.permissions}
          onCollaboratorsChange={handleCollaboratorsChange}
          onPermissionsChange={handlePermissionsChange}
          onClose={() => setShowCollaboration(false)}
        />
      </Show>
    </div>
  );
}