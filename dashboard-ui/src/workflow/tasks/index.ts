// Task Implementations Index
// Centralized exports for all workflow task implementations

// Core task imports
export { TriggerTask } from './core/TriggerTask';
export { OutputTask } from './core/OutputTask';
export { PersonTask } from './core/PersonTask';

// HTTP tasks
export { HTTPGetTask } from './http/HTTPGetTask';

// Data processing tasks
export { JSONParseTask } from './data/JSONParseTask';

// Agent tasks
export { AgentConductorTask } from './agents/AgentConductorTask';

// Task registration helper
import { TaskRegistry } from '../TaskRegistry';
import {
  TriggerTask, OutputTask, PersonTask,
  HTTPGetTask,
  JSONParseTask,
  AgentConductorTask
} from './index';

export function registerAllTasks(
  taskRegistry: TaskRegistry,
  services: {
    http?: any;
    auth?: any;
    notification?: any;
    logger?: any;
  }
): void {
  const { http, auth, notification, logger } = services;

  // Core tasks
  taskRegistry.registerTask(new TriggerTask(logger));
  taskRegistry.registerTask(new OutputTask(logger));
  taskRegistry.registerTask(new PersonTask(auth, notification, logger));

  // HTTP tasks (if service available)
  if (http) {
    taskRegistry.registerTask(new HTTPGetTask(http, logger));
  }

  // Data processing tasks (no external dependencies)
  taskRegistry.registerTask(new JSONParseTask(logger));

  // Agent tasks (no external dependencies - simulated for now)
  taskRegistry.registerTask(new AgentConductorTask(logger));

  console.log(`Registered ${taskRegistry.getTaskCount()} workflow tasks`);
}

// Task category definitions for UI
export const TASK_CATEGORIES = [
  {
    id: 'core',
    name: 'Core',
    description: 'Essential workflow control tasks',
    icon: 'Zap',
    tasks: ['trigger', 'output', 'person']
  },
  {
    id: 'http',
    name: 'HTTP/API',
    description: 'REST API and web service integration',
    icon: 'Globe',
    tasks: ['http-get', 'http-post', 'http-put', 'http-delete']
  },
  {
    id: 'data',
    name: 'Data Processing',
    description: 'Transform and manipulate data',
    icon: 'Funnel',
    tasks: ['json-parse', 'json-stringify', 'filter', 'condition']
  },
  {
    id: 'agents',
    name: 'AI Agents',
    description: 'Intelligent agents for complex task automation',
    icon: 'Bot',
    tasks: ['agent-conductor', 'agent-critic', 'agent-frontend', 'agent-backend']
  }
];