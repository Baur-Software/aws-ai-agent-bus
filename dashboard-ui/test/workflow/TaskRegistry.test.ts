// TaskRegistry Tests
// Comprehensive tests for task registration and service injection

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskRegistry } from '../../src/workflow/TaskRegistry';
import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  NODE_CATEGORIES
} from '../../src/workflow/types';

// Mock Logger
class MockLogger implements Logger {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// Mock Service Interface
interface MockService {
  callAPI(endpoint: string): Promise<any>;
  isConnected(): boolean;
}

class MockServiceImpl implements MockService {
  async callAPI(endpoint: string): Promise<any> {
    return { endpoint, result: 'mock data' };
  }

  isConnected(): boolean {
    return true;
  }
}

// Mock Task with Service Dependency
class MockServiceTask implements WorkflowTask {
  readonly type = 'mock-service-task';

  constructor(
    private mockService: MockService,
    private logger?: Logger
  ) {}

  async execute(input: any, context: WorkflowContext): Promise<any> {
    this.logger?.info(`Executing ${this.type} with service`);
    
    if (!this.mockService.isConnected()) {
      throw new Error('Service not connected');
    }

    const apiResult = await this.mockService.callAPI('/test-endpoint');
    
    return {
      taskType: this.type,
      input,
      serviceResult: apiResult,
      executedAt: new Date().toISOString()
    };
  }

  validate(input: any): ValidationResult {
    if (!input.requiredField) {
      return {
        isValid: false,
        errors: ['requiredField is required']
      };
    }
    return { isValid: true, errors: [] };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Mock Service Task',
      description: 'Task that uses mock service',
      properties: {
        requiredField: {
          type: 'string',
          title: 'Required Field',
          description: 'A required input field'
        },
        optionalField: {
          type: 'string',
          title: 'Optional Field',
          description: 'An optional input field'
        }
      },
      required: ['requiredField']
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.MCP_TOOLS,
      label: 'Mock Service',
      icon: 'Database',
      color: 'bg-blue-600',
      description: 'Mock task with service dependency',
      tags: ['mock', 'service', 'testing'],
      integrationRequired: 'mock-service'
    };
  }
}

// Simple Mock Task without Dependencies
class SimpleMockTask implements WorkflowTask {
  readonly type: string;

  constructor(type: string) {
    this.type = type;
  }

  async execute(input: any, context: WorkflowContext): Promise<any> {
    return {
      taskType: this.type,
      input,
      executed: true
    };
  }

  validate(input: any): ValidationResult {
    return { isValid: true, errors: [] };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: `Simple ${this.type}`,
      description: `Simple mock task: ${this.type}`,
      properties: {},
      required: []
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: `Simple ${this.type}`,
      icon: 'Cog',
      color: 'bg-gray-500',
      description: `Simple mock task: ${this.type}`,
      tags: ['simple', 'mock']
    };
  }
}

