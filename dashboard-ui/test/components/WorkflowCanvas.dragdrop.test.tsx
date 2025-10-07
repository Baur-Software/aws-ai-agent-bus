import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import WorkflowCanvas, { WorkflowNode, WorkflowConnection } from '../../src/components/WorkflowCanvas';
import FloatingNodePanel from '../../src/components/FloatingNodePanel';

// Mock fetch for agent loading
global.fetch = vi.fn((url) => {
  if (url?.toString().includes('/mcp/agent/listAvailableAgents')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        result: [
          { id: 'trigger', name: 'Trigger', description: 'Start workflow' },
          { id: 'webhook', name: 'Webhook', description: 'HTTP endpoint' }
        ]
      })
    });
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  });
});

// Mock data transfer for drag and drop testing
class MockDataTransfer {
  private data: Record<string, string> = {};

  setData(format: string, data: string) {
    this.data[format] = data;
  }

  getData(format: string) {
    return this.data[format] || '';
  }

  get effectAllowed() { return 'copy'; }
  set effectAllowed(value: string) { /* mock */ }

  get dropEffect() { return 'copy'; }
  set dropEffect(value: string) { /* mock */ }
}

// Mock drag event
const createMockDragEvent = (type: string, options: Partial<DragEvent> = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: new MockDataTransfer(),
    writable: false
  });
  Object.defineProperty(event, 'clientX', { value: options.clientX || 200 });
  Object.defineProperty(event, 'clientY', { value: options.clientY || 200 });
  return event;
};

