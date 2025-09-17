import EventsHandler from './events.js';
import KVHandler from './kv.js';
import ArtifactsHandler from './artifacts.js';
import TaskDelegation from '../../claude/task-delegation.js';

/**
 * Agent Delegation Handler
 * Delegates requests to existing .claude/agents instead of reimplementing logic
 * Acts as coordination layer between MCP and Claude Code agent system
 */
export class AgentDelegationHandler {

  /**
   * Process a chat request through the agent governance layer
   * Implements: Chat Input → Agent Routing → Context → Events → Results
   * Delegates to existing .claude/agents instead of reimplementing logic
   */
  static async processRequest({ userId, sessionId, request, context = {} }) {
    if (!userId || !sessionId || !request) {
      throw new Error('userId, sessionId, and request are required');
    }

    const requestId = `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Step 1: Delegate to Conductor Agent for planning
    const conductorTask = await TaskDelegation.delegateTask({
      agentType: 'conductor',
      taskDescription: 'Analyze request and create execution plan',
      prompt: `Please analyze this request and create an execution plan: "${request}"

      Context: ${JSON.stringify(context, null, 2)}

      Please provide:
      1. Task decomposition
      2. Required agents
      3. Execution lane (read_only/dry_run/execute)
      4. Risk assessment
      5. Required approvals`,
      userId,
      sessionId,
      context
    });

    if (!conductorTask.success) {
      throw new Error(`Conductor planning failed: ${conductorTask.error}`);
    }

    const plan = conductorTask.result.plan;

    // Step 2: If high risk, delegate to Critic Agent for validation
    if (plan.requiredApprovals) {
      const criticTask = await TaskDelegation.delegateTask({
        agentType: 'critic',
        taskDescription: 'Validate execution plan for safety and compliance',
        prompt: `Please review this execution plan for safety and compliance:

        Original Request: "${request}"
        Execution Plan: ${JSON.stringify(plan, null, 2)}

        Please provide:
        1. Safety assessment
        2. Risk analysis
        3. Approval recommendation
        4. Required modifications (if any)`,
        userId,
        sessionId,
        context: { ...context, plan }
      });

      if (!criticTask.success) {
        throw new Error(`Critic validation failed: ${criticTask.error}`);
      }

      if (!criticTask.result.approved) {
        return {
          success: false,
          requestId,
          reason: 'Critic rejected execution plan',
          criticAnalysis: criticTask.result.analysis,
          requiredModifications: criticTask.result.modifications
        };
      }
    }

    // Step 3: Execute subtasks through appropriate specialist agents
    const execution = {
      id: `execution-${Date.now()}`,
      requestId,
      plan,
      tasks: [],
      status: 'running',
      startedAt: new Date().toISOString()
    };

    for (const subtask of plan.subtasks) {
      const agentType = this.selectAgentForTask(subtask);

      try {
        const specialistTask = await TaskDelegation.delegateTask({
          agentType,
          taskDescription: subtask.description,
          prompt: `Execute this subtask: ${subtask.description}

          Original Request: "${request}"
          Subtask Context: ${JSON.stringify(subtask, null, 2)}
          Overall Context: ${JSON.stringify(context, null, 2)}`,
          userId,
          sessionId,
          context: { ...context, subtask, plan }
        });

        execution.tasks.push({
          subtaskId: subtask.id,
          agentType,
          taskId: specialistTask.taskId,
          success: specialistTask.success,
          result: specialistTask.result
        });

      } catch (error) {
        execution.tasks.push({
          subtaskId: subtask.id,
          agentType,
          success: false,
          error: error.message
        });
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();

    // Step 4: Store results and publish events
    const results = await this.storeAndPublish({ userId, sessionId, execution, context });

    return {
      success: true,
      requestId,
      planId: plan.id || conductorTask.taskId,
      executionId: execution.id,
      results
    };
  }

  /**
   * Select appropriate specialist agent for a subtask
   */
  static selectAgentForTask(subtask) {
    const description = subtask.description.toLowerCase();

    // Map task content to appropriate specialist agents
    if (description.includes('terraform') || description.includes('infrastructure')) {
      return 'terraform-infrastructure-expert';
    }
    if (description.includes('analytics') || description.includes('google')) {
      return 'google-analytics-expert';
    }
    if (description.includes('aws') || description.includes('cloud')) {
      return 'aws-specialist';
    }
    if (description.includes('frontend') || description.includes('react')) {
      return 'react-component-architect';
    }
    if (description.includes('backend') || description.includes('api')) {
      return 'backend-developer';
    }

    // Default to general purpose agent
    return 'general-purpose';
  }

  /**
   * Store execution results and publish completion events
   */
  static async storeAndPublish({ userId, sessionId, execution, context }) {
    const resultId = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Aggregate all execution results
    const aggregatedResults = {
      id: resultId,
      executionId: execution.id,
      userId,
      sessionId,
      summary: this.summarizeExecution(execution),
      totalTasks: execution.tasks.length,
      successfulTasks: execution.tasks.filter(t => t.success).length,
      timestamp: new Date().toISOString()
    };

    // Store metadata in DynamoDB (fast access)
    await KVHandler.set({
      key: `result:${resultId}`,
      value: JSON.stringify(aggregatedResults),
      ttl_hours: 168 // 1 week
    });

    // Store full execution in S3 (archival)
    await ArtifactsHandler.put({
      key: `executions/${userId}/${sessionId}/${resultId}.json`,
      content: JSON.stringify({
        ...aggregatedResults,
        fullExecution: execution
      }, null, 2),
      content_type: 'application/json'
    });

    // Publish completion event
    await EventsHandler.send({
      detailType: 'AgentDelegation.Completed',
      detail: {
        resultId,
        executionId: execution.id,
        userId,
        sessionId,
        summary: aggregatedResults.summary
      },
      source: 'agent-delegation'
    });

    return aggregatedResults;
  }

  /**
   * Summarize execution results
   */
  static summarizeExecution(execution) {
    const successful = execution.tasks.filter(t => t.success).length;
    const total = execution.tasks.length;

    return {
      overallSuccess: successful === total,
      successRate: total > 0 ? successful / total : 1,
      duration: execution.completedAt ?
        new Date(execution.completedAt) - new Date(execution.startedAt) : null,
      tasksCompleted: successful,
      totalTasks: total
    };
  }

  /**
   * List available agents from .claude/agents directory
   */
  static async listAvailableAgents() {
    return await TaskDelegation.listAvailableAgents();
  }

  /**
   * Get delegation task status
   */
  static async getTaskStatus(taskId) {
    return await TaskDelegation.getTaskStatus(taskId);
  }

  /**
   * Direct delegation to a specific agent (for simple cases)
   */
  static async delegateToAgent({ agentType, prompt, userId, sessionId, context = {} }) {
    return await TaskDelegation.delegateTask({
      agentType,
      taskDescription: `Direct delegation to ${agentType}`,
      prompt,
      userId,
      sessionId,
      context
    });
  }
}

export default AgentDelegationHandler;