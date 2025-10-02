// Task Implementations Index
// Centralized exports for all workflow task implementations

// Core task imports
export { TriggerTask } from './core/TriggerTask';
export { OutputTask } from './core/OutputTask';
export { PersonTask } from './core/PersonTask';

// MCP tasks
export { KVGetTask } from './mcp/KVGetTask';
export { KVSetTask } from './mcp/KVSetTask';
export { ArtifactsListTask } from './mcp/ArtifactsListTask';
export { ArtifactsGetTask } from './mcp/ArtifactsGetTask';
export { ArtifactsPutTask } from './mcp/ArtifactsPutTask';
export { EventsSendTask } from './mcp/EventsSendTask';

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
  KVGetTask, KVSetTask, ArtifactsListTask, ArtifactsGetTask, ArtifactsPutTask, EventsSendTask,
  HTTPGetTask,
  JSONParseTask,
  AgentConductorTask
} from './index';

export function registerAllTasks(
  taskRegistry: TaskRegistry,
  services: {
    mcp?: any;
    http?: any;
    auth?: any;
    notification?: any;
    logger?: any;
  }
): void {
  const { mcp, http, auth, notification, logger } = services;

  // Core tasks
  taskRegistry.registerTask(new TriggerTask(logger));
  taskRegistry.registerTask(new OutputTask(logger));
  taskRegistry.registerTask(new PersonTask(auth, notification, logger));

  // MCP tasks (if service available)
  if (mcp) {
    taskRegistry.registerTask(new KVGetTask(mcp, logger));
    taskRegistry.registerTask(new KVSetTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsListTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsGetTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsPutTask(mcp, logger));
    taskRegistry.registerTask(new EventsSendTask(mcp, logger));
  }


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
    id: 'mcp',
    name: 'MCP Tools',
    description: 'AWS services via Model Context Protocol',
    icon: 'Database',
    tasks: ['kv-get', 'kv-set', 'artifacts-list', 'artifacts-get', 'artifacts-put', 'events-send']
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