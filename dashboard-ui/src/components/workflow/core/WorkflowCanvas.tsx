import { createSignal, createEffect, For, onMount, onCleanup, Show, createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Plus, Sparkles, ZoomIn, ZoomOut, RotateCcw, Hand } from 'lucide-solid';
import ConnectionToolbar, { ConnectionStyle } from '../ui/ConnectionToolbar';
import { ChartRenderer, type ChartConfig } from '@ai-agent-bus/datavis-nodes';
import { ShapeRenderer, type ShapeType } from '@ai-agent-bus/shapes';

export interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  inputs: string[];
  outputs: string[];
  config: { [key: string]: any };
  title?: string;
  description?: string;
  enabled?: boolean;
}

export interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  style?: ConnectionStyle;
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

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  setNodes: (nodes: WorkflowNode[]) => void;
  connections: WorkflowConnection[];
  setConnections: (connections: WorkflowConnection[]) => void;
  selectedNode: WorkflowNode | null;
  setSelectedNode: (node: WorkflowNode | null) => void;
  showWelcome?: boolean;
  onCreateNew?: () => void;
  onBrowseWorkflows?: () => void;
  gridMode?: 'off' | 'grid' | 'dots';
  // Canvas transform props
  canvasOffset?: { x: number; y: number };
  setCanvasOffset?: (offset: { x: number; y: number }) => void;
  zoom?: number;
  setZoom?: (zoom: number) => void;
  isNodePanelPinned?: boolean;
  // Pan mode for hand tool
  isPanMode?: boolean;
  // Storyboard props
  storyboards?: Storyboard[];
  setStoryboards?: (storyboards: Storyboard[]) => void;
  selectedStoryboard?: Storyboard | null;
  setSelectedStoryboard?: (storyboard: Storyboard | null) => void;
}

