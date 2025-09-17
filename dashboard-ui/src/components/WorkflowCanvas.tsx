import { createSignal, createEffect, For, onMount, onCleanup, Show } from 'solid-js';
import { createStore } from 'solid-js/store';

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
}

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  setNodes: (nodes: WorkflowNode[]) => void;
  connections: WorkflowConnection[];
  setConnections: (connections: WorkflowConnection[]) => void;
  selectedNode: WorkflowNode | null;
  setSelectedNode: (node: WorkflowNode | null) => void;
}

interface DragState {
  isDragging: boolean;
  dragType: 'node' | 'connection' | 'canvas' | null;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  dragNode: WorkflowNode | null;
  connectionStart: { nodeId: string; port: string; type: 'input' | 'output' } | null;
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
    connectionStart: null
  });

  const [canvasOffset, setCanvasOffset] = createSignal({ x: 0, y: 0 });
  const [zoom, setZoom] = createSignal(1);
  const [tempConnection, setTempConnection] = createSignal<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  // Node configuration for rendering
  const getNodeConfig = (nodeType: string) => {
    const configs = {
      'trigger': { color: 'bg-green-500', width: 120, height: 60 },
      'webhook': { color: 'bg-green-600', width: 120, height: 60 },
      'schedule': { color: 'bg-green-700', width: 120, height: 60 },
      'output': { color: 'bg-blue-500', width: 120, height: 60 },
      'email': { color: 'bg-blue-600', width: 120, height: 60 },
      'notification': { color: 'bg-blue-700', width: 120, height: 60 },
      'kv-get': { color: 'bg-purple-500', width: 120, height: 60 },
      'kv-set': { color: 'bg-purple-600', width: 120, height: 60 },
      'artifacts-get': { color: 'bg-purple-700', width: 120, height: 60 },
      'artifacts-put': { color: 'bg-purple-800', width: 120, height: 60 },
      'agent-conductor': { color: 'bg-indigo-500', width: 140, height: 80 },
      'agent-critic': { color: 'bg-indigo-600', width: 140, height: 80 },
      'agent-terraform': { color: 'bg-indigo-700', width: 140, height: 80 },
      'agent-django': { color: 'bg-indigo-800', width: 140, height: 80 },
      'default': { color: 'bg-gray-500', width: 120, height: 60 }
    };
    return configs[nodeType] || configs.default;
  };

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

  // Get connection port position
  const getPortPosition = (node: WorkflowNode, port: string, type: 'input' | 'output') => {
    const config = getNodeConfig(node.type);
    const portIndex = type === 'input' ? node.inputs.indexOf(port) : node.outputs.indexOf(port);
    const totalPorts = type === 'input' ? node.inputs.length : node.outputs.length;

    const portSpacing = config.width / (totalPorts + 1);
    const x = node.x + portSpacing * (portIndex + 1);
    const y = type === 'input' ? node.y : node.y + config.height;

    return { x, y };
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef();
    if (!canvas) return;

    const target = e.target as HTMLElement;
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Check if clicking on a node
    const clickedNode = props.nodes.find(node => {
      const config = getNodeConfig(node.type);
      return canvasPos.x >= node.x &&
             canvasPos.x <= node.x + config.width &&
             canvasPos.y >= node.y &&
             canvasPos.y <= node.y + config.height;
    });

    // Check if clicking on a port
    if (target.classList.contains('port')) {
      const nodeId = target.getAttribute('data-node-id');
      const port = target.getAttribute('data-port');
      const portType = target.getAttribute('data-port-type') as 'input' | 'output';

      if (nodeId && port && portType) {
        setDragState({
          isDragging: true,
          dragType: 'connection',
          startPos: { x: e.clientX, y: e.clientY },
          currentPos: { x: e.clientX, y: e.clientY },
          dragNode: null,
          connectionStart: { nodeId, port, type: portType }
        });
        return;
      }
    }

    if (clickedNode) {
      // Node selection and drag
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
      // Canvas panning
      props.setSelectedNode(null);
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

    if (dragState.dragType === 'node' && dragState.dragNode) {
      // Update node position
      const canvasDelta = {
        x: deltaX / zoom(),
        y: deltaY / zoom()
      };

      const updatedNodes = props.nodes.map(node =>
        node.id === dragState.dragNode!.id
          ? { ...node, x: node.x + canvasDelta.x, y: node.y + canvasDelta.y }
          : node
      );
      props.setNodes(updatedNodes);

      setDragState('startPos', currentPos);
    } else if (dragState.dragType === 'canvas') {
      // Pan canvas
      const offset = canvasOffset();
      setCanvasOffset({
        x: offset.x + deltaX,
        y: offset.y + deltaY
      });
      setDragState('startPos', currentPos);
    } else if (dragState.dragType === 'connection' && dragState.connectionStart) {
      // Update temporary connection line
      const startNode = props.nodes.find(n => n.id === dragState.connectionStart!.nodeId);
      if (startNode) {
        const startPos = getPortPosition(startNode, dragState.connectionStart.port, dragState.connectionStart.type);
        const startScreen = canvasToScreen(startPos.x, startPos.y);
        setTempConnection({
          from: startScreen,
          to: currentPos
        });
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragState.isDragging) return;

    if (dragState.dragType === 'connection' && dragState.connectionStart) {
      // Try to create a connection
      const target = e.target as HTMLElement;
      if (target.classList.contains('port')) {
        const nodeId = target.getAttribute('data-node-id');
        const port = target.getAttribute('data-port');
        const portType = target.getAttribute('data-port-type') as 'input' | 'output';

        if (nodeId && port && portType && portType !== dragState.connectionStart.type) {
          // Create new connection
          const newConnection: WorkflowConnection = {
            id: `${dragState.connectionStart.nodeId}-${nodeId}-${Date.now()}`,
            from: dragState.connectionStart.type === 'output' ? dragState.connectionStart.nodeId : nodeId,
            to: dragState.connectionStart.type === 'output' ? nodeId : dragState.connectionStart.nodeId,
            fromPort: dragState.connectionStart.type === 'output' ? dragState.connectionStart.port : port,
            toPort: dragState.connectionStart.type === 'output' ? port : dragState.connectionStart.port
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
      connectionStart: null
    });
    setTempConnection(null);
  };

  // Zoom handling
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoom() * zoomFactor));
    setZoom(newZoom);
  };

  // Drop handling for new nodes
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer?.getData('text/plain');
    if (!nodeType) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      x: canvasPos.x,
      y: canvasPos.y,
      inputs: nodeType === 'trigger' ? [] : ['input'],
      outputs: nodeType === 'output' ? [] : ['output'],
      config: {}
    };

    props.setNodes([...props.nodes, newNode]);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  // Set up event listeners
  onMount(() => {
    const canvas = canvasRef();
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('drop', handleDrop);
      canvas.addEventListener('dragover', handleDragOver);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });
  });

  onCleanup(() => {
    const canvas = canvasRef();
    if (canvas) {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('drop', handleDrop);
      canvas.removeEventListener('dragover', handleDragOver);
    }

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('wheel', handleWheel);
  });

  return (
    <div
      ref={setCanvasRef}
      class="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-900"
      style={{ cursor: dragState.isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Grid background */}
      <div
        class="absolute inset-0 opacity-20"
        style={{
          'background-image': `
            linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
          `,
          'background-size': `${20 * zoom()}px ${20 * zoom()}px`,
          'background-position': `${canvasOffset().x}px ${canvasOffset().y}px`
        }}
      />

      {/* SVG for connections */}
      <svg
        ref={setSvgRef}
        class="absolute inset-0 w-full h-full pointer-events-none"
        style={{ 'z-index': 1 }}
      >
        {/* Render existing connections */}
        <For each={props.connections}>
          {(connection) => {
            const fromNode = props.nodes.find(n => n.id === connection.from);
            const toNode = props.nodes.find(n => n.id === connection.to);

            if (!fromNode || !toNode) return null;

            const fromPos = getPortPosition(fromNode, connection.fromPort, 'output');
            const toPos = getPortPosition(toNode, connection.toPort, 'input');

            const fromScreen = canvasToScreen(fromPos.x, fromPos.y);
            const toScreen = canvasToScreen(toPos.x, toPos.y);

            // Bezier curve for smooth connections
            const midX = (fromScreen.x + toScreen.x) / 2;
            const controlOffset = Math.abs(toScreen.y - fromScreen.y) * 0.5;

            return (
              <path
                d={`M ${fromScreen.x} ${fromScreen.y}
                   C ${midX} ${fromScreen.y + controlOffset}
                     ${midX} ${toScreen.y - controlOffset}
                     ${toScreen.x} ${toScreen.y}`}
                stroke="#6366f1"
                stroke-width="2"
                fill="none"
                class="drop-shadow-sm"
              />
            );
          }}
        </For>

        {/* Temporary connection while dragging */}
        <Show when={tempConnection()}>
          {(conn) => (
            <line
              x1={conn().from.x}
              y1={conn().from.y}
              x2={conn().to.x}
              y2={conn().to.y}
              stroke="#6366f1"
              stroke-width="2"
              stroke-dasharray="5,5"
              class="opacity-70"
            />
          )}
        </Show>
      </svg>

      {/* Nodes */}
      <div
        class="absolute"
        style={{
          transform: `translate(${canvasOffset().x}px, ${canvasOffset().y}px) scale(${zoom()})`,
          'transform-origin': '0 0',
          'z-index': 2
        }}
      >
        <For each={props.nodes}>
          {(node) => {
            const config = getNodeConfig(node.type);
            const isSelected = props.selectedNode?.id === node.id;

            return (
              <div
                class={`absolute border-2 rounded-lg shadow-lg cursor-move select-none transition-all ${
                  config.color
                } ${
                  isSelected
                    ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-800'
                    : 'border-gray-300 dark:border-gray-600'
                } text-white`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${config.width}px`,
                  height: `${config.height}px`,
                }}
              >
                {/* Node content */}
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

                {/* Input ports */}
                <For each={node.inputs}>
                  {(input, index) => {
                    const portSpacing = config.width / (node.inputs.length + 1);
                    return (
                      <div
                        class="port absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-crosshair hover:bg-blue-600 transition-colors"
                        style={{
                          left: `${portSpacing * (index() + 1) - 6}px`,
                          top: '-6px'
                        }}
                        data-node-id={node.id}
                        data-port={input}
                        data-port-type="input"
                        title={`Input: ${input}`}
                      />
                    );
                  }}
                </For>

                {/* Output ports */}
                <For each={node.outputs}>
                  {(output, index) => {
                    const portSpacing = config.width / (node.outputs.length + 1);
                    return (
                      <div
                        class="port absolute w-3 h-3 bg-green-500 border-2 border-white rounded-full cursor-crosshair hover:bg-green-600 transition-colors"
                        style={{
                          left: `${portSpacing * (index() + 1) - 6}px`,
                          bottom: '-6px'
                        }}
                        data-node-id={node.id}
                        data-port={output}
                        data-port-type="output"
                        title={`Output: ${output}`}
                      />
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </div>

      {/* Zoom controls */}
      <div class="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-2 flex flex-col gap-2 z-10">
        <button
          class="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          onClick={() => setZoom(zoom() * 1.2)}
          title="Zoom In"
        >
          +
        </button>
        <div class="text-xs text-center text-gray-600 dark:text-gray-400 px-1">
          {Math.round(zoom() * 100)}%
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          onClick={() => setZoom(zoom() * 0.8)}
          title="Zoom Out"
        >
          -
        </button>
      </div>
    </div>
  );
}