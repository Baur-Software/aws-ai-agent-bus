// ModularWorkflowEngine Tests
// Comprehensive tests for the new modular workflow engine

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ModularWorkflowEngine } from '../../src/workflow/WorkflowEngine';
import { TaskRegistry } from '../../src/workflow/TaskRegistry';
import { 
  WorkflowDefinition, 
  WorkflowTask, 
  WorkflowContext, 
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  EventEmitter,
  WorkflowResult
} from '../../src/workflow/types';

// Mock Logger
class MockLogger implements Logger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Mock EventEmitter
class MockEventEmitter implements EventEmitter {
  private handlers = new Map<string, Function[]>();

  emit(event: string, data: any): void {
    const eventHandlers = this.handlers.get(event) || [];
    eventHandlers.forEach(handler => handler(data));
  }

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const eventHandlers = this.handlers.get(event) || [];
    const index = eventHandlers.indexOf(handler);
    if (index > -1) {
      eventHandlers.splice(index, 1);
    }
  }
}

// Mock Task Implementation
class MockTask implements WorkflowTask {
  readonly type: string;
  private shouldFail: boolean;
  private executionTime: number;

  constructor(type: string, shouldFail = false, executionTime = 10) {
    this.type = type;
    this.shouldFail = shouldFail;
    this.executionTime = executionTime;
  }

  async execute(input: any, context: WorkflowContext): Promise<any> {
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, this.executionTime));

    if (this.shouldFail) {
      throw new Error(`Mock task ${this.type} failed`);
    }

    return {
      taskType: this.type,
      input,
      executionId: context.executionId,
      nodeId: context.nodeId,
      timestamp: new Date().toISOString(),
      result: `${this.type} executed successfully`
    };
  }

  validate(input: any): ValidationResult {
    return {
      isValid: true,
      errors: []
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: `Mock ${this.type} Task`,
      description: `Mock task for testing ${this.type}`,
      properties: {
        value: {
          type: 'string',
          title: 'Test Value',
          description: 'A test input value'
        }
      },
      required: []
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: 'Testing',
      label: `Mock ${this.type}`,
      icon: 'TestTube',
      color: 'bg-gray-500',
      description: `Mock task for ${this.type}`
    };
  }
}