interface DragState {
  isDragging: boolean;
  dragType: 'node' | 'connection' | 'canvas' | 'resize' | null;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  dragNode: WorkflowNode | null;
  connectionStart: { nodeId: string; port: string; type: 'input' | 'output' } | null;
  resizeNode: WorkflowNode | null;
  resizeHandle: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w' | null;
  initialNodeSize: { width: number; height: number } | null;
}

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  const [canvasRef, setCanvasRef] = createSignal<HTMLDivElement>();
  const [svgRef, setSvgRef] = createSignal<SVGSVGElement>();
  const [dragState, setDragState] = createStore<DragState>({
    isDragging: false,
    dragType: null,
    startPos: { x: 0, y: 0 },
    currentPos: { x: 0, y: 0 },
    dragNode: null,
    connectionStart: null,
    resizeNode: null,
    resizeHandle: null,
    initialNodeSize: null
  });

  // Use props for canvas transform if provided, otherwise use local state
  const canvasOffset = () => props.canvasOffset || { x: 0, y: 0 };
  const setCanvasOffset = (offset: { x: number; y: number }) => {
    props.setCanvasOffset?.(offset);
  };
  const zoom = () => props.zoom || 1;
  const setZoom = (newZoom: number) => {
    props.setZoom?.(newZoom);
  };

  const [tempConnection, setTempConnection] = createSignal<{ from: { x: number; y: number }; to: { x: number; y: number }; fromNode?: string; fromPort?: string; portType?: 'input' | 'output' } | null>(null);
  const [hoveredPort, setHoveredPort] = createSignal<{ nodeId: string; port: string; type: 'input' | 'output' } | null>(null);
  const [hoveredConnection, setHoveredConnection] = createSignal<string | null>(null);

  // Connection toolbar state
  const [selectedConnection, setSelectedConnection] = createSignal<string | null>(null);
  const [connectionToolbarPosition, setConnectionToolbarPosition] = createSignal<{ x: number; y: number } | null>(null);

  // Business process configuration for rendering
  const getNodeConfig = (nodeType: string, node?: WorkflowNode) => {
    const configs = {
      // Customer Journey
      'lead-capture': { color: 'bg-emerald-500', width: 140, height: 70 },
      'lead-qualification': { color: 'bg-emerald-600', width: 140, height: 70 },
      'customer-onboarding': { color: 'bg-emerald-700', width: 140, height: 70 },
      'customer-success': { color: 'bg-emerald-800', width: 140, height: 70 },

      // Sales Process
      'sales-opportunity': { color: 'bg-blue-500', width: 140, height: 70 },
      'proposal-generation': { color: 'bg-blue-600', width: 140, height: 70 },
      'contract-review': { color: 'bg-blue-700', width: 140, height: 70 },
      'deal-closing': { color: 'bg-blue-800', width: 140, height: 70 },

      // Support & Operations
      'support-ticket': { color: 'bg-amber-500', width: 140, height: 70 },
      'issue-escalation': { color: 'bg-amber-600', width: 140, height: 70 },
      'quality-assurance': { color: 'bg-amber-700', width: 140, height: 70 },
      'knowledge-update': { color: 'bg-amber-800', width: 140, height: 70 },

      // Marketing & Growth
      'campaign-launch': { color: 'bg-purple-500', width: 140, height: 70 },
      'content-creation': { color: 'bg-purple-600', width: 140, height: 70 },
      'social-engagement': { color: 'bg-purple-700', width: 140, height: 70 },
      'analytics-review': { color: 'bg-purple-800', width: 140, height: 70 },

      // Finance & Admin
      'invoice-processing': { color: 'bg-indigo-500', width: 140, height: 70 },
      'expense-approval': { color: 'bg-indigo-600', width: 140, height: 70 },
      'compliance-check': { color: 'bg-indigo-700', width: 140, height: 70 },
      'report-generation': { color: 'bg-indigo-800', width: 140, height: 70 },

      // Legacy technical types (for backward compatibility)
      'trigger': { color: 'bg-green-500', width: 120, height: 60 },
      'webhook': { color: 'bg-green-600', width: 120, height: 60 },
      'schedule': { color: 'bg-green-700', width: 120, height: 60 },
      'output': { color: 'bg-blue-500', width: 120, height: 60 },
      'email': { color: 'bg-blue-600', width: 120, height: 60 },
      'notification': { color: 'bg-blue-700', width: 120, height: 60 },

      // Shape nodes
      'rectangle': { shape: 'rectangle', color: 'bg-gray-500', width: 120, height: 80 },
      'circle': { shape: 'circle', color: 'bg-blue-500', width: 80, height: 80 },
      'triangle': { shape: 'triangle', color: 'bg-yellow-500', width: 80, height: 80 },
      'diamond': { shape: 'diamond', color: 'bg-purple-500', width: 80, height: 80 },
      'arrow': { shape: 'arrow', color: 'bg-green-500', width: 100, height: 60 },
      'hexagon': { shape: 'hexagon', color: 'bg-indigo-500', width: 80, height: 80 },
      'star': { shape: 'star', color: 'bg-orange-500', width: 80, height: 80 },
      'heart': { shape: 'heart', color: 'bg-red-500', width: 80, height: 80 },
      'sticky-note': { shape: 'sticky-note', color: 'bg-yellow-300', width: 120, height: 100, fontFamily: 'cursive', textColor: '#1f2937' },

      'default': { color: 'bg-gray-500', width: 140, height: 70 }
    };
    const baseConfig = configs[nodeType] || configs.default;

    // Use custom dimensions if available
    return {
      ...baseConfig,
      width: node?.width || baseConfig.width,
      height: node?.height || baseConfig.height
    };
  };

  // Shape rendering is now handled by the ShapeRenderer component from @ai-agent-bus/shapes

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number) => {
    const canvas = canvasRef();
    if (!canvas) return { x: screenX, y: screenY };

    const rect = canvas.getBoundingClientRect();
    const offset = canvasOffset();
    return {
      x: (screenX - rect.left - offset.x) / zoom(),
      y: (screenY - rect.top - offset.y) / zoom()
    };
  };

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (canvasX: number, canvasY: number) => {
    const canvas = canvasRef();
    if (!canvas) return { x: canvasX, y: canvasY };

    const rect = canvas.getBoundingClientRect();
    const offset = canvasOffset();
    return {
      x: canvasX * zoom() + offset.x + rect.left,
      y: canvasY * zoom() + offset.y + rect.top
    };
  };

  // Default connection style
  const getDefaultConnectionStyle = (): ConnectionStyle => ({
    strokeWidth: 2,
    color: '#6b7280', // Subtle gray instead of bright blue
    startArrow: 'none',
    endArrow: 'arrow'
  });

  // Get connection style with defaults
  const getConnectionStyle = (connection: WorkflowConnection): ConnectionStyle => {
    const defaultStyle = getDefaultConnectionStyle();
    const customStyle = connection.style || {};
    return { ...defaultStyle, ...customStyle };
  };

  // Get marker URL for arrow types
  const getMarkerUrl = (arrowType: string, position: 'start' | 'end'): string => {
    if (arrowType === 'none') return '';
    return `url(#${arrowType}-${position})`;
  };

  // Reactive connection data that updates when nodes or connections change
  const connectionData = createMemo(() => {
    return props.connections.map(connection => {
      const fromNode = props.nodes.find(n => n.id === connection.from);
      const toNode = props.nodes.find(n => n.id === connection.to);

      if (!fromNode || !toNode) return null;

      const fromPos = getPortPosition(fromNode, connection.fromPort, 'output');
      const toPos = getPortPosition(toNode, connection.toPort, 'input');

      // Calculate bezier curve with proper directional flow
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(distance * 0.4, 80);

      // Calculate the angle of the direct connection
      const angle = Math.atan2(dy, dx);

      // Create control points that create proper tangent directions
      // Start tangent: horizontal (from output port)
      const fromControl = {
        x: fromPos.x + curvature,
        y: fromPos.y
      };

      // End tangent: angled toward the connection direction for better arrow orientation
      const endTangentLength = Math.min(curvature, 40);
      const toControl = {
        x: toPos.x - endTangentLength * Math.cos(angle),
        y: toPos.y - endTangentLength * Math.sin(angle)
      };

      return {
        connection,
        fromPos,
        toPos,
        fromControl,
        toControl,
        path: `M ${fromPos.x} ${fromPos.y} C ${fromControl.x} ${fromControl.y} ${toControl.x} ${toControl.y} ${toPos.x} ${toPos.y}`
      };
    }).filter(Boolean);
  });

  // Get connection port position
  const getPortPosition = (node: WorkflowNode, port: string, type: 'input' | 'output') => {
    const config = getNodeConfig(node.type, node);
    const portIndex = type === 'input' ? node.inputs.indexOf(port) : node.outputs.indexOf(port);
    const totalPorts = type === 'input' ? node.inputs.length : node.outputs.length;

    const portSpacing = config.width / (totalPorts + 1);
    const x = node.x + portSpacing * (portIndex + 1);
    const y = type === 'input' ? node.y : node.y + config.height;

    return { x, y };
  };

  // Check if connection is valid
  const isValidConnection = (fromNode: WorkflowNode, fromPort: string, fromType: 'input' | 'output', toNode: WorkflowNode, toPort: string, toType: 'input' | 'output') => {
    // Can't connect to same node
    if (fromNode.id === toNode.id) return false;

    // Must connect output to input
    if (fromType === toType) return false;

    // Check if connection already exists
    const existingConnection = props.connections.find(conn =>
      (conn.from === fromNode.id && conn.to === toNode.id && conn.fromPort === fromPort && conn.toPort === toPort) ||
      (conn.from === toNode.id && conn.to === fromNode.id && conn.fromPort === toPort && conn.toPort === fromPort)
    );

    return !existingConnection;
  };

  // Find nearby port for snapping
  const findNearbyPort = (screenX: number, screenY: number, maxDistance: number = 30) => {
    const canvasPos = screenToCanvas(screenX, screenY);

    for (const node of props.nodes) {
      const config = getNodeConfig(node.type, node);

      // Check input ports
      for (let i = 0; i < node.inputs.length; i++) {
        const portPos = getPortPosition(node, node.inputs[i], 'input');
        const distance = Math.sqrt(Math.pow(canvasPos.x - portPos.x, 2) + Math.pow(canvasPos.y - portPos.y, 2));

        if (distance <= maxDistance) {
          return { nodeId: node.id, port: node.inputs[i], type: 'input' as const, position: portPos };
        }
      }

      // Check output ports
      for (let i = 0; i < node.outputs.length; i++) {
        const portPos = getPortPosition(node, node.outputs[i], 'output');
        const distance = Math.sqrt(Math.pow(canvasPos.x - portPos.x, 2) + Math.pow(canvasPos.y - portPos.y, 2));

        if (distance <= maxDistance) {
          return { nodeId: node.id, port: node.outputs[i], type: 'output' as const, position: portPos };
        }
      }
    }

    return null;
  };

  // Resize functionality
  const handleResizeStart = (e: MouseEvent, node: WorkflowNode, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const config = getNodeConfig(node.type, node);
    setDragState({
      isDragging: true,
      dragType: 'resize',
      startPos: { x: e.clientX, y: e.clientY },
      currentPos: { x: e.clientX, y: e.clientY },
      dragNode: null,
      connectionStart: null,
      resizeNode: node,
      resizeHandle: handle as any,
      initialNodeSize: { width: config.width, height: config.height }
    });
  };

  const handleResize = (e: MouseEvent) => {
    if (dragState.dragType !== 'resize' || !dragState.resizeNode || !dragState.resizeHandle || !dragState.initialNodeSize) return;

    const deltaX = (e.clientX - dragState.startPos.x) / zoom();
    const deltaY = (e.clientY - dragState.startPos.y) / zoom();

    let newWidth = dragState.initialNodeSize.width;
    let newHeight = dragState.initialNodeSize.height;
    let newX = dragState.resizeNode.x;
    let newY = dragState.resizeNode.y;

    const minSize = 40; // Minimum node size

    // Calculate new dimensions based on resize handle
    switch (dragState.resizeHandle) {
      case 'se': // Southeast
        newWidth = Math.max(minSize, dragState.initialNodeSize.width + deltaX);
        newHeight = Math.max(minSize, dragState.initialNodeSize.height + deltaY);
        break;
      case 'sw': // Southwest
        newWidth = Math.max(minSize, dragState.initialNodeSize.width - deltaX);
        newHeight = Math.max(minSize, dragState.initialNodeSize.height + deltaY);
        newX = dragState.resizeNode.x + (dragState.initialNodeSize.width - newWidth);
        break;
      case 'ne': // Northeast
        newWidth = Math.max(minSize, dragState.initialNodeSize.width + deltaX);
        newHeight = Math.max(minSize, dragState.initialNodeSize.height - deltaY);
        newY = dragState.resizeNode.y + (dragState.initialNodeSize.height - newHeight);
        break;
      case 'nw': // Northwest
        newWidth = Math.max(minSize, dragState.initialNodeSize.width - deltaX);
        newHeight = Math.max(minSize, dragState.initialNodeSize.height - deltaY);
        newX = dragState.resizeNode.x + (dragState.initialNodeSize.width - newWidth);
        newY = dragState.resizeNode.y + (dragState.initialNodeSize.height - newHeight);
        break;
      case 'n': // North
        newHeight = Math.max(minSize, dragState.initialNodeSize.height - deltaY);
        newY = dragState.resizeNode.y + (dragState.initialNodeSize.height - newHeight);
        break;
      case 's': // South
        newHeight = Math.max(minSize, dragState.initialNodeSize.height + deltaY);
        break;
      case 'e': // East
        newWidth = Math.max(minSize, dragState.initialNodeSize.width + deltaX);
        break;
      case 'w': // West
        newWidth = Math.max(minSize, dragState.initialNodeSize.width - deltaX);
        newX = dragState.resizeNode.x + (dragState.initialNodeSize.width - newWidth);
        break;
    }

    // Update the node with new dimensions
    const updatedNodes = props.nodes.map(n =>
      n.id === dragState.resizeNode!.id
        ? { ...n, x: newX, y: newY, width: newWidth, height: newHeight }
        : n
    );
    props.setNodes(updatedNodes);
  };

  // Enhanced mouse event handlers with better target detection
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef();
    if (!canvas) return;

    const target = e.target as HTMLElement;

    // Let UI elements handle their own events - trust the browser
    if (target.closest('.floating-panel, .pointer-events-auto, [role="dialog"]')) {
      return;
    }

    // Close connection toolbar if clicking outside
    if (selectedConnection()) {
      setSelectedConnection(null);
      setConnectionToolbarPosition(null);
    }

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Check if clicking on a port first (highest priority)
    if (target.classList.contains('port')) {
      const nodeId = target.getAttribute('data-node-id');
      const port = target.getAttribute('data-port');
      const portType = target.getAttribute('data-port-type') as 'input' | 'output';

      if (nodeId && port && portType) {
        const startNode = props.nodes.find(n => n.id === nodeId);
        if (startNode) {
          const startPos = getPortPosition(startNode, port, portType);

          setDragState({
            isDragging: true,
            dragType: 'connection',
            startPos: { x: e.clientX, y: e.clientY },
            currentPos: { x: e.clientX, y: e.clientY },
            dragNode: null,
            connectionStart: { nodeId, port, type: portType }
          });

          // Set initial temp connection
          setTempConnection({
            from: startPos,
            to: { x: startPos.x, y: startPos.y },
            fromNode: nodeId,
            fromPort: port,
            portType
          });

          return;
        }
      }
    }

    // Check if clicking on a node (excluding ports)
    const clickedNode = props.nodes.find(node => {
      const config = getNodeConfig(node.type, node);
      return canvasPos.x >= node.x &&
             canvasPos.x <= node.x + config.width &&
             canvasPos.y >= node.y &&
             canvasPos.y <= node.y + config.height;
    });

    if (clickedNode && !target.classList.contains('port') && !props.isPanMode) {
      // Node selection and drag (only if not in pan mode)
      props.setSelectedNode(clickedNode);
      setDragState({
        isDragging: true,
        dragType: 'node',
        startPos: { x: e.clientX, y: e.clientY },
        currentPos: { x: e.clientX, y: e.clientY },
        dragNode: clickedNode,
        connectionStart: null
      });
    } else {
      // Canvas panning (activated by clicking empty space OR when pan mode is active)
      if (!props.isPanMode) {
        props.setSelectedNode(null);
      }
      setDragState({
        isDragging: true,
        dragType: 'canvas',
        startPos: { x: e.clientX, y: e.clientY },
        currentPos: { x: e.clientX, y: e.clientY },
        dragNode: null,
        connectionStart: null
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.isDragging) return;

    const currentPos = { x: e.clientX, y: e.clientY };
    const deltaX = currentPos.x - dragState.startPos.x;
    const deltaY = currentPos.y - dragState.startPos.y;

    setDragState('currentPos', currentPos);

    if (dragState.dragType === 'resize') {
      handleResize(e);
    } else if (dragState.dragType === 'node' && dragState.dragNode) {
      // Update node position with zoom compensation
      const canvasDelta = {
        x: deltaX / zoom(),
        y: deltaY / zoom()
      };

      const updatedNodes = props.nodes.map(node =>
        node.id === dragState.dragNode!.id
          ? {
              ...node,
              x: Math.max(0, node.x + canvasDelta.x), // Prevent negative positions
              y: Math.max(0, node.y + canvasDelta.y)
            }
          : node
      );
      props.setNodes(updatedNodes);

      // Update dragNode reference for continued dragging
      const updatedDragNode = updatedNodes.find(n => n.id === dragState.dragNode!.id);
      if (updatedDragNode) {
        setDragState('dragNode', updatedDragNode);
      }

      setDragState('startPos', currentPos);
    } else if (dragState.dragType === 'canvas') {
      // Smooth canvas panning with momentum
      const offset = canvasOffset();
      const newOffset = {
        x: offset.x + deltaX,
        y: offset.y + deltaY
      };

      setCanvasOffset(newOffset);
      setDragState('startPos', currentPos);
    } else if (dragState.dragType === 'connection' && dragState.connectionStart) {
      // Update temporary connection line with snapping and visual feedback
      const startNode = props.nodes.find(n => n.id === dragState.connectionStart!.nodeId);
      if (startNode) {
        const startPos = getPortPosition(startNode, dragState.connectionStart.port, dragState.connectionStart.type);

        // Check for nearby ports for snapping
        const nearbyPort = findNearbyPort(currentPos.x, currentPos.y);

        if (nearbyPort) {
          // Snap to nearby port
          setHoveredPort({ nodeId: nearbyPort.nodeId, port: nearbyPort.port, type: nearbyPort.type });

          setTempConnection({
            from: startPos,
            to: nearbyPort.position,
            fromNode: dragState.connectionStart.nodeId,
            fromPort: dragState.connectionStart.port,
            portType: dragState.connectionStart.type
          });
        } else {
          // Follow mouse cursor
          setHoveredPort(null);
          const canvasPos = screenToCanvas(currentPos.x, currentPos.y);

          setTempConnection({
            from: startPos,
            to: canvasPos,
            fromNode: dragState.connectionStart.nodeId,
            fromPort: dragState.connectionStart.port,
            portType: dragState.connectionStart.type
          });
        }
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragState.isDragging) return;

    if (dragState.dragType === 'connection' && dragState.connectionStart) {
      // Try to create a connection
      const target = e.target as HTMLElement;
      let targetNodeId: string | null = null;
      let targetPort: string | null = null;
      let targetPortType: 'input' | 'output' | null = null;

      // Check if dropped on a port
      if (target.classList.contains('port')) {
        targetNodeId = target.getAttribute('data-node-id');
        targetPort = target.getAttribute('data-port');
        targetPortType = target.getAttribute('data-port-type') as 'input' | 'output';
      } else {
        // Check if we're near a port (for snapping)
        const nearbyPort = findNearbyPort(e.clientX, e.clientY);
        if (nearbyPort) {
          targetNodeId = nearbyPort.nodeId;
          targetPort = nearbyPort.port;
          targetPortType = nearbyPort.type;
        }
      }

      if (targetNodeId && targetPort && targetPortType && targetPortType !== dragState.connectionStart.type) {
        const fromNode = props.nodes.find(n => n.id === dragState.connectionStart.nodeId);
        const toNode = props.nodes.find(n => n.id === targetNodeId);

        if (fromNode && toNode && isValidConnection(fromNode, dragState.connectionStart.port, dragState.connectionStart.type, toNode, targetPort, targetPortType)) {
          // Create new connection
          const newConnection: WorkflowConnection = {
            id: `${dragState.connectionStart.nodeId}-${targetNodeId}-${Date.now()}`,
            from: dragState.connectionStart.type === 'output' ? dragState.connectionStart.nodeId : targetNodeId,
            to: dragState.connectionStart.type === 'output' ? targetNodeId : dragState.connectionStart.nodeId,
            fromPort: dragState.connectionStart.type === 'output' ? dragState.connectionStart.port : targetPort,
            toPort: dragState.connectionStart.type === 'output' ? targetPort : dragState.connectionStart.port
          };

          props.setConnections([...props.connections, newConnection]);
        }
      }
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      dragType: null,
      startPos: { x: 0, y: 0 },
      currentPos: { x: 0, y: 0 },
      dragNode: null,
      connectionStart: null,
      resizeNode: null,
      resizeHandle: null,
      initialNodeSize: null
    });
    setTempConnection(null);
    setHoveredPort(null);
  };

  // Zoom handling
  const handleWheel = (e: WheelEvent) => {
    const target = e.target as HTMLElement;

    // Don't zoom if user is interacting with form inputs or scrollable UI elements
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // Don't zoom if scrolling in a panel or other scrollable container
    const isInScrollableUI = target.closest(`
      .floating-panel,
      .overflow-y-auto,
      .overflow-auto,
      [role="dialog"],
      [role="menu"],
      .modal,
      .dropdown
    `.replace(/\s+/g, ' ').trim()) !== null;

    if (isInScrollableUI) {
      return;
    }

    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom() * zoomFactor));
    setZoom(newZoom);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete selected connections with Delete key
    if (e.key === 'Delete' && hoveredConnection()) {
      const updatedConnections = props.connections.filter(conn => conn.id !== hoveredConnection());
      props.setConnections(updatedConnections);
      setHoveredConnection(null);
    }
    // Escape to cancel connection dragging
    if (e.key === 'Escape' && dragState.isDragging && dragState.dragType === 'connection') {
      setDragState({
        isDragging: false,
        dragType: null,
        startPos: { x: 0, y: 0 },
        currentPos: { x: 0, y: 0 },
        dragNode: null,
        connectionStart: null,
        resizeNode: null,
        resizeHandle: null,
        initialNodeSize: null
      });
      setTempConnection(null);
      setHoveredPort(null);
    }
  };

  // Note: Drop handling is now managed by WorkflowCanvasManager
  // This component focuses on visual rendering and node interactions

  const handleDragOver = (e: DragEvent) => {
    // Allow drops for visual feedback
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent) => {
    // Prevent default but let parent handle the actual drop
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper functions for node configuration
  const getNodeInputs = (nodeType: string): string[] => {
    const triggerTypes = ['trigger', 'webhook', 'schedule'];
    return triggerTypes.includes(nodeType) ? [] : ['input'];
  };

  const getNodeOutputs = (nodeType: string): string[] => {
    const outputTypes = ['output', 'send-email', 'notification'];
    return outputTypes.includes(nodeType) ? [] : ['output'];
  };

  const formatNodeTitle = (nodeType: string): string => {
    // Business-friendly names for common process types
    const businessNames = {
      'lead-capture': 'Lead Capture',
      'lead-qualification': 'Lead Qualification',
      'customer-onboarding': 'Customer Onboarding',
      'customer-success': 'Customer Success',
      'sales-opportunity': 'Sales Opportunity',
      'proposal-generation': 'Proposal Generation',
      'contract-review': 'Contract Review',
      'deal-closing': 'Deal Closing',
      'support-ticket': 'Support Ticket',
      'issue-escalation': 'Issue Escalation',
      'quality-assurance': 'Quality Assurance',
      'knowledge-update': 'Knowledge Update',
      'campaign-launch': 'Campaign Launch',
      'content-creation': 'Content Creation',
      'social-engagement': 'Social Engagement',
      'analytics-review': 'Analytics Review',
      'invoice-processing': 'Invoice Processing',
      'expense-approval': 'Expense Approval',
      'compliance-check': 'Compliance Check',
      'report-generation': 'Report Generation'
    };

    return businessNames[nodeType] || nodeType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Set up event listeners
  onMount(() => {
    const canvas = canvasRef();
    if (canvas) {
      console.log('Canvas element found, setting up mouse/wheel/drag listeners');
      console.log('Welcome overlay shown:', props.showWelcome);
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('dragover', handleDragOver);
      canvas.addEventListener('drop', handleDrop);
      console.log('Drag event listeners added to canvas element');
    } else {
      console.error('Canvas element not found!');
    }

    // Global drag event debugging
    const globalDragOver = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('data-canvas') || target.closest('[data-canvas]')) {
        console.log('🎯 CANVAS DRAGOVER DETECTED!', target);
      } else {
        console.log('Global dragover detected on:', target);
      }
    };
    const globalDrop = (e: DragEvent) => {
      console.log('Global drop detected on:', e.target);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragover', globalDragOver);
    document.addEventListener('drop', globalDrop);
  });

  onCleanup(() => {
    const canvas = canvasRef();
    if (canvas) {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('wheel', handleWheel);
    document.removeEventListener('keydown', handleKeyDown);
    // Note: We'll let the global drag listeners stay for now since they're for debugging
  });

  // Note: Background classes are now handled by WorkflowCanvasManager

  return (
    <div
      ref={setCanvasRef}
      data-canvas="true"
      class="w-full h-full relative"
      style={{
        cursor: dragState.isDragging
          ? (dragState.dragType === 'canvas' ? 'grabbing' : 'default')
          : props.isPanMode
            ? 'grab'
            : (dragState.dragType === 'connection' ? 'crosshair' : 'default'),
        'z-index': 'var(--z-workflow-nodes)'  // Above background but below overlays
      }}
    >

      {/* SVG for connections */}
      <svg
        ref={setSvgRef}
        class="absolute inset-0 w-full h-full"
        style={{
          'z-index': 'var(--z-connections)', // Above nodes so connections can be clicked
          transform: `translate(${canvasOffset().x}px, ${canvasOffset().y}px) scale(${zoom()})`,
          'transform-origin': '0 0',
          'pointer-events': 'none' // Disable for the SVG container
        }}
      >
        {/* Arrowhead marker definitions */}
        <defs style={{ 'pointer-events': 'none' }}>
          <marker
            id="arrow-end"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
          </marker>
          <marker
            id="arrow-start"
            markerWidth="10"
            markerHeight="10"
            refX="1"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="10 0, 0 3, 10 6" fill="currentColor" />
          </marker>
          <marker
            id="circle-end"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1" />
          </marker>
          <marker
            id="circle-start"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1" />
          </marker>
          <marker
            id="diamond-end"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 5, 5 0, 10 5, 5 10" fill="none" stroke="currentColor" stroke-width="1" />
          </marker>
          <marker
            id="diamond-start"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 5, 5 0, 10 5, 5 10" fill="none" stroke="currentColor" stroke-width="1" />
          </marker>
        </defs>

        {/* Render existing connections */}
        <For each={connectionData()}>
          {(connData) => {
            if (!connData) return null;

            const { connection, fromPos, toPos, fromControl, toControl, path } = connData;
            const isHovered = hoveredConnection() === connection.id;
            const isSelected = selectedConnection() === connection.id;
            const style = getConnectionStyle(connection);

            // Reduce opacity and stroke width for selected connections to make toolbar more visible
            const selectedOpacity = isSelected ? 0.3 : 1;
            const selectedStrokeWidth = isSelected ? Math.max(1, style.strokeWidth - 1) : style.strokeWidth;

            return (
              <g>
                {/* Connection shadow for depth */}
                <path
                  d={path}
                  stroke="rgba(0,0,0,0.1)"
                  stroke-width={isHovered && !isSelected ? selectedStrokeWidth + 4 : selectedStrokeWidth + 2}
                  fill="none"
                  stroke-dasharray={style.strokeDasharray}
                  opacity={selectedOpacity * 0.5}
                  style={{
                    transform: 'translate(2px, 2px)',
                    'pointer-events': 'none' // Shadow shouldn't be clickable
                  }}
                />
                {/* Main connection line */}
                <path
                  d={path}
                  stroke={isSelected ? "#8b5cf6" : isHovered ? "#7c3aed" : style.color}
                  stroke-width={isHovered && !isSelected ? selectedStrokeWidth + 1 : selectedStrokeWidth}
                  fill="none"
                  stroke-dasharray={style.strokeDasharray}
                  marker-start={getMarkerUrl(style.startArrow, 'start')}
                  marker-end={getMarkerUrl(style.endArrow, 'end')}
                  opacity={selectedOpacity}
                  class="transition-all duration-200 cursor-pointer"
                  style={{
                    'stroke-linecap': 'round',
                    color: isSelected ? "#8b5cf6" : isHovered ? "#7c3aed" : style.color,
                    'pointer-events': 'auto' // Enable clicking on connection lines
                  }}
                  onMouseEnter={() => setHoveredConnection(connection.id)}
                  onMouseLeave={() => setHoveredConnection(null)}
                  onClick={(e) => {
                    e.stopPropagation();

                    // Show connection toolbar on click
                    setSelectedConnection(connection.id);

                    // Calculate midpoint for toolbar position
                    const midX = (fromPos.x + toPos.x) / 2;
                    const midY = (fromPos.y + toPos.y) / 2;
                    const screenPos = canvasToScreen(midX, midY);

                    // Ensure toolbar stays within viewport
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const toolbarWidth = 400; // Approximate toolbar width
                    const toolbarHeight = 60; // Approximate toolbar height

                    const constrainedPos = {
                      x: Math.max(toolbarWidth / 2, Math.min(viewportWidth - toolbarWidth / 2, screenPos.x)),
                      y: Math.max(toolbarHeight + 10, Math.min(viewportHeight - toolbarHeight - 10, screenPos.y))
                    };

                    setConnectionToolbarPosition(constrainedPos);
                  }}
                />

                {/* Connection label */}
                {style.label && (
                  <text
                    x={(fromPos.x + toPos.x) / 2}
                    y={(fromPos.y + toPos.y) / 2 - 8}
                    fill={style.color}
                    font-size="12"
                    font-family="system-ui"
                    text-anchor="middle"
                    class="select-none"
                    style={{
                      stroke: 'white',
                      'stroke-width': '2px',
                      'paint-order': 'stroke',
                      'font-weight': '500',
                      'pointer-events': 'none' // Labels shouldn't be clickable
                    }}
                  >
                    {style.label}
                  </text>
                )}
                {/* Invisible wider area for easier hovering */}
                <path
                  d={path}
                  stroke="transparent"
                  stroke-width="12"
                  fill="none"
                  opacity={selectedOpacity}
                  style={{
                    cursor: 'pointer',
                    'pointer-events': 'auto' // Enable clicking on wider hover area
                  }}
                  onMouseEnter={() => setHoveredConnection(connection.id)}
                  onMouseLeave={() => setHoveredConnection(null)}
                  onClick={(e) => {
                    e.stopPropagation();

                    // Show connection toolbar on click
                    setSelectedConnection(connection.id);

                    // Calculate midpoint for toolbar position
                    const midX = (fromPos.x + toPos.x) / 2;
                    const midY = (fromPos.y + toPos.y) / 2;
                    const screenPos = canvasToScreen(midX, midY);

                    // Ensure toolbar stays within viewport
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const toolbarWidth = 400; // Approximate toolbar width
                    const toolbarHeight = 60; // Approximate toolbar height

                    const constrainedPos = {
                      x: Math.max(toolbarWidth / 2, Math.min(viewportWidth - toolbarWidth / 2, screenPos.x)),
                      y: Math.max(toolbarHeight + 10, Math.min(viewportHeight - toolbarHeight - 10, screenPos.y))
                    };

                    setConnectionToolbarPosition(constrainedPos);
                  }}
                />
              </g>
            );
          }}
        </For>

        {/* Arrow marker definitions */}
        <defs>
          <marker
            id="arrowhead-temp"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#6366f1" />
          </marker>
          <marker
            id="arrowhead-valid"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
          </marker>
          <marker
            id="arrowhead-invalid"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
          </marker>
        </defs>

        {/* Temporary connection while dragging */}
        <Show when={tempConnection()}>
          {(conn) => {
            const from = conn().from;
            const to = conn().to;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const curvature = Math.min(distance * 0.5, 100);

            const fromControl = {
              x: from.x + curvature,
              y: from.y
            };
            const toControl = {
              x: to.x - curvature,
              y: to.y
            };

            const nearbyPort = hoveredPort();
            const isValidTarget = nearbyPort && dragState.connectionStart ?
              isValidConnection(
                props.nodes.find(n => n.id === dragState.connectionStart!.nodeId)!,
                dragState.connectionStart.port,
                dragState.connectionStart.type,
                props.nodes.find(n => n.id === nearbyPort.nodeId)!,
                nearbyPort.port,
                nearbyPort.type
              ) : false;

            const pathId = `M ${from.x} ${from.y}
                     C ${fromControl.x} ${fromControl.y}
                       ${toControl.x} ${toControl.y}
                       ${to.x} ${to.y}`;

            const markerUrl = isValidTarget ? 'url(#arrowhead-valid)' :
                            nearbyPort && !isValidTarget ? 'url(#arrowhead-invalid)' :
                            'url(#arrowhead-temp)';

            return (
              <g>
                {/* Glowing effect for valid connections */}
                {isValidTarget && (
                  <path
                    d={pathId}
                    stroke="#10b981"
                    stroke-width="8"
                    fill="none"
                    class="opacity-25 animate-pulse"
                    style={{
                      'stroke-linecap': 'round',
                      'pointer-events': 'none'
                    }}
                  />
                )}
                {/* Main temp connection with arrow */}
                <path
                  d={pathId}
                  stroke={isValidTarget ? "#10b981" : nearbyPort && !isValidTarget ? "#ef4444" : "#6366f1"}
                  stroke-width="3"
                  stroke-dasharray="8,4"
                  fill="none"
                  marker-end={markerUrl}
                  class="opacity-90"
                  style={{
                    'stroke-linecap': 'round',
                    'pointer-events': 'none',
                    'transition': 'stroke 0.2s ease-in-out'
                  }}
                />
                {/* Animated flow indicator along the path */}
                {distance > 50 && (
                  <>
                    <circle
                      cx={from.x + (to.x - from.x) * 0.3}
                      cy={from.y + (to.y - from.y) * 0.3}
                      r="4"
                      fill={isValidTarget ? "#10b981" : nearbyPort && !isValidTarget ? "#ef4444" : "#6366f1"}
                      class="opacity-60"
                      style={{ 'pointer-events': 'none', 'animation': 'pulse 1.5s ease-in-out infinite' }}
                    />
                    <circle
                      cx={from.x + (to.x - from.x) * 0.6}
                      cy={from.y + (to.y - from.y) * 0.6}
                      r="4"
                      fill={isValidTarget ? "#10b981" : nearbyPort && !isValidTarget ? "#ef4444" : "#6366f1"}
                      class="opacity-60"
                      style={{ 'pointer-events': 'none', 'animation': 'pulse 1.5s ease-in-out infinite 0.3s' }}
                    />
                    <circle
                      cx={from.x + (to.x - from.x) * 0.85}
                      cy={from.y + (to.y - from.y) * 0.85}
                      r="4"
                      fill={isValidTarget ? "#10b981" : nearbyPort && !isValidTarget ? "#ef4444" : "#6366f1"}
                      class="opacity-60"
                      style={{ 'pointer-events': 'none', 'animation': 'pulse 1.5s ease-in-out infinite 0.6s' }}
                    />
                  </>
                )}
              </g>
            );
          }}
        </Show>
      </svg>

      {/* Storyboards (rendered behind nodes) */}
      <div
        class="absolute"
        style={{
          transform: `translate(${canvasOffset().x}px, ${canvasOffset().y}px) scale(${zoom()})`,
          'transform-origin': '0 0',
          'z-index': 'var(--z-storyboards, 1)'
        }}
      >
        <For each={props.storyboards || []}>
          {(storyboard) => {
            const isSelected = props.selectedStoryboard?.id === storyboard.id;
            return (
              <div
                class={`absolute rounded-lg cursor-move select-none transition-all border-2 ${
                  isSelected
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                style={{
                  left: `${storyboard.x}px`,
                  top: `${storyboard.y}px`,
                  width: `${storyboard.width}px`,
                  height: `${storyboard.height}px`,
                  'background-color': storyboard.backgroundColor || 'rgba(59, 130, 246, 0.05)',
                  'border-style': storyboard.borderStyle || 'solid',
                  'border-width': `${storyboard.borderWidth || 2}px`,
                  opacity: storyboard.opacity || 0.8,
                  'pointer-events': 'auto'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  props.setSelectedStoryboard?.(storyboard);
                }}
              >
                {/* Storyboard title */}
                <div
                  class="absolute -top-6 left-0 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm border"
                  style={{ 'pointer-events': 'none' }}
                >
                  {storyboard.name}
                </div>

                {/* Resize handles when selected */}
                <Show when={isSelected}>
                  <div class="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded cursor-se-resize" />
                  <div class="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded cursor-ne-resize" />
                  <div class="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded cursor-nw-resize" />
                  <div class="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded cursor-sw-resize" />
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Nodes */}
      <div
        class="absolute"
        style={{
          transform: `translate(${canvasOffset().x}px, ${canvasOffset().y}px) scale(${zoom()})`,
          'transform-origin': '0 0',
          'z-index': 'var(--z-workflow-nodes)'
        }}
      >
        <For each={props.nodes}>
          {(node) => {
            const config = getNodeConfig(node.type, node);
            const isSelected = props.selectedNode?.id === node.id;

            return (
              <div
                class={`absolute shadow-lg cursor-move select-none transition-all ${
                  config.shape ? 'border-0' : 'border-2 rounded-lg'
                } ${
                  !config.shape ? config.color : ''
                } ${
                  isSelected
                    ? 'shadow-blue-200 dark:shadow-blue-800'
                    : ''
                } ${
                  !config.shape && !isSelected ? 'border-gray-300 dark:border-gray-600' : ''
                } ${
                  isSelected && config.shape ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                } text-white`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${config.width}px`,
                  height: `${config.height}px`,
                }}
              >
                {/* Shape rendering or regular node content */}
                {config.shape ? (
                  <div class="relative w-full h-full">
                    <ShapeRenderer
                      shape={config.shape as ShapeType}
                      width={config.width}
                      height={config.height}
                      color={config.color}
                    />
                    {/* Label for shapes */}
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        class={`text-xs font-medium drop-shadow-lg text-center ${
                          config.shape === 'sticky-note' ? 'text-gray-800' : 'text-white'
                        }`}
                        style={{
                          'font-family': config.fontFamily || 'inherit'
                        }}
                      >
                        {node.title && node.title !== node.type ? node.title : ''}
                      </div>
                    </div>
                  </div>
                ) : ['chart-bar', 'chart-line', 'chart-pie', 'chart-area', 'chart-scatter'].includes(node.type) && node.config?.manualData ? (
                  /* Chart visualization nodes with data */
                  <div class="w-full h-full overflow-hidden">
                    <ChartRenderer
                      config={node.config as ChartConfig}
                      data={(() => {
                        try {
                          return JSON.parse(node.config.manualData);
                        } catch {
                          return null;
                        }
                      })()}
                    />
                  </div>
                ) : (
                  <div class="p-2 h-full flex flex-col justify-center">
                    <div class="text-sm font-medium text-center truncate">
                      {node.title || node.type}
                    </div>
                    <Show when={node.description}>
                      <div class="text-xs opacity-75 text-center truncate mt-1">
                        {node.description}
                      </div>
                    </Show>
                  </div>
                )}

                {/* Resize handles - only show when selected */}
                <Show when={isSelected}>
                  {/* Corner handles */}
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-nw-resize"
                    style={{ top: '-4px', left: '-4px' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'nw')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-ne-resize"
                    style={{ top: '-4px', right: '-4px' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'ne')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-sw-resize"
                    style={{ bottom: '-4px', left: '-4px' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'sw')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-se-resize"
                    style={{ bottom: '-4px', right: '-4px' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'se')}
                  />
                  {/* Edge handles */}
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-n-resize"
                    style={{ top: '-4px', left: '50%', transform: 'translateX(-50%)' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'n')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-s-resize"
                    style={{ bottom: '-4px', left: '50%', transform: 'translateX(-50%)' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 's')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-w-resize"
                    style={{ left: '-4px', top: '50%', transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'w')}
                  />
                  <div
                    class="absolute w-2 h-2 bg-blue-500 border border-white cursor-e-resize"
                    style={{ right: '-4px', top: '50%', transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => handleResizeStart(e, node, 'e')}
                  />
                </Show>

                {/* Input ports */}
                <For each={node.inputs}>
                  {(input, index) => {
                    const portSpacing = config.width / (node.inputs.length + 1);
                    const isHovered = hoveredPort()?.nodeId === node.id && hoveredPort()?.port === input && hoveredPort()?.type === 'input';
                    const isConnecting = dragState.dragType === 'connection' && dragState.connectionStart?.type === 'output';
                    const isCompatible = isConnecting && dragState.connectionStart ?
                      isValidConnection(
                        props.nodes.find(n => n.id === dragState.connectionStart!.nodeId)!,
                        dragState.connectionStart.port,
                        dragState.connectionStart.type,
                        node,
                        input,
                        'input'
                      ) : false;

                    return (
                      <div
                        class="absolute port-container cursor-crosshair"
                        style={{
                          left: `${portSpacing * (index() + 1) - 16}px`,
                          top: '-16px',
                          width: '32px',
                          height: '32px',
                          'z-index': isConnecting ? '100' : '10'
                        }}
                        data-node-id={node.id}
                        data-port={input}
                        data-port-type="input"
                        title={`Input: ${input}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Trigger connection start by simulating port click
                          const startNode = node;
                          if (startNode) {
                            const startPos = getPortPosition(startNode, input, 'input');
                            setDragState({
                              isDragging: true,
                              dragType: 'connection',
                              startPos: { x: e.clientX, y: e.clientY },
                              currentPos: { x: e.clientX, y: e.clientY },
                              dragNode: null,
                              connectionStart: { nodeId: node.id, port: input, type: 'input' }
                            });
                            setTempConnection({
                              from: startPos,
                              to: { x: startPos.x, y: startPos.y },
                              fromNode: node.id,
                              fromPort: input,
                              portType: 'input'
                            });
                          }
                        }}
                        onMouseEnter={() => {
                          if (isConnecting) {
                            setHoveredPort({ nodeId: node.id, port: input, type: 'input' });
                          }
                        }}
                        onMouseLeave={() => {
                          if (!dragState.isDragging) {
                            setHoveredPort(null);
                          }
                        }}
                      >
                        {/* Visual port indicator */}
                        <div
                          class={`port absolute rounded-full cursor-crosshair transition-all duration-200 pointer-events-none ${
                            isHovered ? 'w-5 h-5 bg-green-400 border-2 border-white shadow-lg ring-4 ring-green-200' :
                            isCompatible ? 'w-5 h-5 bg-blue-400 border-2 border-white shadow-md ring-2 ring-blue-200' :
                            isConnecting ? 'w-4 h-4 bg-gray-400 border-2 border-white opacity-50' :
                            'w-3 h-3 bg-blue-500 border-2 border-white hover:bg-blue-600 hover:w-4 hover:h-4'
                          }`}
                          style={{
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      </div>
                    );
                  }}
                </For>

                {/* Output ports */}
                <For each={node.outputs}>
                  {(output, index) => {
                    const portSpacing = config.width / (node.outputs.length + 1);
                    const isHovered = hoveredPort()?.nodeId === node.id && hoveredPort()?.port === output && hoveredPort()?.type === 'output';
                    const isConnecting = dragState.dragType === 'connection' && dragState.connectionStart?.type === 'input';
                    const isCompatible = isConnecting && dragState.connectionStart ?
                      isValidConnection(
                        props.nodes.find(n => n.id === dragState.connectionStart!.nodeId)!,
                        dragState.connectionStart.port,
                        dragState.connectionStart.type,
                        node,
                        output,
                        'output'
                      ) : false;

                    return (
                      <div
                        class="absolute port-container cursor-crosshair"
                        style={{
                          left: `${portSpacing * (index() + 1) - 16}px`,
                          bottom: '-16px',
                          width: '32px',
                          height: '32px',
                          'z-index': isConnecting ? '100' : '10'
                        }}
                        data-node-id={node.id}
                        data-port={output}
                        data-port-type="output"
                        title={`Output: ${output}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          // Trigger connection start
                          const startNode = node;
                          if (startNode) {
                            const startPos = getPortPosition(startNode, output, 'output');
                            setDragState({
                              isDragging: true,
                              dragType: 'connection',
                              startPos: { x: e.clientX, y: e.clientY },
                              currentPos: { x: e.clientX, y: e.clientY },
                              dragNode: null,
                              connectionStart: { nodeId: node.id, port: output, type: 'output' }
                            });
                            setTempConnection({
                              from: startPos,
                              to: { x: startPos.x, y: startPos.y },
                              fromNode: node.id,
                              fromPort: output,
                              portType: 'output'
                            });
                          }
                        }}
                        onMouseEnter={() => {
                          if (isConnecting) {
                            setHoveredPort({ nodeId: node.id, port: output, type: 'output' });
                          }
                        }}
                        onMouseLeave={() => {
                          if (!dragState.isDragging) {
                            setHoveredPort(null);
                          }
                        }}
                      >
                        {/* Visual port indicator */}
                        <div
                          class={`port absolute rounded-full cursor-crosshair transition-all duration-200 pointer-events-none ${
                            isHovered ? 'w-5 h-5 bg-green-400 border-2 border-white shadow-lg ring-4 ring-green-200' :
                            isCompatible ? 'w-5 h-5 bg-green-400 border-2 border-white shadow-md ring-2 ring-green-200' :
                            isConnecting ? 'w-4 h-4 bg-gray-400 border-2 border-white opacity-50' :
                            'w-3 h-3 bg-green-500 border-2 border-white hover:bg-green-600 hover:w-4 hover:h-4'
                          }`}
                          style={{
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      </div>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </div>

      {/* Enhanced zoom and navigation controls */}
      <div
        class="absolute bottom-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-3 flex flex-col gap-2 pointer-events-auto"
        style={{
          'z-index': 'var(--z-node-details)',
          right: props.isNodePanelPinned ? '340px' : '16px' // 320px panel width + 20px spacing
        }}
      >
        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
          onClick={() => setZoom(zoom() * 1.2)}
          title="Zoom In"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <div class="text-xs text-center text-gray-600 dark:text-gray-400 px-1 py-1 bg-gray-50 dark:bg-gray-700 rounded">
          {Math.round(zoom() * 100)}%
        </div>
        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
          onClick={() => setZoom(zoom() * 0.8)}
          title="Zoom Out"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
          onClick={() => {
            setZoom(1);
            setCanvasOffset({ x: 0, y: 0 });
          }}
          title="Reset View"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
        <button
          class="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 hover:scale-105"
          onClick={() => {
            // Fit all nodes in view
            if (props.nodes.length > 0) {
              const bounds = props.nodes.reduce(
                (acc, node) => {
                  const config = getNodeConfig(node.type, node);
                  return {
                    minX: Math.min(acc.minX, node.x),
                    maxX: Math.max(acc.maxX, node.x + config.width),
                    minY: Math.min(acc.minY, node.y),
                    maxY: Math.max(acc.maxY, node.y + config.height)
                  };
                },
                { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
              );

              const canvas = canvasRef();
              if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const width = bounds.maxX - bounds.minX;
                const height = bounds.maxY - bounds.minY;
                const newZoom = Math.min(
                  (rect.width * 0.8) / width,
                  (rect.height * 0.8) / height,
                  1
                );
                setZoom(newZoom);
                setCanvasOffset({
                  x: (rect.width - width * newZoom) / 2 - bounds.minX * newZoom,
                  y: (rect.height - height * newZoom) / 2 - bounds.minY * newZoom
                });
              }
            }
          }}
          title="Fit to Screen"
        >
          <Hand class="w-4 h-4" />
        </button>
      </div>

      {/* Connection Toolbar */}
      <Show when={selectedConnection() && connectionToolbarPosition()}>
        {(position) => {
          const connection = props.connections.find(c => c.id === selectedConnection());
          if (!connection) return null;

          const style = getConnectionStyle(connection);

          return (
            <div style={{ 'z-index': 'var(--z-connection-toolbar)', position: 'relative', 'pointer-events': 'auto' }}>
              <ConnectionToolbar
                position={position()}
                connectionId={connection.id}
                currentStyle={style}
                onStyleChange={(newStyle) => {
                  const updatedConnections = props.connections.map(conn =>
                    conn.id === connection.id
                      ? { ...conn, style: { ...style, ...newStyle } }
                      : conn
                  );
                  props.setConnections(updatedConnections);
                }}
                onDelete={() => {
                  const updatedConnections = props.connections.filter(conn => conn.id !== connection.id);
                  props.setConnections(updatedConnections);
                  setSelectedConnection(null);
                  setConnectionToolbarPosition(null);
                }}
                onClose={() => {
                  setSelectedConnection(null);
                  setConnectionToolbarPosition(null);
                }}
              />
            </div>
          );
        }}
      </Show>
    </div>
  );
}