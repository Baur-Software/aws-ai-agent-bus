import { createContext, useContext, createSignal, createEffect, ParentComponent, onMount, onCleanup } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useKVStore } from './KVStoreContext';
import { useOrganization } from './OrganizationContext';
import { useNotifications } from './NotificationContext';
import { useDashboardServer } from './DashboardServerContext';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Storyboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
  color?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: number;
  backgroundColor?: string;
  opacity?: number;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  context: 'user' | 'shared';
  isPublic: boolean;
  version: string;
  stats: {
    starCount: number;
    forkCount: number;
    usageCount: number;
    lastUsed?: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    nodeCount: number;
    tags: string[];
  };
  collaborators: any[];
  forkedFrom?: {
    originalAuthor: string;
    workflowId: string;
  };
}

export interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  collaborators: any[];
  permissions: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: string;
  isPublic: boolean;
  context: 'user' | 'shared';
  stats: {
    forkCount: number;
    starCount: number;
    usageCount: number;
  };
  versionHistory: any[];
  tags: string[];
  topics: string[];
  forkedFrom?: {
    workflowId: string;
    version: string;
    originalAuthor: string;
    forkReason?: string;
  };
}

interface WorkflowContextType {
  // Current workflow state
  currentWorkflow: () => WorkflowMetadata | null;
  currentNodes: () => WorkflowNode[];
  currentConnections: () => WorkflowConnection[];
  currentStoryboards: () => Storyboard[];
  hasUnsavedChanges: () => boolean;

  // Available workflows
  workflows: () => WorkflowSummary[];
  loading: () => boolean;

