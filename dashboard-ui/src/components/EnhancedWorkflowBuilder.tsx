import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { useMCP } from '../contexts/MCPContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useKVStore } from '../contexts/KVStoreContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { WorkflowEngine } from '../utils/workflowEngine';
import WorkflowManager from './WorkflowManager.tsx';
import WorkflowNodeDetails from './WorkflowNodeDetails.tsx';
import type { WorkflowMetadata, WorkflowVersion } from './WorkflowManager.tsx';
import type { WorkflowNode } from './WorkflowNodeDetails.tsx';
import {
  Play, Save, Download, Upload, Zap, Database, BarChart3, Calendar,
  Archive, Radio, Bot, Code, Funnel, Repeat, Clock, Mail,
  FileText, Settings, Cloud, Server, Shield, Globe, Hash, Image,
  MessageSquare, Phone, Slack, Github, Twitter, Linkedin, Youtube,
  ShoppingCart, CreditCard, DollarSign, TrendingUp, Users, Bell,
  Webhook, Key, Lock, Eye, Search, MapPin, Camera, Mic, Video,
  Palette, Layers, Grid3x3, Target, Gauge, Wifi, HardDrive,
  Cpu, Monitor, Smartphone, Tablet, Printer, ChevronDown, ChevronLeft,
  Send, ArrowRight, Braces, FileJson, Link, RefreshCw,
  CheckSquare, List, Trello, PieChart, Activity,
  Maximize, Minimize, RotateCcw, BookOpen, History, Share, GitBranch,
  Plus, X, AlertCircle, CheckCircle, Loader, FolderOpen
} from 'lucide-solid';

interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
}