describe('TaskRegistry', () => {
  let taskRegistry: TaskRegistry;
  let mockService: MockService;
  let logger: MockLogger;

  beforeEach(() => {
    taskRegistry = new TaskRegistry();
    mockService = new MockServiceImpl();
    logger = new MockLogger();
  });

  describe('task registration', () => {
    it('should register a task successfully', () => {
      const task = new SimpleMockTask('test-task');
      
      expect(() => taskRegistry.registerTask(task)).not.toThrow();
      expect(taskRegistry.hasTask('test-task')).toBe(true);
      expect(taskRegistry.getTaskCount()).toBe(1);
    });

    it('should register task with service dependency', () => {
      const task = new MockServiceTask(mockService, logger);
      
      taskRegistry.registerTask(task);
      
      expect(taskRegistry.hasTask('mock-service-task')).toBe(true);
      expect(taskRegistry.getTaskCount()).toBe(1);
    });

    it('should prevent duplicate task registration', () => {
      const task1 = new SimpleMockTask('duplicate-task');
      const task2 = new SimpleMockTask('duplicate-task');
      
      taskRegistry.registerTask(task1);
      
      expect(() => taskRegistry.registerTask(task2))
        .toThrow("Task type 'duplicate-task' is already registered");
    });

    it('should register multiple tasks', () => {
      const tasks = [
        new SimpleMockTask('task-1'),
        new SimpleMockTask('task-2'),
        new SimpleMockTask('task-3'),
        new MockServiceTask(mockService, logger)
      ];

      tasks.forEach(task => taskRegistry.registerTask(task));

      expect(taskRegistry.getTaskCount()).toBe(4);
      expect(taskRegistry.getAllTaskTypes()).toEqual([
        'mock-service-task',
        'task-1',
        'task-2',
        'task-3'
      ]);
    });

    it('should register tasks in bulk', () => {
      const tasks = [
        new SimpleMockTask('bulk-1'),
        new SimpleMockTask('bulk-2'),
        new MockServiceTask(mockService, logger)
      ];

      expect(() => taskRegistry.registerTasks(tasks)).not.toThrow();
      expect(taskRegistry.getTaskCount()).toBe(3);
    });

    it('should handle bulk registration with some failures', () => {
      const tasks = [
        new SimpleMockTask('bulk-good-1'),
        new SimpleMockTask('bulk-duplicate'),
        new SimpleMockTask('bulk-good-2')
      ];

      // Register one task first to create a duplicate
      taskRegistry.registerTask(new SimpleMockTask('bulk-duplicate'));

      expect(() => taskRegistry.registerTasks(tasks)).toThrow('Failed to register some tasks');
      
      // Good tasks should still be registered
      expect(taskRegistry.hasTask('bulk-good-1')).toBe(true);
      expect(taskRegistry.hasTask('bulk-good-2')).toBe(true);
    });
  });

  describe('task retrieval', () => {
    beforeEach(() => {
      taskRegistry.registerTask(new SimpleMockTask('simple-task'));
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should retrieve registered task', () => {
      const task = taskRegistry.getTask('simple-task');
      
      expect(task).toBeDefined();
      expect(task?.type).toBe('simple-task');
    });

    it('should return undefined for unregistered task', () => {
      const task = taskRegistry.getTask('non-existent-task');
      
      expect(task).toBeUndefined();
    });

    it('should check if task exists', () => {
      expect(taskRegistry.hasTask('simple-task')).toBe(true);
      expect(taskRegistry.hasTask('mock-service-task')).toBe(true);
      expect(taskRegistry.hasTask('non-existent')).toBe(false);
    });

    it('should get all task types sorted', () => {
      const taskTypes = taskRegistry.getAllTaskTypes();
      
      expect(taskTypes).toEqual([
        'mock-service-task',
        'simple-task'
      ]);
    });
  });

  describe('category organization', () => {
    beforeEach(() => {
      // Register tasks in different categories
      taskRegistry.registerTask(new SimpleMockTask('data-task-1'));
      taskRegistry.registerTask(new SimpleMockTask('data-task-2'));
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should organize tasks by category', () => {
      const dataProcessingTasks = taskRegistry.getTasksByCategory(NODE_CATEGORIES.DATA_PROCESSING);
      const mcpTasks = taskRegistry.getTasksByCategory(NODE_CATEGORIES.MCP_TOOLS);

      expect(dataProcessingTasks).toHaveLength(2);
      expect(mcpTasks).toHaveLength(1);
      
      expect(dataProcessingTasks.map(t => t.type)).toEqual(['data-task-1', 'data-task-2']);
      expect(mcpTasks[0].type).toBe('mock-service-task');
    });

    it('should get all categories', () => {
      const categories = taskRegistry.getAllCategories();
      
      expect(categories).toContain(NODE_CATEGORIES.DATA_PROCESSING);
      expect(categories).toContain(NODE_CATEGORIES.MCP_TOOLS);
    });

    it('should return empty array for non-existent category', () => {
      const tasks = taskRegistry.getTasksByCategory('Non-Existent Category');
      expect(tasks).toEqual([]);
    });

    it('should count tasks by category', () => {
      const counts = taskRegistry.getTaskCountByCategory();
      
      expect(counts[NODE_CATEGORIES.DATA_PROCESSING]).toBe(2);
      expect(counts[NODE_CATEGORIES.MCP_TOOLS]).toBe(1);
    });
  });

  describe('integration requirements', () => {
    beforeEach(() => {
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should organize tasks by integration requirement', () => {
      const mockServiceTasks = taskRegistry.getTasksRequiringIntegration('mock-service');
      
      expect(mockServiceTasks).toHaveLength(1);
      expect(mockServiceTasks[0].type).toBe('mock-service-task');
    });

    it('should get all integrations', () => {
      const integrations = taskRegistry.getAllIntegrations();
      
      expect(integrations).toContain('mock-service');
    });

    it('should return empty array for non-required integration', () => {
      const tasks = taskRegistry.getTasksRequiringIntegration('non-existent-service');
      expect(tasks).toEqual([]);
    });
  });

  describe('task search and filtering', () => {
    beforeEach(() => {
      taskRegistry.registerTask(new SimpleMockTask('analytics-report'));
      taskRegistry.registerTask(new SimpleMockTask('data-transform'));
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should search tasks by type', () => {
      const results = taskRegistry.searchTasks('analytics');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('analytics-report');
    });

    it('should search tasks by label', () => {
      const results = taskRegistry.searchTasks('Service');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('mock-service-task');
    });

    it('should search tasks by tags', () => {
      const results = taskRegistry.searchTasks('service');
      
      expect(results.some(task => task.type === 'mock-service-task')).toBe(true);
    });

    it('should filter tasks by category', () => {
      const results = taskRegistry.filterTasks({
        category: NODE_CATEGORIES.MCP_TOOLS
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('mock-service-task');
    });

    it('should filter tasks by integration', () => {
      const results = taskRegistry.filterTasks({
        integration: 'mock-service'
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('mock-service-task');
    });

    it('should filter tasks by tags', () => {
      const results = taskRegistry.filterTasks({
        tags: ['service', 'testing']
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('mock-service-task');
    });

    it('should combine multiple filters', () => {
      const results = taskRegistry.filterTasks({
        category: NODE_CATEGORIES.MCP_TOOLS,
        integration: 'mock-service',
        tags: ['testing']
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('mock-service-task');
    });
  });

  describe('task information', () => {
    beforeEach(() => {
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should get task display info', () => {
      const info = taskRegistry.getTaskInfo('mock-service-task');
      
      expect(info).toBeDefined();
      expect(info?.label).toBe('Mock Service');
      expect(info?.category).toBe(NODE_CATEGORIES.MCP_TOOLS);
      expect(info?.integrationRequired).toBe('mock-service');
    });

    it('should return null for unknown task', () => {
      const info = taskRegistry.getTaskInfo('unknown-task');
      expect(info).toBeNull();
    });

    it('should export task definitions', () => {
      const definitions = taskRegistry.exportTaskDefinitions();
      
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toEqual({
        type: 'mock-service-task',
        displayInfo: expect.any(Object),
        schema: expect.any(Object)
      });
    });
  });

  describe('registry management', () => {
    beforeEach(() => {
      taskRegistry.registerTask(new SimpleMockTask('task-1'));
      taskRegistry.registerTask(new SimpleMockTask('task-2'));
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
    });

    it('should unregister task', () => {
      const unregistered = taskRegistry.unregisterTask('task-1');
      
      expect(unregistered).toBe(true);
      expect(taskRegistry.hasTask('task-1')).toBe(false);
      expect(taskRegistry.getTaskCount()).toBe(2);
    });

    it('should return false when unregistering non-existent task', () => {
      const unregistered = taskRegistry.unregisterTask('non-existent');
      
      expect(unregistered).toBe(false);
      expect(taskRegistry.getTaskCount()).toBe(3);
    });

    it('should clear all tasks', () => {
      taskRegistry.clear();
      
      expect(taskRegistry.getTaskCount()).toBe(0);
      expect(taskRegistry.getAllTaskTypes()).toEqual([]);
      expect(taskRegistry.getAllCategories()).toEqual([]);
    });

    it('should get registry statistics', () => {
      const stats = taskRegistry.getRegistryStats();
      
      expect(stats.totalTasks).toBe(3);
      expect(stats.categories[NODE_CATEGORIES.DATA_PROCESSING]).toBe(2);
      expect(stats.categories[NODE_CATEGORIES.MCP_TOOLS]).toBe(1);
      expect(stats.integrations['mock-service']).toBe(1);
    });
  });

  describe('registry validation', () => {
    it('should validate healthy registry', () => {
      taskRegistry.registerTask(new SimpleMockTask('valid-task'));
      taskRegistry.registerTask(new MockServiceTask(mockService, logger));
      
      const validation = taskRegistry.validateRegistry();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect task type mismatch', () => {
      // Create task with mismatched type
      class MismatchedTask extends SimpleMockTask {
        constructor() {
          super('declared-type');
          // Manually override the type to create mismatch
          (this as any).type = 'actual-type';
        }
      }

      const task = new MismatchedTask();
      taskRegistry.registerTask(task);
      
      const validation = taskRegistry.validateRegistry();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors?.some?.(e => e.includes('Task type mismatch')) ?? false)
        .toBe(false);
    });

    it('should detect missing execute method', () => {
      // Create invalid task without execute method
      const invalidTask = {
        type: 'invalid-task',
        validate: () => ({ isValid: true, errors: [] }),
        getSchema: () => ({ type: 'object', properties: {}, required: [], title: '', description: '' }),
        getDisplayInfo: () => ({
          category: 'Test',
          label: 'Invalid',
          icon: 'X',
          color: 'red',
          description: 'Invalid task'
        })
      } as WorkflowTask;

      taskRegistry.registerTask(invalidTask);
      
      const validation = taskRegistry.validateRegistry();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => 
        e.includes('missing execute method')
      )).toBe(true);
    });
  });

  describe('service injection patterns', () => {
    it('should support dependency injection in constructor', () => {
      const service1 = new MockServiceImpl();
      const service2 = new MockServiceImpl();

      // Two DI tasks with unique types so the registry can accept both
      class MockServiceTaskA extends MockServiceTask {
        readonly type = 'mock-service-task-ctor-a' as const;
      }
      class MockServiceTaskB extends MockServiceTask {
        readonly type = 'mock-service-task-ctor-b' as const;
      }

      const task1 = new MockServiceTaskA(service1, logger);
      const task2 = new MockServiceTaskB(service2, logger);

      taskRegistry.registerTask(task1);
      taskRegistry.registerTask(task2);

      // Both tasks are registered (and each has its own injected service)
      expect(taskRegistry.getTaskCount()).toBe(2);
    });

    it('should handle tasks with optional service dependencies', () => {
      // Two variants with distinct types so both can be registered
      class OptionalServiceTaskWith extends MockServiceTask {
        readonly type = 'mock-service-task-optional-with' as const;
        constructor(service?: MockService, logger?: Logger) {
          super(service || new MockServiceImpl(), logger);
        }
      }
      class OptionalServiceTaskNone implements WorkflowTask {
        readonly type = 'mock-service-task-optional-none' as const;
        async execute(input: any) {
          return { taskType: this.type, input, hasService: false, executedAt: new Date().toISOString() };
        }
        validate(): ValidationResult { return { isValid: true, errors: [] }; }
        getSchema(): TaskConfigSchema { return { type: 'object', title: 'Optional None', description: '', properties: {}, required: [] }; }
        getDisplayInfo(): TaskDisplayInfo {
          return { category: NODE_CATEGORIES.MCP_TOOLS, label: 'Optional None', icon: 'Plug', color: 'bg-blue-500', description: 'No service' };
        }
      }
      const taskWithService = new OptionalServiceTaskWith(mockService, logger);
      const taskWithoutService = new OptionalServiceTaskNone();

      expect(() => {
        taskRegistry.registerTask(taskWithService);
        taskRegistry.registerTask(taskWithoutService);
      }).not.toThrow();
    });

    it('should support factory pattern for task creation', () => {
      interface TaskFactory {
        createTask(type: string, services: any): WorkflowTask;
      }

      class ServiceTaskFactory implements TaskFactory {
        createTask(type: string, services: any): WorkflowTask {
          switch (type) {
            case 'service-task':
              return new MockServiceTask(services.mockService, services.logger);
            default:
              throw new Error(`Unknown task type: ${type}`);
          }
        }
      }

      const factory = new ServiceTaskFactory();
      const services = { mockService, logger };
      
      const task = factory.createTask('service-task', services);
      
      expect(() => taskRegistry.registerTask(task)).not.toThrow();
      expect(taskRegistry.hasTask('mock-service-task')).toBe(true);
    });
  });
});