  // Actions
  loadWorkflow: (id: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
  createNewWorkflow: () => Promise<void>;
  importWorkflow: () => Promise<void>;

  // State setters (for components that need direct access)
  setNodes: (nodes: WorkflowNode[]) => void;
  setConnections: (connections: WorkflowConnection[]) => void;
  setStoryboards: (storyboards: Storyboard[]) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
}

const WorkflowContext = createContext<WorkflowContextType>();

export const WorkflowProvider: ParentComponent = (props) => {
  // Core state
  const [currentWorkflow, setCurrentWorkflow] = createSignal<WorkflowMetadata | null>(null);
  const [currentNodes, setCurrentNodes] = createSignal<WorkflowNode[]>([]);
  const [currentConnections, setCurrentConnections] = createSignal<WorkflowConnection[]>([]);
  const [currentStoryboards, setCurrentStoryboards] = createSignal<Storyboard[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
  const [workflows, setWorkflows] = createSignal<WorkflowSummary[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Real-time event subscriptions
  const dashboardServer = useDashboardServer();

  // Dependencies
  let params: any = {};
  try {
    params = useParams();
  } catch (e) {
    // useParams can only be used inside a Route, ignore if not in router context
    console.debug('useParams not available outside router context');
  }

  const kvStore = useKVStore();
  const { user, currentOrganization } = useOrganization();
  const { success, error } = useNotifications();
  // const dashboard = useDashboard(); // Removed - using DashboardServerContext instead

  // Load workflows on mount
  createEffect(() => {
    loadWorkflows();
  });

  // Auto-load workflow from URL params (only if in router context)
  createEffect(() => {
    if (params && params.id) {
      const workflowId = params.id;
      if (workflowId && workflowId !== currentWorkflow()?.id) {
        loadWorkflow(workflowId);
      }
    }
  });

  // Set up real-time event subscriptions
  onMount(() => {
    console.log('🔄 Setting up workflow real-time subscriptions');

    // Subscribe to workflow-related events
    dashboardServer.subscribeToEvents([
      'workflow_created',
      'workflow_updated',
      'workflow_deleted',
      'workflow_shared',
      'workflow_forked',
      'node_added',
      'node_updated',
      'node_deleted',
      'connection_added',
      'connection_deleted',
      'storyboard_created',
      'storyboard_updated',
      'storyboard_deleted'
    ]);

    // Set up event handlers for workflow updates
    const handleWorkflowUpdate = (data: any) => {
      console.log('📝 Workflow update received:', data);

      // Reload workflows list if needed
      if (data.type === 'workflow_created' || data.type === 'workflow_deleted') {
        loadWorkflows();
      }

      // Update current workflow if it matches
      if (data.workflowId === currentWorkflow()?.id) {
        switch (data.type) {
          case 'node_added':
            setCurrentNodes(prev => [...prev, data.node]);
            setHasUnsavedChanges(false); // Real-time update, not local change
            break;
          case 'node_updated':
            setCurrentNodes(prev => prev.map(node =>
              node.id === data.node.id ? data.node : node
            ));
            setHasUnsavedChanges(false);
            break;
          case 'node_deleted':
            setCurrentNodes(prev => prev.filter(node => node.id !== data.nodeId));
            setHasUnsavedChanges(false);
            break;
          case 'connection_added':
            setCurrentConnections(prev => [...prev, data.connection]);
            setHasUnsavedChanges(false);
            break;
          case 'connection_deleted':
            setCurrentConnections(prev => prev.filter(conn => conn.id !== data.connectionId));
            setHasUnsavedChanges(false);
            break;
          case 'storyboard_created':
            setCurrentStoryboards(prev => [...prev, data.storyboard]);
            setHasUnsavedChanges(false);
            break;
          case 'storyboard_updated':
            setCurrentStoryboards(prev => prev.map(sb =>
              sb.id === data.storyboard.id ? data.storyboard : sb
            ));
            setHasUnsavedChanges(false);
            break;
          case 'storyboard_deleted':
            setCurrentStoryboards(prev => prev.filter(sb => sb.id !== data.storyboardId));
            setHasUnsavedChanges(false);
            break;
        }
      }
    };

    // Subscribe to activity updates for workflow events
    const unsubscribeActivity = dashboardServer.onActivityUpdate(handleWorkflowUpdate);

    // Subscribe to metrics updates for workflow statistics
    const unsubscribeMetrics = dashboardServer.onMetricsUpdate((data: any) => {
      console.log('📊 Workflow metrics update:', data);
      // Update workflow statistics when metrics change
      if (data.workflowMetrics) {
        loadWorkflows(); // Refresh workflow list with updated stats
      }
    });

    // Subscribe to organization context switches
    const unsubscribeOrgSwitch = dashboardServer.onOrganizationSwitched((data: any) => {
      console.log('🏢 Organization switched, reloading workflows');
      loadWorkflows(); // Reload workflows for new organization context
    });

    // Cleanup subscriptions on unmount
    onCleanup(() => {
      console.log('🔄 Cleaning up workflow subscriptions');
      unsubscribeActivity();
      unsubscribeMetrics();
      unsubscribeOrgSwitch();
    });
  });

  const loadWorkflows = async () => {
    try {
      setLoading(true);

      let workflowSummaries: WorkflowSummary[] = [];

      try {
        // Try to load from KV store first (real data)
        const workflowListKey = `workflows-${currentOrganization()?.id || 'personal'}`;
        const savedWorkflows = await kvStore.get(workflowListKey);

        if (savedWorkflows) {
          workflowSummaries = JSON.parse(savedWorkflows);
          console.log(`📂 Loaded ${workflowSummaries.length} workflows from KV store`);
        } else {
          // Try dashboard API as fallback (temporarily disabled - needs DashboardServerContext integration)
          try {
            // const workflowsData = await dashboard.workflows.getAll();
            // workflowSummaries = workflowsData.map(workflow => ({
            //   id: workflow.workflowId,
            //   name: workflow.name,
            //   description: workflow.description,
            //   context: 'user',
            //   isPublic: false,
            //   version: '1.0.0',
            //   stats: {
            //     starCount: 0,
            //     forkCount: 0,
            //     usageCount: 0
            //   },
            //   metadata: {
            //     createdAt: workflow.createdAt,
            //     updatedAt: workflow.updatedAt,
            //     createdBy: workflow.createdBy,
            //     nodeCount: 0,
            //     tags: []
            //   },
            //   collaborators: [],
            //   forkedFrom: undefined
            // }));
            // console.log(`📡 Loaded ${workflowSummaries.length} workflows from dashboard API`);
          } catch (apiErr) {
            console.warn('Dashboard API also failed, will use sample workflows');
            throw new Error('No real workflows available');
          }
        }

        // If no workflows found, add sample workflows for demonstration
        if (workflowSummaries.length === 0) {
          console.log('No workflows found, adding sample workflows for demonstration');
          throw new Error('No workflows found - will use samples');
        }
      } catch (apiErr) {
        console.warn('Real data loading failed, using sample workflows:', apiErr);

        // Fallback to sample workflows
        workflowSummaries = [
          {
            id: 'sample-workflow-1',
            name: 'Customer Onboarding Flow',
            description: 'Automated workflow for onboarding new customers with email sequences and task assignments',
            context: 'user',
            isPublic: false,
            version: '1.2.0',
            stats: {
              starCount: 12,
              forkCount: 3,
              usageCount: 45,
              lastUsed: new Date().toISOString()
            },
            metadata: {
              createdAt: '2024-01-15T10:00:00Z',
              updatedAt: new Date().toISOString(),
              createdBy: user()?.id || 'demo-user',
              nodeCount: 8,
              tags: ['automation', 'onboarding', 'customer']
            },
            collaborators: [],
            forkedFrom: undefined
          },
          {
            id: 'sample-workflow-2',
            name: 'Data Analysis Pipeline',
            description: 'Automated data processing and analysis workflow with reporting features',
            context: 'shared',
            isPublic: true,
            version: '2.1.0',
            stats: {
              starCount: 28,
              forkCount: 7,
              usageCount: 156,
              lastUsed: '2024-01-20T14:30:00Z'
            },
            metadata: {
              createdAt: '2023-12-10T09:00:00Z',
              updatedAt: '2024-01-20T14:30:00Z',
              createdBy: 'org-admin',
              nodeCount: 15,
              tags: ['data', 'analytics', 'reporting', 'template']
            },
            collaborators: [],
            forkedFrom: undefined
          }
        ];
      }

      setWorkflows(workflowSummaries);
    } catch (err) {
      console.error('Failed to load workflows:', err);
      error(`Failed to load workflows: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflow = async (workflowId: string) => {
    try {
      // Find workflow in our list
      const workflow = workflows().find(w => w.id === workflowId);

      // Handle new workflow IDs (temporary workflows for creation)
      if (!workflow && workflowId.startsWith('new-')) {
        // Create a temporary new workflow
        const metadata: WorkflowMetadata = {
          id: workflowId,
          name: 'Untitled Workflow',
          description: 'A new workflow ready to be built',
          organizationId: currentOrganization()?.id || 'demo-org',
          collaborators: [{
            userId: user()?.id || 'demo-user',
            email: user()?.email || 'demo@example.com',
            name: user()?.name || 'Demo User',
            avatar: user()?.avatar || '',
            role: 'owner',
            addedAt: new Date().toISOString(),
            addedBy: user()?.id || 'demo-user',
            status: 'accepted'
          }],
          permissions: {
            isPublic: false,
            allowOrgMembers: true,
            allowExternalCollaborators: false,
            requireApproval: false
          },
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: []
        };

        // Set the new workflow as current
        setCurrentWorkflow(metadata);
        setCurrentNodes([]);
        setCurrentConnections([]);
        setHasUnsavedChanges(false);
        return;
      }

      if (!workflow) {
        error(`Workflow ${workflowId} not found`);
        return;
      }

      // Create metadata for existing workflow
      const metadata: WorkflowMetadata = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        organizationId: currentOrganization()?.id || 'demo-org',
        collaborators: [{
          userId: workflow.metadata.createdBy,
          email: 'demo@example.com',
          name: 'Demo User',
          avatar: '',
          role: 'owner',
          addedAt: workflow.metadata.createdAt,
          addedBy: workflow.metadata.createdBy,
          status: 'accepted'
        }],
        permissions: {
          isPublic: false,
          allowOrgMembers: true,
          allowExternalCollaborators: false,
          requireApproval: false
        },
        createdAt: workflow.metadata.createdAt,
        updatedAt: workflow.metadata.updatedAt,
        createdBy: workflow.metadata.createdBy,
        version: workflow.version,
        isPublic: workflow.isPublic,
        context: workflow.context,
        stats: workflow.stats,
        versionHistory: [],
        tags: workflow.metadata.tags,
        topics: [],
        forkedFrom: workflow.forkedFrom
      };

      setCurrentWorkflow(metadata);

      // Add sample nodes for testing if workflow is empty
      const sampleNodes = [
        {
          id: 'sample-trigger-1',
          type: 'trigger',
          x: 100,
          y: 100,
          inputs: [],
          outputs: ['output'],
          config: { triggerType: 'manual' },
          title: 'Start Process',
          description: 'Manual trigger to start the workflow',
          enabled: true
        },
        {
          id: 'sample-process-1',
          type: 'lead-qualification',
          x: 300,
          y: 100,
          inputs: ['input'],
          outputs: ['qualified', 'unqualified'],
          config: { criteria: 'basic qualification' },
          title: 'Qualify Lead',
          description: 'Evaluate and qualify incoming leads',
          enabled: true
        },
        {
          id: 'sample-action-1',
          type: 'email',
          x: 500,
          y: 50,
          inputs: ['input'],
          outputs: ['sent', 'failed'],
          config: { template: 'welcome-email' },
          title: 'Send Welcome Email',
          description: 'Send welcome email to qualified leads',
          enabled: true
        }
      ];

      setCurrentNodes(sampleNodes); // TODO: Load actual nodes from storage
      setCurrentConnections([]); // TODO: Load actual connections
      setHasUnsavedChanges(false);

      // Save as last opened
      const currentUser = user();
      if (currentUser) {
        try {
          await kvStore.set(
            `user-${currentUser.id}-last-opened-workflow`,
            workflowId,
            24 * 7 // 1 week TTL
          );
        } catch (err) {
          console.warn('Failed to save last opened workflow:', err);
        }
      }

      success(`Loaded workflow: ${metadata.name}`);
    } catch (err) {
      console.error('Failed to load workflow:', err);
      error(`Failed to load workflow: ${err.message}`);
    }
  };

  const saveWorkflow = async () => {
    const workflow = currentWorkflow();
    if (!workflow) return;

    try {
      console.log('💾 Saving workflow to real storage:', workflow.name);

      // Prepare workflow data for storage
      const workflowData = {
        metadata: workflow,
        nodes: currentNodes(),
        connections: currentConnections(),
        storyboards: currentStoryboards(),
        lastSaved: new Date().toISOString()
      };

      // Save to dashboard KV store for persistence
      const kvKey = `workflow-${workflow.id}`;
      await kvStore.set(kvKey, JSON.stringify(workflowData));

      // Also save workflow metadata to workflows list
      const workflowListKey = `workflows-${currentOrganization()?.id || 'personal'}`;
      try {
        const existingWorkflows = await kvStore.get(workflowListKey);
        const workflows = existingWorkflows ? JSON.parse(existingWorkflows) : [];

        // Update or add workflow in list
        const workflowIndex = workflows.findIndex((w: any) => w.id === workflow.id);
        const workflowSummary = {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          context: workflow.context,
          isPublic: workflow.isPublic,
          version: workflow.version,
          stats: workflow.stats,
          metadata: {
            createdAt: workflow.createdAt,
            updatedAt: new Date().toISOString(),
            createdBy: workflow.createdBy,
            nodeCount: currentNodes().length,
            tags: workflow.tags || []
          },
          collaborators: workflow.collaborators,
          forkedFrom: workflow.forkedFrom
        };

        if (workflowIndex >= 0) {
          workflows[workflowIndex] = workflowSummary;
        } else {
          workflows.push(workflowSummary);
        }

        await kvStore.set(workflowListKey, JSON.stringify(workflows));
      } catch (listError) {
        console.warn('Failed to update workflows list:', listError);
      }

      // Notify via real-time events
      dashboardServer.sendMessage({
        type: 'workflow_updated',
        data: {
          workflowId: workflow.id,
          type: 'workflow_saved',
          timestamp: new Date().toISOString(),
          nodeCount: currentNodes().length,
          connectionCount: currentConnections().length,
          storyboardCount: currentStoryboards().length
        }
      });

      setHasUnsavedChanges(false);
      success(`✅ Saved workflow: ${workflow.name}`);
    } catch (err) {
      console.error('Save workflow error:', err);
      error(`❌ Failed to save workflow: ${err.message}`);
    }
  };

  const createNewWorkflow = async () => {
    const newId = `workflow-${Date.now()}`;

    // Create new workflow metadata
    const currentUser = user();
    const currentOrg = currentOrganization();

    if (currentUser && currentOrg) {
      const newWorkflow: WorkflowMetadata = {
        id: newId,
        name: 'Untitled Workflow',
        organizationId: currentOrg.id,
        collaborators: [{
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          avatar: currentUser.avatar || '',
          role: 'owner',
          addedAt: new Date().toISOString(),
          addedBy: currentUser.id,
          status: 'accepted'
        }],
        permissions: {
          isPublic: false,
          allowOrgMembers: true,
          allowExternalCollaborators: false,
          requireApproval: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.id,
        version: '1.0.0',
        isPublic: false,
        context: 'user',
        stats: { forkCount: 0, starCount: 0, usageCount: 0 },
        versionHistory: [],
        tags: [],
        topics: []
      };

      setCurrentWorkflow(newWorkflow);
      setCurrentNodes([]);
      setCurrentConnections([]);
      setHasUnsavedChanges(false);

      return newId; // Return the ID so caller can navigate
    }
    throw new Error('User or organization not available');
  };

  const importWorkflow = async () => {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.workflow';
    fileInput.style.display = 'none';

    return new Promise<void>((resolve, reject) => {
      fileInput.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve();
          return;
        }

        try {
          const fileContent = await file.text();
          const workflowData = JSON.parse(fileContent);

          if (!workflowData.metadata || !workflowData.nodes || !workflowData.connections) {
            error('Invalid workflow file format. Expected metadata, nodes, and connections.');
            reject(new Error('Invalid file format'));
            return;
          }

          const importedWorkflowId = `imported-${Date.now()}`;
          // navigate(`/workflow/${importedWorkflowId}`); // TODO: Implement navigation

          const currentUser = user();
          const currentOrg = currentOrganization();

          if (currentUser && currentOrg) {
            const importedMetadata: WorkflowMetadata = {
              ...workflowData.metadata,
              id: importedWorkflowId,
              name: `${workflowData.metadata.name || 'Imported Workflow'} (Copy)`,
              organizationId: currentOrg.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: currentUser.id,
              version: '1.0.0',
              collaborators: [{
                userId: currentUser.id,
                email: currentUser.email,
                name: currentUser.name,
                avatar: currentUser.avatar || '',
                role: 'owner',
                addedAt: new Date().toISOString(),
                addedBy: currentUser.id,
                status: 'accepted'
              }],
              forkedFrom: workflowData.metadata.id ? {
                workflowId: workflowData.metadata.id,
                version: workflowData.metadata.version || '1.0.0',
                originalAuthor: workflowData.metadata.createdBy || 'Unknown',
                forkReason: 'Imported from file'
              } : undefined
            };

            setCurrentWorkflow(importedMetadata);
            setCurrentNodes(workflowData.nodes || []);
            setCurrentConnections(workflowData.connections || []);
            setHasUnsavedChanges(true);

            success(`Successfully imported workflow: ${importedMetadata.name}`);
            resolve();
          }
        } catch (err) {
          console.error('Failed to import workflow:', err);
          error(`Failed to import workflow: ${err.message || 'Invalid file format'}`);
          reject(err);
        } finally {
          document.body.removeChild(fileInput);
        }
      };

      fileInput.oncancel = () => {
        document.body.removeChild(fileInput);
        resolve();
      };

      document.body.appendChild(fileInput);
      fileInput.click();
    });
  };


  const contextValue: WorkflowContextType = {
    currentWorkflow,
    currentNodes,
    currentConnections,
    currentStoryboards,
    hasUnsavedChanges,
    workflows,
    loading,
    loadWorkflow,
    saveWorkflow,
    createNewWorkflow,
    importWorkflow,
    setNodes: setCurrentNodes,
    setConnections: setCurrentConnections,
    setStoryboards: setCurrentStoryboards,
    setHasUnsavedChanges
  };

  return (
    <WorkflowContext.Provider value={contextValue}>
      {props.children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};