export default function EnhancedWorkflowBuilder() {
  // View state
  const [currentView, setCurrentView] = createSignal<'manager' | 'builder'>('manager');
  const [currentWorkflow, setCurrentWorkflow] = createSignal<WorkflowMetadata | null>(null);

  // Builder state
  const [nodes, setNodes] = createSignal<WorkflowNode[]>([]);
  const [connections, setConnections] = createSignal<Connection[]>([]);
  const [selectedNode, setSelectedNode] = createSignal<WorkflowNode | null>(null);
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [showNodeDetails, setShowNodeDetails] = createSignal(false);

  // Auto-save state
  const [autoSaveTimer, setAutoSaveTimer] = createSignal<number | null>(null);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);

  // Connection state
  const [connectingFrom, setConnectingFrom] = createSignal<{ nodeId: string; port: string } | null>(null);
  const [dragConnection, setDragConnection] = createSignal<{ x: number; y: number } | null>(null);

  // Available models for agent configuration
  const [availableModels, setAvailableModels] = createSignal<string[]>([]);

  const { client, executeTool } = useMCP();
  const { success, error } = useNotifications();
  const kvStore = useKVStore();
  const { currentOrganization } = useOrganization();

  // Load available models on mount
  onMount(async () => {
    try {
      const models = await executeTool('ai-models.listModels', {});
      if (models?.available) {
        setAvailableModels(models.available);
      }
    } catch (err) {
      console.warn('Failed to load available models:', err);
      // Fallback models
      setAvailableModels([
        'claude-3-sonnet',
        'claude-3-haiku',
        'llama2-70b',
        'llama2-13b',
        'codellama-34b',
        'mistral-7b'
      ]);
    }
  });

  // Auto-save functionality
  const scheduleAutoSave = () => {
    const timer = autoSaveTimer();
    if (timer) clearTimeout(timer);

    setAutoSaveTimer(setTimeout(async () => {
      if (isDirty() && currentWorkflow()) {
        await autoSave();
      }
    }, 2000)); // Auto-save after 2 seconds of inactivity
  };

  const autoSave = async () => {
    if (!currentWorkflow() || isSaving()) return;

    setIsSaving(true);
    try {
      await saveWorkflow(false); // Don't create new version for auto-save
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Mark as dirty when nodes or connections change
  createEffect(() => {
    nodes(); // Track nodes changes
    connections(); // Track connections changes
    setIsDirty(true);
    scheduleAutoSave();
  });

  // Clean up timer on unmount
  onCleanup(() => {
    const timer = autoSaveTimer();
    if (timer) clearTimeout(timer);
  });

  // Save workflow
  const saveWorkflow = async (createVersion = true) => {
    const workflow = currentWorkflow();
    if (!workflow) return;

    try {
      const orgId = currentOrganization()?.id;
      if (!orgId) throw new Error('No organization selected');

      let updatedWorkflow = { ...workflow };

      if (createVersion) {
        // Create new version
        const newVersion: WorkflowVersion = {
          id: `${workflow.id}-v${workflow.currentVersion + 1}`,
          version: workflow.currentVersion + 1,
          name: workflow.name,
          description: workflow.description,
          nodes: nodes(),
          connections: connections(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user',
          tags: workflow.tags,
          isPublished: false,
          executionCount: 0
        };

        // Keep only last 10 versions
        const allVersions = [...workflow.versions, newVersion];
        if (allVersions.length > 10) {
          allVersions.splice(0, allVersions.length - 10);
        }

        updatedWorkflow = {
          ...workflow,
          currentVersion: newVersion.version,
          versions: allVersions,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Update current version
        if (workflow.versions.length > 0) {
          const currentVersion = workflow.versions[workflow.versions.length - 1];
          currentVersion.nodes = nodes();
          currentVersion.connections = connections();
          currentVersion.updatedAt = new Date().toISOString();

          updatedWorkflow = {
            ...workflow,
            versions: [...workflow.versions.slice(0, -1), currentVersion],
            updatedAt: new Date().toISOString()
          };
        }
      }

      // Save to KV store
      await kvStore.set(`workflow-${workflow.id}-metadata`, JSON.stringify(updatedWorkflow));

      setCurrentWorkflow(updatedWorkflow);

      if (createVersion) {
        success('Workflow version saved successfully!');
      }

      setLastSaved(new Date());
      setIsDirty(false);

    } catch (err) {
      console.error('Failed to save workflow:', err);
      error('Failed to save workflow');
      throw err;
    }
  };

  // Load workflow
  const loadWorkflow = (workflow: WorkflowMetadata) => {
    setCurrentWorkflow(workflow);

    if (workflow.versions.length > 0) {
      const latestVersion = workflow.versions[workflow.versions.length - 1];
      setNodes(latestVersion.nodes || []);
      setConnections(latestVersion.connections || []);
    } else {
      setNodes([]);
      setConnections([]);
    }

    setCurrentView('builder');
    setLastSaved(new Date(workflow.updatedAt));
    setIsDirty(false);
  };

  // Enhanced node management
  const handleNodeUpdate = (updatedNode: WorkflowNode) => {
    setNodes(nodes().map(node =>
      node.id === updatedNode.id ? updatedNode : node
    ));
    setSelectedNode(updatedNode);
  };

  const handleNodeSelect = (node: WorkflowNode) => {
    setSelectedNode(node);
    setShowNodeDetails(true);
  };

  const deleteNode = (nodeId: string) => {
    if (!confirm('Delete this node? This action cannot be undone.')) return;

    setNodes(nodes().filter(node => node.id !== nodeId));
    setConnections(connections().filter(conn =>
      conn.from !== nodeId && conn.to !== nodeId
    ));

    if (selectedNode()?.id === nodeId) {
      setSelectedNode(null);
      setShowNodeDetails(false);
    }
  };

  // Enhanced connection system
  const startConnection = (nodeId: string, port: string, event: MouseEvent) => {
    event.stopPropagation();
    setConnectingFrom({ nodeId, port });
    setDragConnection({ x: event.clientX, y: event.clientY });

    const handleMouseMove = (e: MouseEvent) => {
      setDragConnection({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setConnectingFrom(null);
      setDragConnection(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const finishConnection = (toNodeId: string, toPort: string, event: MouseEvent) => {
    event.stopPropagation();
    const from = connectingFrom();

    if (from && from.nodeId !== toNodeId) {
      const connectionId = `${from.nodeId}-${from.port}-${toNodeId}-${toPort}`;

      // Check if connection already exists
      const exists = connections().some(conn =>
        conn.from === from.nodeId && conn.to === toNodeId
      );

      if (!exists) {
        const newConnection: Connection = {
          id: connectionId,
          from: from.nodeId,
          to: toNodeId,
          fromPort: from.port,
          toPort: toPort
        };

        setConnections([...connections(), newConnection]);
      }
    }

    setConnectingFrom(null);
    setDragConnection(null);
  };

  const deleteConnection = (connectionId: string) => {
    setConnections(connections().filter(conn => conn.id !== connectionId));
  };

  // Workflow execution
  const runWorkflow = async () => {
    if (nodes().length === 0) {
      error('Please add some nodes to your workflow first!');
      return;
    }

    const triggerNode = nodes().find(node => node.type === 'trigger');
    if (!triggerNode) {
      error('Please add a Trigger node to start your workflow!');
      return;
    }

    setIsExecuting(true);

    try {
      const workflow = {
        nodes: nodes(),
        connections: connections(),
        metadata: currentWorkflow()
      };

      const engine = new WorkflowEngine(client());

      success('🚀 Starting workflow execution...');
      console.log('Running workflow:', workflow);

      const result = await engine.executeWorkflow(workflow);

      success('✅ Workflow executed successfully!');
      console.log('Workflow execution result:', result);

      // Update execution stats
      const workflow_ = currentWorkflow();
      if (workflow_) {
        workflow_.executionStats.totalExecutions += 1;
        workflow_.executionStats.lastExecuted = new Date().toISOString();
        setCurrentWorkflow(workflow_);
        await saveWorkflow(false);
      }

    } catch (err) {
      console.error('Workflow execution failed:', err);
      error(`❌ Workflow execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Render workflow manager view
  const renderManager = () => (
    <WorkflowManager
      onSelectWorkflow={loadWorkflow}
      onNewWorkflow={() => {
        const newWorkflow: WorkflowMetadata = {
          id: `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `Untitled Workflow`,
          description: '',
          currentVersion: 1,
          versions: [{
            id: `wf-${Date.now()}-v1`,
            version: 1,
            name: 'Initial Version',
            description: '',
            nodes: [],
            connections: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'current-user',
            tags: [],
            isPublished: false,
            executionCount: 0
          }],
          totalVersions: 1,
          isStarred: false,
          isTemplate: false,
          collaborators: [],
          organizationId: currentOrganization()?.id || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user',
          tags: [],
          category: 'automation',
          executionStats: {
            totalExecutions: 0,
            successRate: 0,
            avgDuration: 0
          }
        };

        loadWorkflow(newWorkflow);
      }}
    />
  );

  // Render workflow builder toolbar
  const renderToolbar = () => (
    <div class="workflow-toolbar flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60">
      <div class="flex items-center gap-4">
        <button
          class="btn btn-secondary flex items-center gap-2"
          onClick={() => setCurrentView('manager')}
        >
          <FolderOpen class="w-4 h-4" />
          Workflows
        </button>

        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">
            {currentWorkflow()?.name || 'Untitled Workflow'}
          </h1>

          <Show when={isDirty()}>
            <div class="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertCircle class="w-3 h-3" />
              Unsaved
            </div>
          </Show>

          <Show when={isSaving()}>
            <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <Loader class="w-3 h-3 animate-spin" />
              Saving...
            </div>
          </Show>

          <Show when={lastSaved()}>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Saved {lastSaved()?.toLocaleTimeString()}
            </div>
          </Show>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="btn btn-secondary flex items-center gap-2 text-sm"
          onClick={() => saveWorkflow(true)}
          disabled={!isDirty() || isSaving()}
        >
          <Save class="w-4 h-4" />
          Save Version
        </button>

        <button
          class={`btn flex items-center gap-2 text-sm ${isExecuting() ? 'btn-secondary opacity-75' : 'btn-primary'}`}
          onClick={runWorkflow}
          disabled={isExecuting()}
        >
          <Play class={`w-4 h-4 ${isExecuting() ? 'animate-spin' : ''}`} />
          {isExecuting() ? 'Executing...' : 'Run Workflow'}
        </button>
      </div>
    </div>
  );

  return (
    <div class="enhanced-workflow-builder h-screen flex flex-col">
      <Show when={currentView() === 'manager'} fallback={
        <>
          {renderToolbar()}
          <div class="flex-1 flex">
            {/* Node sidebar would go here - simplified for now */}
            <div class="w-80 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-r border-slate-200/60 dark:border-slate-700/60 p-4">
              <h3 class="font-semibold text-slate-900 dark:text-white mb-4">
                Available Nodes
              </h3>
              <div class="text-sm text-slate-600 dark:text-slate-400">
                Drag nodes to canvas to build workflow
              </div>
            </div>

            {/* Canvas */}
            <div class="flex-1 relative bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
              <div class="absolute inset-0 opacity-20">
                <div class="grid-pattern"></div>
              </div>

              <div class="relative w-full h-full">
                {/* Nodes */}
                <For each={nodes()}>
                  {(node) => (
                    <div
                      class="absolute cursor-pointer"
                      style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                        transform: 'translate3d(0, 0, 0)',
                        'z-index': '2'
                      }}
                      onClick={() => handleNodeSelect(node)}
                    >
                      <div class={`bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 rounded-lg p-4 min-w-48 shadow-sm hover:shadow-md transition-all ${
                        selectedNode()?.id === node.id ? 'border-blue-500 shadow-blue-200 dark:border-blue-400 dark:shadow-blue-900/50' : 'border-slate-200/60 dark:border-slate-700/60'
                      }`}>
                        <div class="flex items-center gap-3">
                          <div class="p-2 rounded-lg bg-blue-500 text-white">
                            <Bot class="w-4 h-4" />
                          </div>
                          <div>
                            <h3 class="font-semibold text-sm text-slate-900 dark:text-white">
                              {node.title || node.type}
                            </h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400">
                              {node.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>

                {/* Empty state */}
                <Show when={nodes().length === 0}>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="text-center">
                      <Bot class="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                      <h3 class="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
                        Start Building Your Workflow
                      </h3>
                      <p class="text-slate-500 dark:text-slate-400">
                        Drag nodes from the sidebar to create your automation
                      </p>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          {/* Node Details Panel */}
          <Show when={showNodeDetails() && selectedNode()}>
            <WorkflowNodeDetails
              node={selectedNode()}
              onUpdate={handleNodeUpdate}
              onClose={() => setShowNodeDetails(false)}
              availableModels={availableModels()}
            />
          </Show>
        </>
      }>
        {renderManager()}
      </Show>

      <style jsx>{`
        .grid-pattern {
          background-image:
            linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}