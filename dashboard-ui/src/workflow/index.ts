// Modular Workflow System Index
// Main export point for the new workflow architecture

// Core system exports
export { ModularWorkflowEngine } from './WorkflowEngine';
export { TaskRegistry, createTaskRegistry } from './TaskRegistry';

// Type exports
export * from './types';

// Task implementations
export * from './tasks';

// Service integrations
export * from '../services';

// Complete workflow system factory
import { ModularWorkflowEngine } from './WorkflowEngine';
import { TaskRegistry, createTaskRegistry } from './TaskRegistry';
import { registerAllTasks } from './tasks';
import { ServiceContainer, createServiceContainer } from '../services';
import { Logger, EventEmitter } from './types';

export interface WorkflowSystemConfig {
  // Service configuration
  mcpClient?: any;
  httpTimeout?: number;
  httpRetries?: number;

  // Logging configuration
  logger?: Logger;

  // Event handling
  eventEmitter?: EventEmitter;

  // Task filtering (for conditional registration)
  enabledCategories?: string[];
  disabledTasks?: string[];
}

export interface WorkflowSystem {
  engine: ModularWorkflowEngine;
  taskRegistry: TaskRegistry;
  services: ServiceContainer;
}

/**
 * Creates a complete workflow system with all components configured
 */
export function createWorkflowSystem(config: WorkflowSystemConfig): WorkflowSystem {
  // Create service container
  const services = createServiceContainer({
    mcpClient: config.mcpClient,
    httpTimeout: config.httpTimeout,
    httpRetries: config.httpRetries
  });

  // Create task registry
  const taskRegistry = createTaskRegistry();

  // Register all available tasks
  registerAllTasks(taskRegistry, {
    http: services.http,
    logger: config.logger
  });

  // Filter tasks if specified
  if (config.disabledTasks) {
    config.disabledTasks.forEach(taskType => {
      taskRegistry.unregisterTask(taskType);
    });
  }

  // Create workflow engine
  const engine = new ModularWorkflowEngine(
    taskRegistry,
    config.logger || createDefaultLogger(),
    config.eventEmitter || createDefaultEventEmitter()
  );

  console.log('✅ Workflow system initialized with:');
  console.log(`   - ${taskRegistry.getTaskCount()} registered tasks`);
  console.log(`   - ${taskRegistry.getAllCategories().length} task categories`);
  console.log(`   - ${Object.keys(services).length} service integrations`);

  return {
    engine,
    taskRegistry,
    services
  };
}

// Default implementations for logger and event emitter
function createDefaultLogger(): Logger {
  return {
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
    info: (message: string, ...args: any[]) => console.info(`[INFO] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
    error: (message: string, error?: any, ...args: any[]) => {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  };
}

function createDefaultEventEmitter(): EventEmitter {
  const listeners = new Map<string, Set<(data: any) => void>>();

  return {
    emit: (event: string, data: any) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Event handler error for '${event}':`, error);
          }
        });
      }
    },

    on: (event: string, handler: (data: any) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    },

    off: (event: string, handler: (data: any) => void) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(handler);
        if (eventListeners.size === 0) {
          listeners.delete(event);
        }
      }
    }
  };
}

/**
 * Create an EventEmitter that publishes to EventBridge via dashboard-server
 * @param sendMessage - Dashboard server sendMessage function from useDashboardServer()
 * @returns EventEmitter that publishes to EventBridge + local listeners
 */
export function createDashboardEventEmitter(sendMessage: (msg: any) => void): EventEmitter {
  const baseEmitter = createDefaultEventEmitter();

  return {
    emit: (event: string, data: any) => {
      // Emit to local listeners first
      baseEmitter.emit(event, data);

      // Publish to EventBridge via dashboard-server
      try {
        sendMessage({
          type: 'publish_event',
          event: {
            detailType: event,
            source: 'workflow-engine',
            detail: {
              ...data,
              timestamp: new Date().toISOString()
            }
          }
        });
      } catch (error) {
        console.error('Failed to publish workflow event to EventBridge:', error);
      }
    },

    on: baseEmitter.on,
    off: baseEmitter.off
  };
}

/**
 * Migration helper to replace the old WorkflowEngine
 */
export function replaceOldWorkflowEngine(
  oldEngine: any,
  config: WorkflowSystemConfig
): WorkflowSystem {
  console.log('🔄 Migrating from old WorkflowEngine to modular system...');
  
  const newSystem = createWorkflowSystem(config);
  
  // Copy any execution history if available
  if (oldEngine.getExecutionHistory) {
    const oldHistory = oldEngine.getExecutionHistory();
    console.log(`📋 Found ${oldHistory.length} executions in old engine history`);
    
    // Note: In a real migration, you might want to convert old history format
    // to the new format and store it in the new engine
  }

  console.log('✅ Migration to modular workflow system complete!');
  console.log('🗑️  You can now remove the old WorkflowEngine.ts file');
  
  return newSystem;
}

// Utility functions for common operations
export function getTasksByIntegration(
  taskRegistry: TaskRegistry,
  integrationKey: string
): string[] {
  return taskRegistry.getTasksRequiringIntegration(integrationKey)
    .map(task => task.type);
}

export function validateWorkflowCompatibility(
  workflow: any,
  taskRegistry: TaskRegistry
): { isCompatible: boolean; missingTasks: string[]; errors: string[] } {
  const missingTasks: string[] = [];
  const errors: string[] = [];

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push('Workflow must have a nodes array');
    return { isCompatible: false, missingTasks, errors };
  }

  // Check if all node types are available
  workflow.nodes.forEach((node: any) => {
    if (!node.type) {
      errors.push(`Node ${node.id || 'unknown'} missing type`);
      return;
    }

    if (!taskRegistry.hasTask(node.type)) {
      missingTasks.push(node.type);
    }
  });

  const isCompatible = errors.length === 0 && missingTasks.length === 0;

  return {
    isCompatible,
    missingTasks: [...new Set(missingTasks)], // Remove duplicates
    errors
  };
}

// Export commonly used constants and utilities
export { WORKFLOW_EVENTS, NODE_CATEGORIES, INTEGRATION_KEYS } from './types';