describe('ModularWorkflowEngine', () => {
  let engine: ModularWorkflowEngine;
  let taskRegistry: TaskRegistry;
  let logger: MockLogger;
  let eventEmitter: MockEventEmitter;

  beforeEach(() => {
    taskRegistry = new TaskRegistry();
    logger = new MockLogger();
    eventEmitter = new MockEventEmitter();
    engine = new ModularWorkflowEngine(taskRegistry, logger, eventEmitter);
  });

  describe('constructor', () => {
    it('should create engine with required dependencies', () => {
      expect(engine).toBeDefined();
    });

    it('should initialize with empty execution history', async () => {
      const history = await engine.getExecutionHistory();
      expect(history).toEqual([]);
    });
  });

  describe('workflow validation', () => {
    it('should validate valid workflow', async () => {
      // Register test task
      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new MockTask('test-task'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Test Workflow',
        description: 'A test workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 100,
            y: 100,
            inputs: [],
            outputs: ['output'],
            config: {}
          },
          {
            id: 'task-1', 
            type: 'test-task',
            x: 200,
            y: 100,
            inputs: ['input'],
            outputs: ['output'],
            config: { value: 'test' }
          }
        ],
        connections: [
          {
            from: 'trigger-1',
            to: 'task-1',
            fromOutput: 'output',
            toInput: 'input'
          }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['test']
        }
      };

      // Should not throw
      await expect(engine.executeWorkflow(workflow)).resolves.toBeDefined();
    });

    it('should reject workflow without trigger node', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Invalid Workflow',
        description: 'Workflow without trigger',
        nodes: [
          {
            id: 'task-1',
            type: 'test-task', 
            x: 100,
            y: 100,
            inputs: [],
            outputs: [],
            config: {}
          }
        ],
        connections: [],
        metadata: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('at least one trigger node');
    });

    it('should reject workflow with unknown task type', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Invalid Workflow',
        description: 'Workflow with unknown task',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 100,
            y: 100,
            inputs: [],
            outputs: [],
            config: {}
          },
          {
            id: 'unknown-1',
            type: 'unknown-task',
            x: 200,
            y: 100,
            inputs: [],
            outputs: [],
            config: {}
          }
        ],
        connections: [],
        metadata: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Unknown task type: unknown-task');
    });

    it('should reject workflow with circular dependencies', async () => {
      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new MockTask('task-a'));
      taskRegistry.registerTask(new MockTask('task-b'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Circular Workflow',
        description: 'Workflow with circular dependencies',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'task-a', type: 'task-a', x: 100, y: 0, inputs: ['in'], outputs: ['out'] },
          { id: 'task-b', type: 'task-b', x: 200, y: 0, inputs: ['in'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'task-a', fromOutput: 'out', toInput: 'in' },
          { from: 'task-a', to: 'task-b', fromOutput: 'out', toInput: 'in' },
          { from: 'task-b', to: 'task-a', fromOutput: 'out', toInput: 'in' } // Creates cycle
        ],
        metadata: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('circular dependencies');
    });
  });

  describe('workflow execution', () => {
    it('should execute simple workflow successfully', async () => {
      // Register test tasks
      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new MockTask('test-task'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Simple Workflow',
        description: 'Simple test workflow',
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            x: 100,
            y: 100,
            inputs: [],
            outputs: ['output']
          },
          {
            id: 'task-1',
            type: 'test-task',
            x: 200,
            y: 100,
            inputs: ['input'],
            outputs: ['output'],
            config: { value: 'test-data' }
          }
        ],
        connections: [
          {
            from: 'trigger-1',
            to: 'task-1',
            fromOutput: 'output',
            toInput: 'input'
          }
        ],
        metadata: {}
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.executionId).toBeDefined();
      expect(result.nodesExecuted).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.results).toHaveProperty('trigger-1');
      expect(result.results).toHaveProperty('task-1');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should execute workflow in correct topological order', async () => {
      const executionOrder: string[] = [];
      
      // Create tasks that track execution order
      class OrderedMockTask extends MockTask {
        async execute(input: any, context: WorkflowContext): Promise<any> {
          executionOrder.push(this.type);
          return super.execute(input, context);
        }
      }

      taskRegistry.registerTask(new OrderedMockTask('trigger'));
      taskRegistry.registerTask(new OrderedMockTask('task-a'));
      taskRegistry.registerTask(new OrderedMockTask('task-b'));
      taskRegistry.registerTask(new OrderedMockTask('task-c'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Ordered Workflow',
        description: 'Workflow to test execution order',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'task-a', type: 'task-a', x: 100, y: 0, inputs: ['in'], outputs: ['out'] },
          { id: 'task-b', type: 'task-b', x: 100, y: 100, inputs: ['in'], outputs: ['out'] },
          { id: 'task-c', type: 'task-c', x: 200, y: 50, inputs: ['in1', 'in2'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'task-a', fromOutput: 'out', toInput: 'in' },
          { from: 'trigger-1', to: 'task-b', fromOutput: 'out', toInput: 'in' },
          { from: 'task-a', to: 'task-c', fromOutput: 'out', toInput: 'in1' },
          { from: 'task-b', to: 'task-c', fromOutput: 'out', toInput: 'in2' }
        ],
        metadata: {}
      };

      await engine.executeWorkflow(workflow);

      expect(executionOrder).toEqual(['trigger', 'task-a', 'task-b', 'task-c']);
    });

    it('should handle task failure gracefully', async () => {
      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new MockTask('failing-task', true)); // Will fail

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Failing Workflow',
        description: 'Workflow with failing task',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'fail-1', type: 'failing-task', x: 100, y: 0, inputs: ['in'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'fail-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Mock task failing-task failed');
    });

    it('should emit workflow events during execution', async () => {
      const events: Array<{ event: string; data: any }> = [];
      
      eventEmitter.on('workflow.started', (data) => events.push({ event: 'started', data }));
      eventEmitter.on('workflow.node.started', (data) => events.push({ event: 'node.started', data }));
      eventEmitter.on('workflow.node.completed', (data) => events.push({ event: 'node.completed', data }));
      eventEmitter.on('workflow.completed', (data) => events.push({ event: 'completed', data }));

      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new MockTask('test-task'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Event Test Workflow',
        description: 'Workflow to test events',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'task-1', type: 'test-task', x: 100, y: 0, inputs: ['in'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'task-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      await engine.executeWorkflow(workflow);

      expect(events).toHaveLength(5); // started + 2 node.started + 2 node.completed + completed
      expect(events[0].event).toBe('started');
      expect(events[1].event).toBe('node.started');
      expect(events[2].event).toBe('node.completed');
      expect(events[3].event).toBe('node.started');
      expect(events[4].event).toBe('node.completed');
    });
  });

  describe('execution management', () => {
    it('should track execution history', async () => {
      taskRegistry.registerTask(new MockTask('trigger'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'History Test',
        description: 'Test execution history',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: [] }
        ],
        connections: [],
        metadata: {}
      };

      const result1 = await engine.executeWorkflow(workflow);
      const result2 = await engine.executeWorkflow(workflow);

      const history = await engine.getExecutionHistory();
      expect(history).toHaveLength(2);
      expect(history[0].executionId).toBe(result2.executionId); // Most recent first
      expect(history[1].executionId).toBe(result1.executionId);
    });

    it('should limit execution history', async () => {
      taskRegistry.registerTask(new MockTask('trigger'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'History Limit Test',
        description: 'Test history limit',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: [] }
        ],
        connections: [],
        metadata: {}
      };

      // Execute multiple workflows
      for (let i = 0; i < 5; i++) {
        await engine.executeWorkflow(workflow);
      }

      const limitedHistory = await engine.getExecutionHistory(3);
      expect(limitedHistory).toHaveLength(3);
    });

    it('should get execution status', async () => {
      taskRegistry.registerTask(new MockTask('trigger'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Status Test',
        description: 'Test execution status',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: [] }
        ],
        connections: [],
        metadata: {}
      };

      const result = await engine.executeWorkflow(workflow);
      const status = await engine.getExecutionStatus(result.executionId);

      expect(status).toBeDefined();
      expect(status!.executionId).toBe(result.executionId);
      expect(status!.status).toBe('completed');
    });

    it('should return null for unknown execution ID', async () => {
      const status = await engine.getExecutionStatus('unknown-execution-id');
      expect(status).toBeNull();
    });
  });

  describe('task validation', () => {
    it('should validate task input before execution', async () => {
      class ValidatingTask extends MockTask {
        validate(input: any): ValidationResult {
          if (!input.requiredField) {
            return {
              isValid: false,
              errors: ['requiredField is required']
            };
          }
          return { isValid: true, errors: [] };
        }
      }

      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new ValidatingTask('validating-task'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Validation Test',
        description: 'Test task validation',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { 
            id: 'validate-1', 
            type: 'validating-task', 
            x: 100, 
            y: 0, 
            inputs: ['in'], 
            outputs: ['out'],
            config: { invalidField: 'value' } // Missing requiredField
          }
        ],
        connections: [
          { from: 'trigger-1', to: 'validate-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('requiredField is required');
    });
  });

  describe('context passing', () => {
    it('should pass correct context to tasks', async () => {
      let capturedContext: WorkflowContext | null = null;

      class ContextCapturingTask extends MockTask {
        async execute(input: any, context: WorkflowContext): Promise<any> {
          capturedContext = context;
          return super.execute(input, context);
        }
      }

      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new ContextCapturingTask('context-task'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Context Test',
        description: 'Test context passing',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'context-1', type: 'context-task', x: 100, y: 0, inputs: ['in'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'context-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: { testMetadata: 'value' }
      };

      await engine.executeWorkflow(workflow);

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.executionId).toBeDefined();
      expect(capturedContext!.nodeId).toBe('context-1');
      expect(capturedContext!.workflowId).toBe('Context Test');
      expect(capturedContext!.logger).toBe(logger);
      expect(capturedContext!.eventEmitter).toBe(eventEmitter);
      expect(capturedContext!.metadata).toEqual({ testMetadata: 'value' });
    });

    it('should share results between tasks', async () => {
      class ResultSharingTask extends MockTask {
        async execute(input: any, context: WorkflowContext): Promise<any> {
          const result = await super.execute(input, context);
          
          if (this.type === 'producer') {
            context.data.sharedValue = 'shared data';
            return { ...result, produced: 'data' };
          } else {
            expect(context.data.sharedValue).toBe('shared data');
            expect(context.results['producer-1']).toHaveProperty('produced', 'data');
            return { ...result, received: context.data.sharedValue };
          }
        }
      }

      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new ResultSharingTask('producer'));
      taskRegistry.registerTask(new ResultSharingTask('consumer'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Result Sharing Test',
        description: 'Test result sharing between tasks',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'producer-1', type: 'producer', x: 100, y: 0, inputs: ['in'], outputs: ['out'] },
          { id: 'consumer-1', type: 'consumer', x: 200, y: 0, inputs: ['in'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'producer-1', fromOutput: 'out', toInput: 'in' },
          { from: 'producer-1', to: 'consumer-1', fromOutput: 'out', toInput: 'in' }
        ],
        metadata: {}
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.results['consumer-1']).toHaveProperty('received', 'shared data');
    });
  });

  describe('performance', () => {
    it('should execute multiple tasks concurrently when possible', async () => {
      const executionTimes: Record<string, number> = {};

      class TimingTask extends MockTask {
        async execute(input: any, context: WorkflowContext): Promise<any> {
          const start = Date.now();
          const result = await super.execute(input, context);
          executionTimes[context.nodeId] = Date.now() - start;
          return result;
        }
      }

      taskRegistry.registerTask(new MockTask('trigger'));
      taskRegistry.registerTask(new TimingTask('parallel-a', false, 100));
      taskRegistry.registerTask(new TimingTask('parallel-b', false, 100));
      taskRegistry.registerTask(new TimingTask('sequential', false, 50));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        created: '2024-01-01T00:00:00Z',
        name: 'Parallel Test',
        description: 'Test parallel execution',
        nodes: [
          { id: 'trigger-1', type: 'trigger', x: 0, y: 0, inputs: [], outputs: ['out'] },
          { id: 'parallel-a-1', type: 'parallel-a', x: 100, y: 0, inputs: ['in'], outputs: ['out'] },
          { id: 'parallel-b-1', type: 'parallel-b', x: 100, y: 100, inputs: ['in'], outputs: ['out'] },
          { id: 'sequential-1', type: 'sequential', x: 200, y: 50, inputs: ['in1', 'in2'], outputs: ['out'] }
        ],
        connections: [
          { from: 'trigger-1', to: 'parallel-a-1', fromOutput: 'out', toInput: 'in' },
          { from: 'trigger-1', to: 'parallel-b-1', fromOutput: 'out', toInput: 'in' },
          { from: 'parallel-a-1', to: 'sequential-1', fromOutput: 'out', toInput: 'in1' },
          { from: 'parallel-b-1', to: 'sequential-1', fromOutput: 'out', toInput: 'in2' }
        ],
        metadata: {}
      };

      const startTime = Date.now();
      const result = await engine.executeWorkflow(workflow);
      const totalTime = Date.now() - startTime;

      // Total time should be less than sum of all execution times (indicating parallelism)
      const sumOfExecutionTimes = Object.values(executionTimes).reduce((sum, time) => sum + time, 0);
      expect(totalTime).toBeLessThan(sumOfExecutionTimes);
      
      // But more than the longest individual task
      const maxExecutionTime = Math.max(...Object.values(executionTimes));
      expect(totalTime).toBeGreaterThanOrEqual(maxExecutionTime);
    });
  });
});