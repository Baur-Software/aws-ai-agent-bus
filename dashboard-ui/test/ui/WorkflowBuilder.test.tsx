// WorkflowBuilder UI Integration Tests
// Tests for WorkflowBuilder component and UI interactions

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import WorkflowBuilder from '../../src/components/WorkflowBuilder';
import { TaskRegistry } from '../../src/workflow/TaskRegistry';
import { registerAllTasks } from '../../src/workflow/tasks';
import { createServiceContainer } from '../../src/services';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowConnection,
  NODE_CATEGORIES,
  Logger
} from '../../src/workflow/types';

// Mock services for UI testing
const mockMCPClient = {
  callTool: vi.fn().mockResolvedValue({ success: true })
};

const mockHTTPClient = {
  get: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  post: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  put: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  delete: vi.fn().mockResolvedValue({ status: 200, data: {} })
};

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock drag and drop API
const mockDataTransfer = {
  getData: vi.fn(),
  setData: vi.fn(),
  clearData: vi.fn(),
  types: [],
  files: [] as any,
  items: [] as any,
  effectAllowed: 'all' as any,
  dropEffect: 'none' as any
};

// Mock workflow execution results
const mockWorkflowResults = {
  'ga-top-pages-1': {
    pages: [
      { page: '/analytics-guide', pageviews: 2500, uniquePageviews: 2000, avgTimeOnPage: 180 },
      { page: '/seo-tips', pageviews: 1800, uniquePageviews: 1500, avgTimeOnPage: 220 }
    ],
    totalPageviews: 4300,
    propertyId: '123456789',
    requestedDays: 30,
    timestamp: '2024-01-01T12:00:00.000Z'
  },
  'kv-set-1': {
    key: 'analytics-cache',
    success: true,
    timestamp: '2024-01-01T12:00:01.000Z'
  }
};

