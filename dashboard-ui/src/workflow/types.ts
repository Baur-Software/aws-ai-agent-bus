// Core Workflow System Types
// Defines all interfaces and types for the modular workflow engine

export interface WorkflowTask<TInput = any, TOutput = any> {
  readonly type: string;
  execute(input: TInput, context: WorkflowContext): Promise<TOutput>;
  validate?(input: TInput): ValidationResult;
  getSchema?(): TaskConfigSchema;
  getDisplayInfo?(): TaskDisplayInfo;
}

export interface WorkflowContext {
  executionId: string;
  nodeId: string;
  workflowId: string;
  logger: Logger;
  eventEmitter: EventEmitter;
  data: Record<string, any>;
  results: Record<string, any>;
  errors: WorkflowError[];
  metadata: WorkflowMetadata;
  
  // Helper methods
  getPreviousResult(nodeId?: string): any;
  storeResult(result: any): void;
  addError(error: WorkflowError): void;
  emit(event: string, data: any): void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SchemaObject {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: any;
  items?: SchemaProperty;
  examples?: any[];
  description?: string;
}

export interface TaskConfigSchema {
  input?: SchemaObject;
  output?: SchemaObject;
  type?: string;  // Legacy support
  properties?: Record<string, SchemaProperty>;  // Legacy support
  required?: string[];  // Legacy support
  title?: string;
  description?: string;
  examples?: any[];
}

export interface SchemaProperty {
  type: string;  // Accept any JSON Schema type string
  title?: string;
  description?: string;
  placeholder?: string;
  pattern?: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: SchemaProperty | { type: string };
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: SchemaProperty | { type: string } | any;
  examples?: any[];
}

export interface TaskDisplayInfo {
  category: string;
  name?: string;  // Used by tasks
  label?: string;  // Legacy support
  icon?: string;
  color?: string;
  description?: string;
  tags?: string[];
  integrationRequired?: string;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: any, ...args: any[]): void;
}

export interface EventEmitter {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

// Workflow definition types (matches existing JSON structure)
export interface WorkflowDefinition {
  version: string;
  created: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  metadata: WorkflowMetadata;
}

export interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
  config?: Record<string, any>;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  fromOutput: string;
  toInput: string;
}

export interface WorkflowMetadata {
  author?: string;
  tags?: string[];
  schedule?: string;
  estimatedDuration?: string;
  version?: string;
  [key: string]: any;
}

// Execution types
export interface WorkflowResult {
  executionId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'running' | 'cancelled';
  results: Record<string, any>;
  errors: WorkflowError[];
  duration: number;
  nodesExecuted: number;
  startTime: string;
  endTime?: string;
  metadata: WorkflowMetadata;
}

export interface WorkflowError {
  nodeId?: string;
  nodeType?: string;
  message: string;
  code?: string;
  timestamp: string;
  details?: any;
  stack?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: string;
  status: 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: WorkflowError;
  duration: number;
  timestamp: string;
}

// Task registry and execution context
export interface TaskRegistry {
  registerTask(task: WorkflowTask): void;
  getTask(type: string): WorkflowTask | undefined;
  getAllTaskTypes(): string[];
  hasTask(type: string): boolean;
  getTasksByCategory(category: string): WorkflowTask[];
  getTasksRequiringIntegration(integration: string): WorkflowTask[];
}

export interface ExecutionEngine {
  executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResult>;
  cancelExecution(executionId: string): Promise<void>;
  getExecutionStatus(executionId: string): Promise<WorkflowResult | null>;
  getExecutionHistory(limit?: number): Promise<WorkflowResult[]>;
}

// Error classes
export class WorkflowEngineError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkflowEngineError';
  }
}

export class TaskExecutionError extends WorkflowEngineError {
  constructor(
    message: string,
    public taskType: string,
    public nodeId: string,
    public input?: any
  ) {
    super(message, 'TASK_EXECUTION_ERROR', { taskType, nodeId, input });
    this.name = 'TaskExecutionError';
  }
}

export class ValidationError extends WorkflowEngineError {
  constructor(
    message: string,
    public validationErrors: string[]
  ) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}

export class WorkflowValidationError extends WorkflowEngineError {
  constructor(
    message: string,
    public workflowId: string,
    public validationErrors: string[]
  ) {
    super(message, 'WORKFLOW_VALIDATION_ERROR', { workflowId, validationErrors });
    this.name = 'WorkflowValidationError';
  }
}

// Utility types
export type TaskInputType<T extends WorkflowTask> = T extends WorkflowTask<infer I, any> ? I : any;
export type TaskOutputType<T extends WorkflowTask> = T extends WorkflowTask<any, infer O> ? O : any;

// Constants for common values
export const WORKFLOW_EVENTS = {
  STARTED: 'workflow.started',
  NODE_STARTED: 'workflow.node.started',
  NODE_COMPLETED: 'workflow.node.completed',
  NODE_FAILED: 'workflow.node.failed',
  COMPLETED: 'workflow.completed',
  FAILED: 'workflow.failed',
  CANCELLED: 'workflow.cancelled'
} as const;

export const NODE_CATEGORIES = {
  CORE: 'Core',
  INPUT_OUTPUT: 'Input/Output',
  MCP_TOOLS: 'MCP Tools',
  ANALYTICS: 'Analytics',
  AWS_SERVICES: 'AWS Services',
  INTEGRATIONS: 'Integrations',
  INTEGRATION: 'Integration',
  AGENTS: 'Agent System',
  DATA: 'Data Processing',
  DATA_PROCESSING: 'Data Processing',
  HTTP: 'HTTP/API',
  HTTP_API: 'HTTP/API',
  TASK_MANAGEMENT: 'Task Management'
} as const;

export const INTEGRATION_KEYS = {
  GOOGLE_ANALYTICS: 'integration-google-analytics',
  GOOGLE_SEARCH_CONSOLE: 'integration-google-search-console',
  TRELLO: 'integration-trello',
  SLACK: 'integration-slack',
  GITHUB: 'integration-github',
  STRIPE: 'integration-stripe',
  HUBSPOT: 'integration-hubspot'
} as const;