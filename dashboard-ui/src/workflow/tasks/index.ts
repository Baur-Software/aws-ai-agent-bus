// Task Implementations Index
// Centralized exports for all workflow task implementations

// Core task imports
export { TriggerTask } from './core/TriggerTask';
export { OutputTask } from './core/OutputTask';
export { PersonTask } from './core/PersonTask';

// HTTP tasks
export { HTTPGetTask } from './http/HTTPGetTask';
export { HTTPPostTask } from './http/HTTPPostTask';
export { HTTPPutTask } from './http/HTTPPutTask';
export { HTTPDeleteTask } from './http/HTTPDeleteTask';

// Data processing tasks
export { JSONParseTask } from './data/JSONParseTask';
export { JSONStringifyTask } from './data/JSONStringifyTask';
export { MergeTask } from './data/MergeTask';
export { TransformTask } from './data/TransformTask';
export { MapTask } from './data/MapTask';
export { ReduceTask } from './data/ReduceTask';
export { SplitTask } from './data/SplitTask';
export { JoinTask } from './data/JoinTask';
export { GroupByTask } from './data/GroupByTask';
export { FlattenTask } from './data/FlattenTask';
export { TemplateTask } from './data/TemplateTask';
export { ValidateTask } from './data/ValidateTask';

// Event tasks
export { EventsSendTask } from './events/EventsSendTask';
export { EventsQueryTask } from './events/EventsQueryTask';
export { EventsAnalyticsTask } from './events/EventsAnalyticsTask';
export { EventsCreateRuleTask } from './events/EventsCreateRuleTask';
export { EventsCreateAlertTask } from './events/EventsCreateAlertTask';
export { EventsHealthCheckTask } from './events/EventsHealthCheckTask';

// Output tasks
export { WebhookTask } from './output/WebhookTask';
export { EmailTask } from './output/EmailTask';

// Logic tasks
export { ConditionalTask } from './logic/ConditionalTask';
export { SwitchTask } from './logic/SwitchTask';
export { LoopTask } from './logic/LoopTask';
export { FilterTask } from './logic/FilterTask';
export { DelayTask } from './logic/DelayTask';
export { ParallelTask } from './logic/ParallelTask';
export { RetryTask } from './logic/RetryTask';

// Storage tasks
export { KVGetTask } from './storage/KVGetTask';
export { KVSetTask } from './storage/KVSetTask';
export { ArtifactsGetTask } from './storage/ArtifactsGetTask';
export { ArtifactsPutTask } from './storage/ArtifactsPutTask';
export { ArtifactsListTask } from './storage/ArtifactsListTask';
export { CacheTask } from './storage/CacheTask';

// Agent tasks
export { AgentConductorTask } from './agents/AgentConductorTask';

// Task registration helper
import { TaskRegistry } from '../TaskRegistry';
import {
  TriggerTask, OutputTask, PersonTask,
  HTTPGetTask, HTTPPostTask, HTTPPutTask, HTTPDeleteTask,
  JSONParseTask, JSONStringifyTask, MergeTask, TransformTask, MapTask, ReduceTask, SplitTask, JoinTask, GroupByTask, FlattenTask, TemplateTask, ValidateTask,
  EventsSendTask, EventsQueryTask, EventsAnalyticsTask, EventsCreateRuleTask, EventsCreateAlertTask, EventsHealthCheckTask,
  WebhookTask, EmailTask,
  ConditionalTask, SwitchTask, LoopTask, FilterTask, DelayTask, ParallelTask, RetryTask,
  KVGetTask, KVSetTask, ArtifactsGetTask, ArtifactsPutTask, ArtifactsListTask, CacheTask,
  AgentConductorTask
} from './index';

export function registerAllTasks(
  taskRegistry: TaskRegistry,
  services: {
    http?: any;
    auth?: any;
    notification?: any;
    kvStore?: any;
    eventsService?: any;
    artifactsService?: any;
    logger?: any;
  }
): void {
  const { http, auth, notification, kvStore, eventsService, artifactsService, logger } = services;

  // Core tasks
  taskRegistry.registerTask(new TriggerTask(logger));
  taskRegistry.registerTask(new OutputTask(logger));
  taskRegistry.registerTask(new PersonTask(auth, notification, logger));

  // HTTP tasks (if service available)
  if (http) {
    taskRegistry.registerTask(new HTTPGetTask(http, logger));
    taskRegistry.registerTask(new HTTPPostTask(http, logger));
    taskRegistry.registerTask(new HTTPPutTask(http, logger));
    taskRegistry.registerTask(new HTTPDeleteTask(http, logger));
  }

  // Data processing tasks (no external dependencies)
  taskRegistry.registerTask(new JSONParseTask(logger));
  taskRegistry.registerTask(new JSONStringifyTask(logger));
  taskRegistry.registerTask(new MergeTask(logger));
  taskRegistry.registerTask(new TransformTask(logger));
  taskRegistry.registerTask(new MapTask(logger));
  taskRegistry.registerTask(new ReduceTask(logger));
  taskRegistry.registerTask(new SplitTask(logger));
  taskRegistry.registerTask(new JoinTask(logger));
  taskRegistry.registerTask(new GroupByTask(logger));
  taskRegistry.registerTask(new FlattenTask(logger));
  taskRegistry.registerTask(new TemplateTask(logger));
  taskRegistry.registerTask(new ValidateTask(logger));

  // Event tasks (if events service available)
  if (eventsService) {
    taskRegistry.registerTask(new EventsSendTask(eventsService, logger));
    taskRegistry.registerTask(new EventsQueryTask(eventsService, logger));
    taskRegistry.registerTask(new EventsAnalyticsTask(eventsService, logger));
    taskRegistry.registerTask(new EventsCreateRuleTask(eventsService, logger));
    taskRegistry.registerTask(new EventsCreateAlertTask(eventsService, logger));
    taskRegistry.registerTask(new EventsHealthCheckTask(eventsService, logger));
  }

  // Output tasks
  if (http) {
    taskRegistry.registerTask(new WebhookTask(http, logger));
  }
  if (notification) {
    taskRegistry.registerTask(new EmailTask(notification, logger));
  }

  // Logic tasks
  taskRegistry.registerTask(new ConditionalTask(logger));
  taskRegistry.registerTask(new SwitchTask(logger));
  taskRegistry.registerTask(new LoopTask(logger));
  taskRegistry.registerTask(new FilterTask(logger));
  taskRegistry.registerTask(new DelayTask(logger));
  taskRegistry.registerTask(new ParallelTask(logger));
  taskRegistry.registerTask(new RetryTask(logger));

  // Storage tasks
  if (kvStore) {
    taskRegistry.registerTask(new KVGetTask(kvStore, logger));
    taskRegistry.registerTask(new KVSetTask(kvStore, logger));
    taskRegistry.registerTask(new CacheTask(kvStore, logger));
  }

  if (artifactsService) {
    taskRegistry.registerTask(new ArtifactsGetTask(artifactsService, logger));
    taskRegistry.registerTask(new ArtifactsPutTask(artifactsService, logger));
    taskRegistry.registerTask(new ArtifactsListTask(artifactsService, logger));
  }

  // Agent tasks (no external dependencies - simulated for now)
  taskRegistry.registerTask(new AgentConductorTask(logger));

  console.log(`✅ Registered ${taskRegistry.getTaskCount()} workflow tasks`);
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