describe('WorkflowCanvas Drag and Drop', () => {
  let mockNodes: WorkflowNode[];
  let mockConnections: WorkflowConnection[];
  let setNodes: (nodes: WorkflowNode[]) => void;
  let setConnections: (connections: WorkflowConnection[]) => void;
  let setSelectedNode: (node: WorkflowNode | null) => void;

  beforeEach(() => {
    mockNodes = [];
    mockConnections = [];
    setNodes = vi.fn((nodes) => { mockNodes = nodes; });
    setConnections = vi.fn((connections) => { mockConnections = connections; });
    setSelectedNode = vi.fn();
  });

  it('should handle dragover events on canvas', () => {
    render(() => (
      <WorkflowCanvas
        nodes={mockNodes}
        setNodes={setNodes}
        connections={mockConnections}
        setConnections={setConnections}
        selectedNode={null}
        setSelectedNode={setSelectedNode}
      />
    ));

    // Find the main canvas container by its specific class
    const canvas = document.querySelector('.flex-1.relative.overflow-hidden');
    expect(canvas).toBeTruthy();

    const dragOverEvent = createMockDragEvent('dragover');
    fireEvent(canvas!, dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it('should create a new node when dropping valid node type', () => {
    render(() => (
      <WorkflowCanvas
        nodes={mockNodes}
        setNodes={setNodes}
        connections={mockConnections}
        setConnections={setConnections}
        selectedNode={null}
        setSelectedNode={setSelectedNode}
      />
    ));

    const canvas = document.querySelector('.flex-1.relative.overflow-hidden');
    expect(canvas).toBeTruthy();

    const dropEvent = createMockDragEvent('drop', { clientX: 300, clientY: 400 });

    // Simulate drag data from FloatingNodePanel
    dropEvent.dataTransfer!.setData('text/plain', 'trigger');

    fireEvent(canvas!, dropEvent);

    expect(setNodes).toHaveBeenCalled();
    expect(mockNodes).toHaveLength(1);
    expect(mockNodes[0].type).toBe('trigger');
    expect(mockNodes[0].x).toBeCloseTo(300, 0); // Approximate due to coordinate conversion
    expect(mockNodes[0].y).toBeCloseTo(400, 0);
  });

  it('should not create node when dropping with no drag data', () => {
    render(() => (
      <WorkflowCanvas
        nodes={mockNodes}
        setNodes={setNodes}
        connections={mockConnections}
        setConnections={setConnections}
        selectedNode={null}
        setSelectedNode={setSelectedNode}
      />
    ));

    const canvas = document.querySelector('.flex-1.relative.overflow-hidden');
    expect(canvas).toBeTruthy();

    const dropEvent = createMockDragEvent('drop');
    // No drag data set

    fireEvent(canvas!, dropEvent);

    expect(setNodes).not.toHaveBeenCalled();
    expect(mockNodes).toHaveLength(0);
  });

  it('should create nodes with correct inputs/outputs based on type', () => {
    render(() => (
      <WorkflowCanvas
        nodes={mockNodes}
        setNodes={setNodes}
        connections={mockConnections}
        setConnections={setConnections}
        selectedNode={null}
        setSelectedNode={setSelectedNode}
      />
    ));

    const canvas = document.querySelector('.flex-1.relative.overflow-hidden');
    expect(canvas).toBeTruthy();

    // Test trigger node (no inputs)
    const triggerDropEvent = createMockDragEvent('drop');
    triggerDropEvent.dataTransfer!.setData('text/plain', 'trigger');
    fireEvent(canvas!, triggerDropEvent);

    expect(mockNodes[0].inputs).toEqual([]);
    expect(mockNodes[0].outputs).toEqual(['output']);

    // Test output node (no outputs)
    const outputDropEvent = createMockDragEvent('drop');
    outputDropEvent.dataTransfer!.setData('text/plain', 'output');
    fireEvent(canvas!, outputDropEvent);

    expect(mockNodes).toHaveLength(2);
    expect(mockNodes[1].inputs).toEqual(['input']);
    expect(mockNodes[1].outputs).toEqual([]);

    // Test regular node
    const regularDropEvent = createMockDragEvent('drop');
    regularDropEvent.dataTransfer!.setData('text/plain', 'webhook');
    fireEvent(canvas!, regularDropEvent);

    expect(mockNodes[2].inputs).toEqual(['input']);
    expect(mockNodes[2].outputs).toEqual(['output']);
  });
});

describe('FloatingNodePanel Drag Events', () => {
  let mockOnDragStart: (nodeType: string, e: DragEvent) => void;
  let mockConnectedIntegrations: string[];
  let mockOnConnectIntegration: (integration: string) => void;

  beforeEach(() => {
    mockOnDragStart = vi.fn();
    mockConnectedIntegrations = ['slack'];
    mockOnConnectIntegration = vi.fn();
  });

  it('should set up draggable nodes correctly', () => {
    render(() => (
      <FloatingNodePanel
        onDragStart={mockOnDragStart}
        connectedIntegrations={mockConnectedIntegrations}
        onConnectIntegration={mockOnConnectIntegration}
      />
    ));

    // Find a draggable node (trigger node should be available)
    const nodeElements = screen.getAllByText(/Trigger|Webhook|Schedule/);
    expect(nodeElements.length).toBeGreaterThan(0);

    // Check if the parent div has draggable attribute
    const triggerNode = nodeElements.find(el => el.textContent?.includes('Trigger'));
    const draggableDiv = triggerNode?.closest('[draggable]');
    expect(draggableDiv).toBeTruthy();
    expect(draggableDiv?.getAttribute('draggable')).toBe('true');
  });

  it('should call onDragStart when dragging a node', () => {
    render(() => (
      <FloatingNodePanel
        onDragStart={mockOnDragStart}
        connectedIntegrations={mockConnectedIntegrations}
        onConnectIntegration={mockOnConnectIntegration}
      />
    ));

    // Find trigger node and simulate drag start
    const triggerNode = screen.getByText('Trigger');
    const draggableDiv = triggerNode.closest('[draggable]') as HTMLElement;

    const dragStartEvent = createMockDragEvent('dragstart');
    fireEvent(draggableDiv, dragStartEvent);

    expect(mockOnDragStart).toHaveBeenCalledWith('trigger', expect.any(Object));
    expect(dragStartEvent.dataTransfer!.getData('text/plain')).toBe('trigger');
  });

  it('should disable dragging for nodes requiring missing integrations', () => {
    // Test with limited integrations
    render(() => (
      <FloatingNodePanel
        onDragStart={mockOnDragStart}
        connectedIntegrations={[]} // No integrations connected
        onConnectIntegration={mockOnConnectIntegration}
      />
    ));

    // Find a node that requires integration (GA Top Pages)
    const gaNode = screen.queryByText('GA Top Pages');
    if (gaNode) {
      const draggableDiv = gaNode.closest('[draggable]');
      expect(draggableDiv?.getAttribute('draggable')).toBe('false');
    }
  });
});

describe('End-to-End Drag and Drop Flow', () => {
  it('should complete full drag and drop workflow', () => {
    const [nodes, setNodes] = createSignal<WorkflowNode[]>([]);
    const [connections, setConnections] = createSignal<WorkflowConnection[]>([]);
    const [selectedNode, setSelectedNode] = createSignal<WorkflowNode | null>(null);

    const mockOnDragStart = vi.fn((nodeType: string, e: DragEvent) => {
      // Simulate what FloatingNodePanel does
      e.dataTransfer!.setData('text/plain', nodeType);
      e.dataTransfer!.effectAllowed = 'copy';
    });

    // Render both components
    const { container } = render(() => (
      <div>
        <FloatingNodePanel
          onDragStart={mockOnDragStart}
          connectedIntegrations={['slack']}
          onConnectIntegration={() => {}}
        />
        <WorkflowCanvas
          nodes={nodes()}
          setNodes={setNodes}
          connections={connections()}
          setConnections={setConnections}
          selectedNode={selectedNode()}
          setSelectedNode={setSelectedNode}
        />
      </div>
    ));

    // 1. Start drag from FloatingNodePanel
    const triggerNode = screen.getByText('Trigger');
    const draggableDiv = triggerNode.closest('[draggable]') as HTMLElement;
    const dragStartEvent = createMockDragEvent('dragstart');
    fireEvent(draggableDiv, dragStartEvent);

    expect(mockOnDragStart).toHaveBeenCalledWith('trigger', expect.any(Object));

    // 2. Drag over canvas
    const canvasElements = container.querySelectorAll('[class*="bg-gray-50"]');
    const canvas = canvasElements[0] as HTMLElement; // First one should be the canvas
    const dragOverEvent = createMockDragEvent('dragover');
    dragOverEvent.dataTransfer!.setData('text/plain', 'trigger');
    fireEvent(canvas, dragOverEvent);

    // 3. Drop on canvas
    const dropEvent = createMockDragEvent('drop', { clientX: 200, clientY: 200 });
    dropEvent.dataTransfer!.setData('text/plain', 'trigger');
    fireEvent(canvas, dropEvent);

    // 4. Verify node was created
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0].type).toBe('trigger');
    expect(nodes()[0].title).toBe('Trigger');
  });
});

// Helper test for coordinate transformation
describe('Canvas Coordinate Transformation', () => {
  it('should convert screen coordinates to canvas coordinates correctly', () => {
    const [nodes, setNodes] = createSignal<WorkflowNode[]>([]);

    render(() => (
      <WorkflowCanvas
        nodes={nodes()}
        setNodes={setNodes}
        connections={[]}
        setConnections={() => {}}
        selectedNode={null}
        setSelectedNode={() => {}}
      />
    ));

    const canvas = screen.getByRole('generic');

    // Mock getBoundingClientRect
    const mockGetBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 100,
      width: 800,
      height: 600
    }));
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect
    });

    // Drop at screen coordinates (300, 300)
    const dropEvent = createMockDragEvent('drop', { clientX: 300, clientY: 300 });
    dropEvent.dataTransfer!.setData('text/plain', 'webhook');
    fireEvent(canvas!, dropEvent);

    // Should create node at canvas coordinates (200, 200) = (300-100, 300-100)
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0].x).toBe(200);
    expect(nodes()[0].y).toBe(200);
  });
});