import { createSignal, createEffect, Show, onMount, onCleanup, JSX } from 'solid-js';
import { DragDropProvider, useDragDrop, useDropZone } from '../../../contexts/DragDropContext';
import { useWorkflow } from '../../../contexts/WorkflowContext';
import { WorkflowUIProvider, useWorkflowUI } from '../../../contexts/WorkflowUIContext';
import { useAutoSave } from '../../../hooks/useAutoSave';
import WorkflowCanvas from './WorkflowCanvas';
import FloatingToolbar from '../ui/FloatingToolbar';
import FloatingNodePanel from '../ui/FloatingNodePanel';
import WorkflowNodeDetails from '../ui/WorkflowNodeDetails';

interface WorkflowCanvasManagerProps {
  workflowId?: string;
  onBack?: () => void;
  navigationPinned?: boolean;
  // Workflow info props
  onWorkflowRename?: (newName: string) => void;
  // Modal state props
  showWorkflowBrowser?: boolean;
  onSetShowWorkflowBrowser?: (show: boolean) => void;
  // Navigation props
  onNavigate?: (page: string) => void;
}

// Inner component that uses the drag drop context
function WorkflowCanvasManagerInner(props: WorkflowCanvasManagerProps) {
  // Canvas references
  const [canvasRef, setCanvasRef] = createSignal<HTMLDivElement>();

  // UI state
  const showWorkflowBrowser = () => props.showWorkflowBrowser ?? !props.workflowId;
  const setShowWorkflowBrowser = (show: boolean) => props.onSetShowWorkflowBrowser?.(show);
  const [connectedIntegrations, setConnectedIntegrations] = createSignal<string[]>([]);
  const [isPanMode, setIsPanMode] = createSignal(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = createSignal(true); // TODO: Load from user preferences

  // Context hooks
  const workflow = useWorkflow();
  const dragDrop = useDragDrop();
  const workflowUI = useWorkflowUI();

  // Auto-save hook - watches for changes and saves automatically
  const autoSave = useAutoSave(
    () => ({ nodes: workflow.currentNodes(), connections: workflow.currentConnections() }),
    {
      enabled: autoSaveEnabled(),
      debounceMs: 2000, // 2 second debounce
      onSave: async () => {
        await workflow.saveWorkflow();
      }
    }
  );

  // Update canvas transform in drag context when canvas moves
  createEffect(() => {
    dragDrop.setCanvasTransform(workflowUI.canvasOffset(), workflowUI.zoom());
  });

  // Register canvas as drop zone
  useDropZone(
    canvasRef,
    (data: any, canvasPosition: { x: number; y: number }) => {
      console.log('🎯 Canvas drop received:', { data, canvasPosition });

      // Validate drop data
      const nodeType = typeof data === 'string' ? data : data?.type;
      if (!nodeType || !nodeType.trim()) {
        console.log('❌ Invalid node type:', data);
        return false;
      }

      // Create new node
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType,
        x: canvasPosition.x - 60, // Center on cursor
        y: canvasPosition.y - 30,
        inputs: getNodeInputs(nodeType),
        outputs: getNodeOutputs(nodeType),
        config: {},
        title: formatNodeTitle(nodeType),
        description: `${formatNodeTitle(nodeType)} node`,
        enabled: true
      };

      console.log('✅ Creating node:', newNode);

      // Add to workflow
      const currentNodes = workflow.currentNodes();
      workflow.setNodes([...currentNodes, newNode as any]);
      workflow.setHasUnsavedChanges(true);

      // Select the new node
      workflowUI.setSelectedNode(newNode as any);

      return true;
    }
  );


  // Welcome screen logic is handled by the workflow browser overlay

  // Helper functions for node configuration
  const getNodeInputs = (nodeType: string): string[] => {
    const triggerTypes = ['trigger', 'webhook', 'schedule', 'lead-capture'];
    return triggerTypes.includes(nodeType) ? [] : ['input'];
  };

  const getNodeOutputs = (nodeType: string): string[] => {
    const outputTypes = ['output', 'send-email', 'notification'];
    return outputTypes.includes(nodeType) ? [] : ['output'];
  };

  const formatNodeTitle = (nodeType: string): string => {
    return nodeType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Load template nodes based on selected template
  const loadTemplate = (templateId: string) => {
    const templates = {
      'customer-journey': [
        { type: 'lead-capture', x: 150, y: 100, title: 'Lead Capture' },
        { type: 'lead-qualification', x: 350, y: 100, title: 'Lead Qualification' },
        { type: 'customer-onboarding', x: 550, y: 100, title: 'Customer Onboarding' },
        { type: 'customer-success', x: 750, y: 100, title: 'Customer Success' }
      ],
      'sales-pipeline': [
        { type: 'lead-qualification', x: 150, y: 100, title: 'Lead Qualification' },
        { type: 'sales-opportunity', x: 350, y: 100, title: 'Sales Opportunity' },
        { type: 'proposal-generation', x: 550, y: 100, title: 'Proposal Generation' },
        { type: 'deal-closing', x: 750, y: 100, title: 'Deal Closing' }
      ],
      'support-flow': [
        { type: 'support-ticket', x: 150, y: 100, title: 'Support Ticket' },
        { type: 'issue-escalation', x: 350, y: 100, title: 'Issue Escalation' },
        { type: 'quality-assurance', x: 550, y: 100, title: 'Quality Assurance' },
        { type: 'knowledge-update', x: 750, y: 100, title: 'Knowledge Update' }
      ],
      'marketing-engine': [
        { type: 'campaign-launch', x: 150, y: 100, title: 'Campaign Launch' },
        { type: 'content-creation', x: 350, y: 100, title: 'Content Creation' },
        { type: 'social-engagement', x: 550, y: 100, title: 'Social Engagement' },
        { type: 'analytics-review', x: 750, y: 100, title: 'Analytics Review' }
      ]
    };

    const template = templates[templateId];
    if (template) {
      const nodes = template.map((nodeData, index) => ({
        id: `node-${Date.now()}-${index}`,
        type: nodeData.type,
        x: nodeData.x,
        y: nodeData.y,
        inputs: getNodeInputs(nodeData.type),
        outputs: getNodeOutputs(nodeData.type),
        config: {},
        title: nodeData.title,
        description: `${nodeData.title} process`,
        enabled: true
      }));

      // Create connections between nodes
      const connections = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        if (nodes[i].outputs.length > 0 && nodes[i + 1].inputs.length > 0) {
          connections.push({
            id: `connection-${i}`,
            from: nodes[i].id,
            to: nodes[i + 1].id,
            fromPort: nodes[i].outputs[0],
            toPort: nodes[i + 1].inputs[0]
          });
        }
      }

      workflow.setNodes(nodes);
      workflow.setConnections(connections);
    }
  };

  // Canvas background classes with zoom-responsive grid
  const getBackgroundClasses = () => {
    const baseClasses = "w-full h-full relative overflow-hidden";
    const gridSize = Math.max(8, 20 * workflowUI.zoom()); // Scale grid with zoom, minimum 8px

    switch (workflowUI.gridMode()) {
      case 'grid':
        return `${baseClasses} bg-gray-50 dark:bg-gray-900`;
      case 'dots':
        return `${baseClasses} bg-gray-50 dark:bg-gray-900`;
      default:
        return `${baseClasses} bg-gray-50 dark:bg-gray-900`;
    }
  };

  // Dynamic background style with zoom-responsive grid
  const getBackgroundStyle = () => {
    const gridSize = Math.max(8, 20 * workflowUI.zoom());
    const offset = workflowUI.canvasOffset();

    const style: any = {
      'background-position': `${offset.x}px ${offset.y}px`
    };

    switch (workflowUI.gridMode()) {
      case 'grid':
        style['background-image'] = `
          linear-gradient(to right, rgba(128,128,128,1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(128,128,128,1) 1px, transparent 1px)
        `;
        style['background-size'] = `${gridSize}px ${gridSize}px`;
        break;
      case 'dots':
        style['background-image'] = `radial-gradient(circle, rgba(128,128,128,1) 1px, transparent 1px)`;
        style['background-size'] = `${gridSize}px ${gridSize}px`;
        break;
    }

    return style;
  };

  // Canvas view controls
  const handleToggleGrid = () => {
    workflowUI.setGridMode((current: 'grid' | 'off' | 'dots') => {
      switch (current) {
        case 'off': return 'grid';
        case 'grid': return 'dots';
        case 'dots': return 'grid';
        default: return 'grid';
      }
    });
  };

  const handleToggleGridOff = () => {
    workflowUI.setGridMode((current: 'grid' | 'off' | 'dots') => current === 'off' ? 'grid' : 'off');
  };


  return (
    <div class="workflow-canvas-manager absolute inset-0 overflow-hidden">
      {/* Full-screen canvas background with drop zone */}
      <div
        ref={setCanvasRef}
        class={getBackgroundClasses()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          'z-index': 1,
          ...getBackgroundStyle()
        }}
        data-canvas="true"
      >
        {/* Canvas component for nodes and connections */}
        <WorkflowCanvas
          nodes={workflow.currentNodes() as any}
          setNodes={workflow.setNodes as any}
          connections={workflow.currentConnections() as any}
          setConnections={workflow.setConnections as any}
          selectedNode={workflowUI.selectedNode()}
          setSelectedNode={workflowUI.setSelectedNode}
          showWelcome={false}
          onCreateNew={async () => {
            const newId = await workflow.createNewWorkflow();
            props.onCreateNewWorkflow?.();
          }}
          onBrowseWorkflows={() => setShowWorkflowBrowser(true)}
          gridMode={workflowUI.gridMode()}
          canvasOffset={workflowUI.canvasOffset()}
          setCanvasOffset={workflowUI.setCanvasOffset}
          zoom={workflowUI.zoom()}
          setZoom={workflowUI.setZoom}
          isNodePanelPinned={workflowUI.isNodePanelPinned()}
          isPanMode={isPanMode()}
        />

      </div>

      {/* Floating overlays with higher z-index */}
      <div class="absolute inset-0 pointer-events-none" style={{ 'z-index': 10 }}>
        {/* Floating Toolbar */}
        <div class="pointer-events-auto">
            <FloatingToolbar
              onSave={autoSave.forceSave}
              onLoad={workflow.importWorkflow}
              autoSaveEnabled={autoSaveEnabled()}
              onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled())}
              isSaving={autoSave.isSaving()}
              lastSaved={autoSave.lastSaved()}
              onRun={() => {
                // TODO: Implement workflow execution
                console.log('Running workflow...');
              }}
              onClear={() => {
                workflow.setNodes([]);
                workflow.setConnections([]);
                workflowUI.setSelectedNode(null);
                workflow.setHasUnsavedChanges(true);
              }}
              onBack={props.onBack}
              onShare={() => {
                // TODO: Implement sharing
                console.log('Sharing workflow...');
              }}
              onToggleGrid={handleToggleGrid}
              onToggleGridOff={handleToggleGridOff}
              onToggleNodesPanel={workflowUI.toggleNodesPanel}
              isNodesPanelVisible={workflowUI.isNodesPanelVisible()}
              onTogglePanMode={() => setIsPanMode(!isPanMode())}
              isPanMode={isPanMode()}
              gridMode={workflowUI.gridMode()}
              hasUnsavedChanges={workflow.hasUnsavedChanges()}
              isExecuting={false}
              onPositionChange={(x, y) => workflowUI.setToolbarPosition({ x, y })}
              initialPosition={workflowUI.toolbarPosition()}
              navigationPinned={props.navigationPinned}
              currentWorkflow={workflow.currentWorkflow() ? {
                ...workflow.currentWorkflow()!
              } as any : undefined}
              onWorkflowRename={props.onWorkflowRename}
            />
        </div>

        {/* Floating Node Panel */}
        <Show when={workflowUI.isNodesPanelVisible()}>
          <div class="pointer-events-auto">
            <FloatingNodePanel
              onDragStart={(nodeType) => {
                console.log('Node drag started:', nodeType);
                // The actual drag is handled by the DragDropContext
              }}
              connectedApps={connectedIntegrations()}
              onConnectApp={(integration) => {
                window.location.href = `/settings?connect=${integration}`;
              }}
              onPositionChange={(x, y) => workflowUI.setNodePanelPosition({ x, y })}
              initialPosition={workflowUI.nodePanelPosition()}
              selectedNode={workflowUI.selectedNode()}
              onNodeUpdate={(updatedNode) => {
                const currentNodes = workflow.currentNodes();
                workflow.setNodes(
                  currentNodes.map(n => n.id === updatedNode.id ? { ...n, ...updatedNode } : n)
                );
                workflowUI.setSelectedNode(null); // Clear selection after save
                workflow.setHasUnsavedChanges(true);
              }}
              availableModels={['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo']}
              onPinnedChange={workflowUI.setIsNodePanelPinned}
              onVisibilityChange={workflowUI.setIsNodesPanelVisible}
              onNavigate={props.onNavigate}
            />
          </div>
        </Show>

        {/* Node Details Panel - DISABLED: Now integrated into FloatingNodePanel */}
        {/* <Show when={workflowUI.selectedNode()}>
          <div class="absolute top-4 right-4 z-40 w-80 pointer-events-auto">
            <WorkflowNodeDetails
              node={workflowUI.selectedNode()!}
              onUpdate={(updatedNode) => {
                const currentNodes = workflow.currentNodes();
                workflow.setNodes(
                  currentNodes.map(n => n.id === updatedNode.id ? updatedNode : n)
                );
                workflowUI.setSelectedNode(updatedNode);
                workflow.setHasUnsavedChanges(true);
              }}
              onClose={() => workflowUI.setSelectedNode(null)}
              availableModels={['claude-3-sonnet', 'claude-3-haiku', 'gpt-4', 'gpt-3.5-turbo']}
            />
          </div>
        </Show> */}
      </div>

    </div>
  );
}

// Main component with providers
export default function WorkflowCanvasManager(props: WorkflowCanvasManagerProps) {
  return (
    <DragDropProvider>
      <WorkflowUIProvider>
        <WorkflowCanvasManagerInner {...props} />
      </WorkflowUIProvider>
    </DragDropProvider>
  );
}