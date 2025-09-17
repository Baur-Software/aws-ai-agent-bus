// Modular Workflow Engine
// Clean replacement for the monolithic 781-line WorkflowEngine

import {
  WorkflowDefinition,
  WorkflowResult,
  WorkflowNode,
  WorkflowConnection,
  WorkflowContext,
  WorkflowError,
  NodeExecutionResult,
  ExecutionEngine,
  TaskRegistry,
  Logger,
  EventEmitter,
  WorkflowEngineError,
  TaskExecutionError,
  ValidationError,
  WorkflowValidationError,
  WORKFLOW_EVENTS
} from './types';

export class ModularWorkflowEngine implements ExecutionEngine {
  private taskRegistry: TaskRegistry;
  private logger: Logger;
  private eventEmitter: EventEmitter;
  private executionHistory: Map<string, WorkflowResult> = new Map();
  private runningExecutions: Map<string, WorkflowExecution> = new Map();

  constructor(
    taskRegistry: TaskRegistry,
    logger: Logger,
    eventEmitter: EventEmitter
  ) {
    this.taskRegistry = taskRegistry;
    this.logger = logger;
    this.eventEmitter = eventEmitter;
  }

  async executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResult> {
    const executionId = this.generateExecutionId();
    const startTime = new Date().toISOString();
    
    this.logger.info(`Starting workflow execution: ${executionId} (${workflow.name})`);

    try {
      // Validate workflow before execution
      await this.validateWorkflow(workflow);

      // Create execution context
      const execution = new WorkflowExecution(
        executionId,
        workflow,
        this.logger,
        this.eventEmitter
      );

      this.runningExecutions.set(executionId, execution);

      // Emit start event
      this.eventEmitter.emit(WORKFLOW_EVENTS.STARTED, {
        executionId,
        workflowId: workflow.name,
        timestamp: startTime
      });

      // Execute the workflow
      const result = await this.executeNodes(execution);

      // Store in history
      this.executionHistory.set(executionId, result);
      this.runningExecutions.delete(executionId);

      this.logger.info(`Workflow execution completed: ${executionId}`);
      this.eventEmitter.emit(WORKFLOW_EVENTS.COMPLETED, {
        executionId,
        result
      });

      return result;

    } catch (error) {
      const workflowError = this.createWorkflowError(error);
      
      this.logger.error(`Workflow execution failed: ${executionId}`, workflowError);
      
      const failedResult: WorkflowResult = {
        executionId,
        workflowId: workflow.name,
        status: 'failed',
        results: {},
        errors: [workflowError],
        duration: Date.now() - new Date(startTime).getTime(),
        nodesExecuted: 0,
        startTime,
        endTime: new Date().toISOString(),
        metadata: workflow.metadata
      };

      this.executionHistory.set(executionId, failedResult);
      this.runningExecutions.delete(executionId);

      this.eventEmitter.emit(WORKFLOW_EVENTS.FAILED, {
        executionId,
        error: workflowError,
        result: failedResult
      });

      throw error;
    }
  }

  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) {
      throw new WorkflowEngineError(`Execution ${executionId} not found or not running`);
    }

    execution.cancel();
    this.runningExecutions.delete(executionId);

    this.logger.info(`Workflow execution cancelled: ${executionId}`);
    this.eventEmitter.emit(WORKFLOW_EVENTS.CANCELLED, { executionId });
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowResult | null> {
    // Check if it's currently running
    const runningExecution = this.runningExecutions.get(executionId);
    if (runningExecution) {
      return runningExecution.getCurrentStatus();
    }

    // Check execution history
    return this.executionHistory.get(executionId) || null;
  }

  async getExecutionHistory(limit: number = 50): Promise<WorkflowResult[]> {
    const results = Array.from(this.executionHistory.values());
    return results
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  private async validateWorkflow(workflow: WorkflowDefinition): Promise<void> {
    const errors: string[] = [];

    // Check for required fields
    if (!workflow.name) errors.push('Workflow name is required');
    if (!workflow.nodes || workflow.nodes.length === 0) errors.push('Workflow must have at least one node');

    // Check for trigger node
    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }
    if (triggerNodes.length > 1) {
      errors.push('Workflow can only have one trigger node');
    }

    // Validate node types exist
    for (const node of workflow.nodes) {
      if (!this.taskRegistry.hasTask(node.type)) {
        errors.push(`Unknown task type: ${node.type} (node: ${node.id})`);
      }
    }

    // Validate connections
    if (workflow.connections) {
      for (const conn of workflow.connections) {
        const fromNode = workflow.nodes.find(n => n.id === conn.from);
        const toNode = workflow.nodes.find(n => n.id === conn.to);
        
        if (!fromNode) errors.push(`Connection references unknown source node: ${conn.from}`);
        if (!toNode) errors.push(`Connection references unknown target node: ${conn.to}`);
      }
    }

    // Check for cycles
    if (this.hasCycles(workflow.nodes, workflow.connections || [])) {
      errors.push('Workflow contains circular dependencies');
    }

    if (errors.length > 0) {
      throw new WorkflowValidationError(
        `Workflow validation failed: ${errors.join(', ')}`,
        workflow.name,
        errors
      );
    }
  }

  private async executeNodes(execution: WorkflowExecution): Promise<WorkflowResult> {
    const { workflow } = execution;
    const { nodes, connections } = workflow;
    
    // Build execution order using topological sort
    const executionOrder = this.getTopologicalOrder(nodes, connections || []);
    
    let nodesExecuted = 0;
    const nodeResults: Record<string, NodeExecutionResult> = {};

    for (const nodeId of executionOrder) {
      if (execution.isCancelled()) {
        break;
      }

      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      try {
        const result = await this.executeNode(node, execution);
        nodeResults[nodeId] = result;
        
        if (result.status === 'completed') {
          nodesExecuted++;
        }
        
      } catch (error) {
        const nodeError = this.createNodeError(error, node);
        nodeResults[nodeId] = {
          nodeId: node.id,
          nodeType: node.type,
          status: 'failed',
          error: nodeError,
          duration: 0,
          timestamp: new Date().toISOString()
        };
        
        // Continue execution even if a node fails (unless critical)
        execution.addError(nodeError);
      }
    }

    return {
      executionId: execution.id,
      workflowId: workflow.name,
      status: execution.isCancelled() ? 'cancelled' : (execution.hasErrors() ? 'failed' : 'completed'),
      results: execution.getAllResults(),
      errors: execution.getErrors(),
      duration: execution.getDuration(),
      nodesExecuted,
      startTime: execution.startTime,
      endTime: new Date().toISOString(),
      metadata: workflow.metadata
    };
  }

  private async executeNode(node: WorkflowNode, execution: WorkflowExecution): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const task = this.taskRegistry.getTask(node.type);
    
    if (!task) {
      throw new TaskExecutionError(`Task type not found: ${node.type}`, node.type, node.id);
    }

    this.logger.info(`Executing node: ${node.type} (${node.id})`);
    this.eventEmitter.emit(WORKFLOW_EVENTS.NODE_STARTED, {
      executionId: execution.id,
      nodeId: node.id,
      nodeType: node.type
    });

    try {
      const context = execution.createNodeContext(node.id);
      
      // Validate input if validation is available
      if (task.validate && node.config) {
        const validation = task.validate(node.config);
        if (!validation.isValid) {
          throw new ValidationError(
            `Node validation failed: ${validation.errors.join(', ')}`,
            validation.errors
          );
        }
      }

      // Execute the task
      const result = await task.execute(node.config || {}, context);
      
      // Store result in execution context
      execution.storeNodeResult(node.id, result);
      
      const nodeResult: NodeExecutionResult = {
        nodeId: node.id,
        nodeType: node.type,
        status: 'completed',
        result,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      this.logger.info(`Node execution completed: ${node.type} (${node.id})`);
      this.eventEmitter.emit(WORKFLOW_EVENTS.NODE_COMPLETED, {
        executionId: execution.id,
        nodeId: node.id,
        nodeType: node.type,
        result: nodeResult
      });

      return nodeResult;

    } catch (error) {
      const nodeError = this.createNodeError(error, node);
      
      this.logger.error(`Node execution failed: ${node.type} (${node.id})`, nodeError);
      this.eventEmitter.emit(WORKFLOW_EVENTS.NODE_FAILED, {
        executionId: execution.id,
        nodeId: node.id,
        nodeType: node.type,
        error: nodeError
      });

      throw error;
    }
  }

  private getTopologicalOrder(nodes: WorkflowNode[], connections: WorkflowConnection[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize graph
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    // Build adjacency list and calculate in-degrees
    connections.forEach(conn => {
      graph.get(conn.from)?.push(conn.to);
      inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
    });

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    // Start with nodes that have no dependencies
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = graph.get(current) || [];
      neighbors.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for cycles
    if (result.length !== nodes.length) {
      throw new WorkflowEngineError('Circular dependency detected in workflow');
    }

    return result;
  }

  private hasCycles(nodes: WorkflowNode[], connections: WorkflowConnection[]): boolean {
    try {
      this.getTopologicalOrder(nodes, connections);
      return false;
    } catch (error) {
      return true;
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createWorkflowError(error: any): WorkflowError {
    return {
      message: error.message || 'Unknown workflow error',
      code: error.code || 'WORKFLOW_ERROR',
      timestamp: new Date().toISOString(),
      details: error.details || error,
      stack: error.stack
    };
  }

  private createNodeError(error: any, node: WorkflowNode): WorkflowError {
    return {
      nodeId: node.id,
      nodeType: node.type,
      message: error.message || 'Unknown node error',
      code: error.code || 'NODE_EXECUTION_ERROR',
      timestamp: new Date().toISOString(),
      details: error.details || error,
      stack: error.stack
    };
  }
}

// Execution context implementation
class WorkflowExecution {
  public readonly id: string;
  public readonly workflow: WorkflowDefinition;
  public readonly startTime: string;
  private logger: Logger;
  private eventEmitter: EventEmitter;
  private results: Map<string, any> = new Map();
  private errors: WorkflowError[] = [];
  private cancelled: boolean = false;

  constructor(
    executionId: string,
    workflow: WorkflowDefinition,
    logger: Logger,
    eventEmitter: EventEmitter
  ) {
    this.id = executionId;
    this.workflow = workflow;
    this.startTime = new Date().toISOString();
    this.logger = logger;
    this.eventEmitter = eventEmitter;
  }

  createNodeContext(nodeId: string): WorkflowContext {
    return new WorkflowContextImpl(
      this.id,
      nodeId,
      this.workflow.name,
      this.logger,
      this.eventEmitter,
      this.results,
      this.errors,
      this.workflow.metadata
    );
  }

  storeNodeResult(nodeId: string, result: any): void {
    this.results.set(nodeId, result);
  }

  getAllResults(): Record<string, any> {
    return Object.fromEntries(this.results.entries());
  }

  addError(error: WorkflowError): void {
    this.errors.push(error);
  }

  getErrors(): WorkflowError[] {
    return [...this.errors];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getDuration(): number {
    return Date.now() - new Date(this.startTime).getTime();
  }

  getCurrentStatus(): WorkflowResult {
    return {
      executionId: this.id,
      workflowId: this.workflow.name,
      status: 'running',
      results: this.getAllResults(),
      errors: this.getErrors(),
      duration: this.getDuration(),
      nodesExecuted: this.results.size,
      startTime: this.startTime,
      metadata: this.workflow.metadata
    };
  }
}

// Context implementation
class WorkflowContextImpl implements WorkflowContext {
  public readonly executionId: string;
  public readonly nodeId: string;
  public readonly workflowId: string;
  public readonly logger: Logger;
  public readonly eventEmitter: EventEmitter;
  public readonly data: Record<string, any> = {};
  public readonly results: Record<string, any>;
  public readonly errors: WorkflowError[];
  public readonly metadata: any;

  constructor(
    executionId: string,
    nodeId: string,
    workflowId: string,
    logger: Logger,
    eventEmitter: EventEmitter,
    results: Map<string, any>,
    errors: WorkflowError[],
    metadata: any
  ) {
    this.executionId = executionId;
    this.nodeId = nodeId;
    this.workflowId = workflowId;
    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.results = Object.fromEntries(results.entries());
    this.errors = errors;
    this.metadata = metadata;
  }

  getPreviousResult(nodeId?: string): any {
    if (nodeId) {
      return this.results[nodeId];
    }
    
    // Return the most recent result
    const resultEntries = Object.entries(this.results);
    if (resultEntries.length === 0) return null;
    
    return resultEntries[resultEntries.length - 1][1];
  }

  storeResult(result: any): void {
    this.data.previousResult = result;
  }

  addError(error: WorkflowError): void {
    this.errors.push(error);
  }

  emit(event: string, data: any): void {
    this.eventEmitter.emit(event, {
      executionId: this.executionId,
      nodeId: this.nodeId,
      workflowId: this.workflowId,
      ...data
    });
  }
}