import { createContext, useContext, createSignal, ParentComponent, JSX } from 'solid-js';

export interface WorkflowUIState {
  // Panel visibility
  isNodesPanelVisible: () => boolean;
  setIsNodesPanelVisible: (visible: boolean) => void;
  toggleNodesPanel: () => void;

  // Panel positions
  toolbarPosition: () => { x: number; y: number };
  setToolbarPosition: (pos: { x: number; y: number }) => void;
  nodePanelPosition: () => { x: number; y: number };
  setNodePanelPosition: (pos: { x: number; y: number }) => void;

  // Panel pinning states
  isNodePanelPinned: () => boolean;
  setIsNodePanelPinned: (pinned: boolean) => void;

  // Selected node (for details panel)
  selectedNode: () => any;
  setSelectedNode: (node: any) => void;

  // Selected storyboard
  selectedStoryboard: () => any;
  setSelectedStoryboard: (storyboard: any) => void;

  // Grid and canvas view state
  gridMode: () => 'off' | 'grid' | 'dots';
  setGridMode: (mode: 'off' | 'grid' | 'dots' | ((prev: 'off' | 'grid' | 'dots') => 'off' | 'grid' | 'dots')) => void;
  canvasOffset: () => { x: number; y: number };
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  zoom: () => number;
  setZoom: (zoom: number) => void;

  // Agent chat state
  agentChatState: () => 'launcher' | 'agentchat' | 'planning';
  setAgentChatState: (state: 'launcher' | 'agentchat' | 'planning') => void;
  agentChatPosition: () => { x: number; y: number };
  setAgentChatPosition: (pos: { x: number; y: number }) => void;
  isAgentChatPinned: () => boolean;
  setIsAgentChatPinned: (pinned: boolean) => void;
}

const WorkflowUIContext = createContext<WorkflowUIState>();

export const WorkflowUIProvider: ParentComponent<{ children: JSX.Element }> = (props) => {
  // Panel visibility states
  const [isNodesPanelVisible, setIsNodesPanelVisible] = createSignal(true);

  // Panel positions
  const [toolbarPosition, setToolbarPosition] = createSignal({
    x: Math.max(20, (window.innerWidth / 2) - 200),
    y: 20
  });
  const [nodePanelPosition, setNodePanelPosition] = createSignal({
    x: Math.max(window.innerWidth - 340, 20), // Ensure it's not too far right and has margin
    y: 80 // Add some top margin so it's below the toolbar
  });

  // Panel pinning states
  const [isNodePanelPinned, setIsNodePanelPinned] = createSignal(true);

  // Selected node (for details panel)
  const [selectedNode, setSelectedNode] = createSignal<any>(null);

  // Selected storyboard
  const [selectedStoryboard, setSelectedStoryboard] = createSignal<any>(null);

  // Grid and canvas view state
  const [gridMode, setGridMode] = createSignal<'off' | 'grid' | 'dots'>('grid');
  const [canvasOffset, setCanvasOffset] = createSignal({ x: 0, y: 0 });
  const [zoom, setZoom] = createSignal(1);

  // Agent chat state
  const [agentChatState, setAgentChatState] = createSignal<'launcher' | 'agentchat' | 'planning'>('launcher');
  const [agentChatPosition, setAgentChatPosition] = createSignal({ x: 20, y: 20 });
  const [isAgentChatPinned, setIsAgentChatPinned] = createSignal(false);

  const toggleNodesPanel = () => {
    const currentValue = isNodesPanelVisible();
    const newValue = !currentValue;
    console.log('🔄 Toggling nodes panel:', { from: currentValue, to: newValue });
    setIsNodesPanelVisible(newValue);
  };

  const value: WorkflowUIState = {
    isNodesPanelVisible,
    setIsNodesPanelVisible,
    toggleNodesPanel,
    toolbarPosition,
    setToolbarPosition,
    nodePanelPosition,
    setNodePanelPosition,
    isNodePanelPinned,
    setIsNodePanelPinned,
    selectedNode,
    setSelectedNode,
    selectedStoryboard,
    setSelectedStoryboard,
    gridMode,
    setGridMode,
    canvasOffset,
    setCanvasOffset,
    zoom,
    setZoom,
    agentChatState,
    setAgentChatState,
    agentChatPosition,
    setAgentChatPosition,
    isAgentChatPinned,
    setIsAgentChatPinned,
  };

  return (
    <WorkflowUIContext.Provider value={value}>
      {props.children}
    </WorkflowUIContext.Provider>
  );
};

export function useWorkflowUI(): WorkflowUIState {
  const context = useContext(WorkflowUIContext);
  if (!context) {
    throw new Error('useWorkflowUI must be used within a WorkflowUIProvider');
  }
  return context;
}