describe('WorkflowBuilder UI Integration', () => {
  let taskRegistry: TaskRegistry;
  let services: ReturnType<typeof createServiceContainer>;

  // Sample workflow for testing
  const sampleWorkflow: WorkflowDefinition = {
    version: '1.0',
    created: '2024-01-01T00:00:00Z',
    name: 'Sample Analytics Workflow',
    description: 'A sample workflow for testing',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        x: 100,
        y: 100,
        inputs: [],
        outputs: ['out']
      },
      {
        id: 'ga-top-pages-1',
        type: 'ga-top-pages',
        x: 300,
        y: 100,
        inputs: ['in'],
        outputs: ['out'],
        config: {
          propertyId: '123456789',
          days: 30,
          maxResults: 10
        }
      },
      {
        id: 'kv-set-1',
        type: 'kv-set',
        x: 500,
        y: 100,
        inputs: ['in'],
        outputs: ['out'],
        config: {
          key: 'analytics-cache',
          useContextData: true,
          contextKey: 'topPages'
        }
      }
    ],
    connections: [
      {
        from: 'trigger-1',
        to: 'ga-top-pages-1',
        fromOutput: 'out',
        toInput: 'in'
      },
      {
        from: 'ga-top-pages-1',
        to: 'kv-set-1',
        fromOutput: 'out',
        toInput: 'in'
      }
    ],
    metadata: {
      category: 'Analytics',
      tags: ['google-analytics', 'testing']
    }
  };

  beforeEach(() => {
    // Set up services and task registry
    services = createServiceContainer({
      mcpClient: mockMCPClient,
      httpClient: mockHTTPClient,
      userId: 'ui-test-user'
    });

    taskRegistry = new TaskRegistry();
    registerAllTasks(taskRegistry, {
      googleAnalytics: services.googleAnalytics,
      trello: services.trello,
      mcp: services.mcp,
      http: services.http,
      logger: mockLogger
    });

    // Mock drag and drop
    Object.defineProperty(window, 'DataTransfer', {
      value: function() { return mockDataTransfer; }
    });

    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WorkflowBuilder Component Rendering', () => {
    it('should render workflow builder with task palette', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition | null>(null);
      const [isExecuting, setIsExecuting] = createSignal(false);
      const [executionResults, setExecutionResults] = createSignal<any>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={isExecuting()}
          executionResults={executionResults()}
          onExecute={() => {
            setIsExecuting(true);
            setTimeout(() => {
              setIsExecuting(false);
              setExecutionResults(mockWorkflowResults);
            }, 100);
          }}
        />
      ));

      // Check for main components
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
      expect(screen.getByTestId('task-palette')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument();
    });

    it('should display task categories in palette', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition | null>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Check for task categories
      await waitFor(() => {
        expect(screen.getByText('Core')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('MCP Tools')).toBeInTheDocument();
        expect(screen.getByText('HTTP')).toBeInTheDocument();
      });
    });

    it('should show task nodes in each category', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition | null>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Expand Analytics category
      const analyticsCategory = screen.getByText('Analytics');
      fireEvent.click(analyticsCategory);

      await waitFor(() => {
        expect(screen.getByText('GA Top Pages')).toBeInTheDocument();
        expect(screen.getByText('GA Search Data')).toBeInTheDocument();
      });

      // Expand MCP Tools category
      const mcpCategory = screen.getByText('MCP Tools');
      fireEvent.click(mcpCategory);

      await waitFor(() => {
        expect(screen.getByText('KV Get')).toBeInTheDocument();
        expect(screen.getByText('KV Set')).toBeInTheDocument();
        expect(screen.getByText('List Artifacts')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Canvas Interactions', () => {
    it('should load and display existing workflow', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      await waitFor(() => {
        // Check for workflow nodes
        expect(screen.getByTestId('node-trigger-1')).toBeInTheDocument();
        expect(screen.getByTestId('node-ga-top-pages-1')).toBeInTheDocument();
        expect(screen.getByTestId('node-kv-set-1')).toBeInTheDocument();

        // Check for connections
        expect(screen.getByTestId('connection-trigger-1-ga-top-pages-1')).toBeInTheDocument();
        expect(screen.getByTestId('connection-ga-top-pages-1-kv-set-1')).toBeInTheDocument();
      });
    });

    it('should allow adding new nodes from palette', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition | null>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Expand Core category
      const coreCategory = screen.getByText('Core');
      fireEvent.click(coreCategory);

      await waitFor(() => {
        expect(screen.getByText('Trigger')).toBeInTheDocument();
      });

      // Drag trigger node to canvas
      const triggerNode = screen.getByText('Trigger');
      const canvas = screen.getByTestId('workflow-canvas');

      fireEvent.dragStart(triggerNode, {
        dataTransfer: mockDataTransfer
      });

      fireEvent.drop(canvas, {
        dataTransfer: mockDataTransfer,
        clientX: 200,
        clientY: 200
      });

      await waitFor(() => {
        expect(workflow()).toBeTruthy();
        expect(workflow()!.nodes).toHaveLength(1);
        expect(workflow()!.nodes[0].type).toBe('trigger');
      });
    });

    it('should allow node selection and configuration', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Click on GA node to select it
      const gaNode = await screen.findByTestId('node-ga-top-pages-1');
      fireEvent.click(gaNode);

      await waitFor(() => {
        // Check for node configuration panel
        expect(screen.getByTestId('node-config-panel')).toBeInTheDocument();
        expect(screen.getByDisplayValue('123456789')).toBeInTheDocument(); // Property ID
        expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Days
      });
    });

    it('should allow node configuration editing', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Select GA node
      const gaNode = await screen.findByTestId('node-ga-top-pages-1');
      fireEvent.click(gaNode);

      // Change days value
      const daysInput = await screen.findByDisplayValue('30');
      fireEvent.input(daysInput, { target: { value: '7' } });

      await waitFor(() => {
        const updatedWorkflow = workflow();
        const gaNodeConfig = updatedWorkflow!.nodes.find(n => n.id === 'ga-top-pages-1')?.config;
        expect(gaNodeConfig?.days).toBe(7);
      });
    });

    it('should allow node deletion', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Select KV node
      const kvNode = await screen.findByTestId('node-kv-set-1');
      fireEvent.click(kvNode);

      // Click delete button
      const deleteButton = screen.getByTestId('delete-node-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        const updatedWorkflow = workflow();
        expect(updatedWorkflow!.nodes).toHaveLength(2);
        expect(updatedWorkflow!.nodes.find(n => n.id === 'kv-set-1')).toBeUndefined();
        expect(updatedWorkflow!.connections).toHaveLength(1); // Connection to deleted node removed
      });
    });
  });

  describe('Node Connection Management', () => {
    it('should allow creating connections between nodes', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>({
        ...sampleWorkflow,
        connections: [] // Start with no connections
      });

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Get output handle of trigger node
      const triggerOutput = await screen.findByTestId('output-handle-trigger-1-out');
      
      // Get input handle of GA node
      const gaInput = await screen.findByTestId('input-handle-ga-top-pages-1-in');

      // Simulate connection creation
      fireEvent.mouseDown(triggerOutput);
      fireEvent.mouseMove(gaInput);
      fireEvent.mouseUp(gaInput);

      await waitFor(() => {
        const updatedWorkflow = workflow();
        expect(updatedWorkflow.connections).toHaveLength(1);
        expect(updatedWorkflow.connections[0]).toEqual({
          from: 'trigger-1',
          to: 'ga-top-pages-1',
          fromOutput: 'out',
          toInput: 'in'
        });
      });
    });

    it('should prevent invalid connections', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Try to connect output to output (invalid)
      const triggerOutput = await screen.findByTestId('output-handle-trigger-1-out');
      const gaOutput = await screen.findByTestId('output-handle-ga-top-pages-1-out');

      fireEvent.mouseDown(triggerOutput);
      fireEvent.mouseMove(gaOutput);
      fireEvent.mouseUp(gaOutput);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/cannot connect output to output/i)).toBeInTheDocument();
      });
    });

    it('should allow deleting connections', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Click on connection line
      const connection = await screen.findByTestId('connection-trigger-1-ga-top-pages-1');
      fireEvent.click(connection);

      // Click delete connection button
      const deleteButton = screen.getByTestId('delete-connection-button');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        const updatedWorkflow = workflow();
        expect(updatedWorkflow.connections).toHaveLength(1); // Only one connection left
        expect(updatedWorkflow.connections.find(c => 
          c.from === 'trigger-1' && c.to === 'ga-top-pages-1'
        )).toBeUndefined();
      });
    });
  });

  describe('Workflow Execution and Results', () => {
    it('should execute workflow and display results', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);
      const [isExecuting, setIsExecuting] = createSignal(false);
      const [executionResults, setExecutionResults] = createSignal<any>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={isExecuting()}
          executionResults={executionResults()}
          onExecute={() => {
            setIsExecuting(true);
            setTimeout(() => {
              setIsExecuting(false);
              setExecutionResults({
                status: 'completed',
                results: mockWorkflowResults,
                executionTime: 1500,
                nodesExecuted: 3
              });
            }, 100);
          }}
        />
      ));

      // Click execute button
      const executeButton = screen.getByTestId('execute-workflow-button');
      fireEvent.click(executeButton);

      // Should show executing state
      await waitFor(() => {
        expect(screen.getByText(/executing/i)).toBeInTheDocument();
        expect(executeButton).toBeDisabled();
      });

      // Wait for execution to complete
      await waitFor(() => {
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(screen.getByTestId('execution-results')).toBeInTheDocument();
      });
    });

    it('should display execution results in nodes', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);
      const [executionResults, setExecutionResults] = createSignal({
        status: 'completed',
        results: mockWorkflowResults,
        executionTime: 1500,
        nodesExecuted: 3
      });

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={executionResults()}
          onExecute={() => {}}
        />
      ));

      // Nodes should show execution success indicators
      await waitFor(() => {
        const gaNode = screen.getByTestId('node-ga-top-pages-1');
        const kvNode = screen.getByTestId('node-kv-set-1');

        expect(within(gaNode).getByTestId('execution-status-success')).toBeInTheDocument();
        expect(within(kvNode).getByTestId('execution-status-success')).toBeInTheDocument();
      });
    });

    it('should handle execution errors gracefully', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);
      const [isExecuting, setIsExecuting] = createSignal(false);
      const [executionResults, setExecutionResults] = createSignal<any>(null);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={isExecuting()}
          executionResults={executionResults()}
          onExecute={() => {
            setIsExecuting(true);
            setTimeout(() => {
              setIsExecuting(false);
              setExecutionResults({
                status: 'failed',
                error: 'GA API authentication failed',
                executionTime: 500,
                nodesExecuted: 1
              });
            }, 100);
          }}
        />
      ));

      // Execute workflow
      const executeButton = screen.getByTestId('execute-workflow-button');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
        expect(screen.getByText(/GA API authentication failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Validation', () => {
    it('should validate workflow before execution', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        ...sampleWorkflow,
        nodes: [
          {
            id: 'ga-node-1',
            type: 'ga-top-pages',
            x: 100,
            y: 100,
            inputs: ['in'],
            outputs: ['out'],
            config: {} // Missing required propertyId
          }
        ],
        connections: []
      };

      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(invalidWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/property id is required/i)).toBeInTheDocument();
      });

      // Execute button should be disabled
      const executeButton = screen.getByTestId('execute-workflow-button');
      expect(executeButton).toBeDisabled();
    });

    it('should validate node connections', async () => {
      const disconnectedWorkflow: WorkflowDefinition = {
        ...sampleWorkflow,
        connections: [] // No connections
      };

      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(disconnectedWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      // Should show connection warnings
      await waitFor(() => {
        expect(screen.getByText(/some nodes are not connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Persistence', () => {
    it('should save workflow changes', async () => {
      const onSave = vi.fn();
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
          onSave={onSave}
        />
      ));

      // Make a change to the workflow
      const gaNode = await screen.findByTestId('node-ga-top-pages-1');
      fireEvent.click(gaNode);

      const daysInput = await screen.findByDisplayValue('30');
      fireEvent.input(daysInput, { target: { value: '7' } });

      // Save workflow
      const saveButton = screen.getByTestId('save-workflow-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: 'ga-top-pages-1',
                config: expect.objectContaining({
                  days: 7
                })
              })
            ])
          })
        );
      });
    });

    it('should load workflow from saved state', async () => {
      const savedWorkflow: WorkflowDefinition = {
        ...sampleWorkflow,
        name: 'Loaded Workflow',
        description: 'A workflow loaded from storage'
      };

      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(savedWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Loaded Workflow')).toBeInTheDocument();
        expect(screen.getByDisplayValue('A workflow loaded from storage')).toBeInTheDocument();
      });
    });
  });

  describe('UI Responsiveness and Performance', () => {
    it('should handle large workflows efficiently', async () => {
      // Create a workflow with many nodes
      const largeWorkflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Large Workflow',
        description: 'Workflow with many nodes',
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node-${i}`,
          type: 'kv-set',
          x: (i % 10) * 100,
          y: Math.floor(i / 10) * 100,
          inputs: ['in'],
          outputs: ['out'],
          config: { key: `key-${i}`, value: `value-${i}` }
        })),
        connections: [],
        metadata: {}
      };

      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(largeWorkflow);

      const start = Date.now();
      
      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      await waitFor(() => {
        expect(screen.getAllByTestId(/node-/).length).toBe(50);
      });

      const renderTime = Date.now() - start;
      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('should handle zoom and pan operations', async () => {
      const [workflow, setWorkflow] = createSignal<WorkflowDefinition>(sampleWorkflow);

      render(() => (
        <WorkflowBuilder
          workflow={workflow()}
          setWorkflow={setWorkflow}
          taskRegistry={taskRegistry}
          isExecuting={false}
          executionResults={null}
          onExecute={() => {}}
        />
      ));

      const canvas = screen.getByTestId('workflow-canvas');

      // Test zoom in
      const zoomInButton = screen.getByTestId('zoom-in-button');
      fireEvent.click(zoomInButton);

      // Test zoom out
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      fireEvent.click(zoomOutButton);

      // Test pan
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);

      // Should not throw errors and canvas should respond
      expect(canvas).toBeInTheDocument();
    });
  });
});