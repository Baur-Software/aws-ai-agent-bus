// Task Implementations Index
// Centralized exports for all workflow task implementations

// Core task imports
export { TriggerTask } from './core/TriggerTask';
export { OutputTask } from './core/OutputTask';
export { PersonTask } from './core/PersonTask';

// Google Analytics tasks
export { GATopPagesTask } from './analytics/GATopPagesTask';
export { GASearchDataTask } from './analytics/GASearchDataTask';
export { GAOpportunitiesTask } from './analytics/GAOpportunitiesTask';
export { GACalendarTask } from './analytics/GACalendarTask';

// MCP tasks
export { KVGetTask } from './mcp/KVGetTask';
export { KVSetTask } from './mcp/KVSetTask';
export { ArtifactsListTask } from './mcp/ArtifactsListTask';
export { ArtifactsGetTask } from './mcp/ArtifactsGetTask';
export { ArtifactsPutTask } from './mcp/ArtifactsPutTask';
export { EventsSendTask } from './mcp/EventsSendTask';

// Trello tasks
export { TrelloCreateCardTask } from './trello/TrelloCreateCardTask';
export { TrelloCreateBoardTask } from './trello/TrelloCreateBoardTask';

// HTTP tasks
export { HTTPGetTask } from './http/HTTPGetTask';

// Data processing tasks
export { JSONParseTask } from './data/JSONParseTask';

// Agent tasks
export { AgentConductorTask } from './agents/AgentConductorTask';

// HubSpot tasks
export { HubSpotContactTask } from './hubspot/HubSpotContactTask';
export { HubSpotEmailTask } from './hubspot/HubSpotEmailTask';

// Task registration helper
import { TaskRegistry } from '../TaskRegistry';
import {
  TriggerTask, OutputTask, PersonTask,
  GATopPagesTask, GASearchDataTask, GAOpportunitiesTask, GACalendarTask,
  KVGetTask, KVSetTask, ArtifactsListTask, ArtifactsGetTask, ArtifactsPutTask, EventsSendTask,
  TrelloCreateCardTask, TrelloCreateBoardTask,
  HTTPGetTask,
  JSONParseTask,
  AgentConductorTask,
  HubSpotContactTask, HubSpotEmailTask
} from './index';

export function registerAllTasks(
  taskRegistry: TaskRegistry,
  services: {
    googleAnalytics?: any;
    trello?: any;
    mcp?: any;
    http?: any;
    auth?: any;
    notification?: any;
    hubspot?: any;
    logger?: any;
  }
): void {
  const { googleAnalytics, trello, mcp, http, auth, notification, hubspot, logger } = services;

  // Core tasks
  taskRegistry.registerTask(new TriggerTask(logger));
  taskRegistry.registerTask(new OutputTask(logger));
  taskRegistry.registerTask(new PersonTask(auth, notification, logger));

  // Google Analytics tasks (if service available)
  if (googleAnalytics) {
    taskRegistry.registerTask(new GATopPagesTask(googleAnalytics, logger));
    taskRegistry.registerTask(new GASearchDataTask(googleAnalytics, logger));
    taskRegistry.registerTask(new GAOpportunitiesTask(googleAnalytics, logger));
    taskRegistry.registerTask(new GACalendarTask(googleAnalytics, logger));
  }

  // MCP tasks (if service available)
  if (mcp) {
    taskRegistry.registerTask(new KVGetTask(mcp, logger));
    taskRegistry.registerTask(new KVSetTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsListTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsGetTask(mcp, logger));
    taskRegistry.registerTask(new ArtifactsPutTask(mcp, logger));
    taskRegistry.registerTask(new EventsSendTask(mcp, logger));
  }

  // Trello tasks (if service available)
  if (trello) {
    taskRegistry.registerTask(new TrelloCreateCardTask(trello, logger));
    taskRegistry.registerTask(new TrelloCreateBoardTask(trello, logger));
  }

  // HTTP tasks (if service available)
  if (http) {
    taskRegistry.registerTask(new HTTPGetTask(http, logger));
  }

  // Data processing tasks (no external dependencies)
  taskRegistry.registerTask(new JSONParseTask(logger));

  // Agent tasks (no external dependencies - simulated for now)
  taskRegistry.registerTask(new AgentConductorTask(logger));

  // HubSpot tasks (if service available)
  if (hubspot) {
    taskRegistry.registerTask(new HubSpotContactTask(hubspot, logger));
    taskRegistry.registerTask(new HubSpotEmailTask(hubspot, logger));
  }

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
    id: 'analytics',
    name: 'Analytics',
    description: 'Google Analytics and search console integration',
    icon: 'BarChart3',
    tasks: ['ga-top-pages', 'ga-search-data', 'ga-opportunities', 'ga-calendar']
  },
  {
    id: 'mcp',
    name: 'MCP Tools',
    description: 'AWS services via Model Context Protocol',
    icon: 'Database',
    tasks: ['kv-get', 'kv-set', 'artifacts-list', 'artifacts-get', 'artifacts-put', 'events-send']
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Project management and task tracking',
    icon: 'Trello',
    tasks: ['trello-create-card', 'trello-create-board', 'trello-get-boards', 'trello-add-to-list']
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
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing automation with HubSpot',
    icon: 'Users',
    tasks: ['hubspot-contact', 'hubspot-email']
  }
];