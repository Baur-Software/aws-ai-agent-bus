import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import EventsHandler from '../mcp/handlers/events.js';
import KVHandler from '../mcp/handlers/kv.js';

/**
 * Task Delegation System
 * Bridges MCP server with .claude/agents system
 * Delegates tasks to Claude Code agents via Task tool pattern
 */
export class TaskDelegation {

  /**
   * Delegate a task to a specific Claude Code agent
   * This mimics how Claude Code's Task tool works internally
   */
  static async delegateTask({
    agentType,
    taskDescription,
    prompt,
    userId,
    sessionId,
    context = {}
  }) {
    if (!agentType || !taskDescription || !prompt) {
      throw new Error('agentType, taskDescription, and prompt are required');
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Load agent configuration
    const agentConfig = await this.loadAgentConfig(agentType);
    if (!agentConfig) {
      throw new Error(`Agent type '${agentType}' not found in .claude/agents/`);
    }

    // Create task execution record
    const task = {
      id: taskId,
      agentType,
      taskDescription,
      prompt,
      userId,
      sessionId,
      status: 'initiated',
      agentConfig,
      context,
      createdAt: new Date().toISOString()
    };

    // Store task record
    await KVHandler.set({
      key: `task:${taskId}`,
      value: JSON.stringify(task),
      ttl_hours: 24
    });

    // Publish task delegation event
    await EventsHandler.send({
      detailType: 'Task.Delegated',
      detail: {
        taskId,
        agentType,
        userId,
        sessionId,
        description: taskDescription
      },
      source: 'task-delegation'
    });

    try {
      // Execute task through agent
      const result = await this.executeAgentTask(task);

      // Update task with results
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date().toISOString();

      await KVHandler.set({
        key: `task:${taskId}`,
        value: JSON.stringify(task),
        ttl_hours: 72
      });

      // Publish completion event
      await EventsHandler.send({
        detailType: 'Task.Completed',
        detail: {
          taskId,
          agentType,
          userId,
          sessionId,
          success: result.success,
          summary: result.summary
        },
        source: 'task-delegation'
      });

      return {
        taskId,
        success: true,
        result
      };

    } catch (error) {
      // Update task with error
      task.status = 'failed';
      task.error = error.message;
      task.failedAt = new Date().toISOString();

      await KVHandler.set({
        key: `task:${taskId}`,
        value: JSON.stringify(task),
        ttl_hours: 72
      });

      // Publish failure event
      await EventsHandler.send({
        detailType: 'Task.Failed',
        detail: {
          taskId,
          agentType,
          userId,
          sessionId,
          error: error.message
        },
        source: 'task-delegation'
      });

      throw error;
    }
  }

  /**
   * Load agent configuration from .claude/agents directory
   */
  static async loadAgentConfig(agentType) {
    const agentPath = path.join(process.cwd(), '.claude', 'agents', `${agentType}.md`);

    try {
      const content = await fs.readFile(agentPath, 'utf-8');
      return this.parseAgentConfig(content);
    } catch (error) {
      // Try looking in subdirectories
      const subdirs = ['universal', 'specialized', 'specialized/integrations'];

      for (const subdir of subdirs) {
        try {
          const subdirPath = path.join(process.cwd(), '.claude', 'agents', subdir, `${agentType}.md`);
          const content = await fs.readFile(subdirPath, 'utf-8');
          return this.parseAgentConfig(content);
        } catch (e) {
          // Continue searching
        }
      }

      return null;
    }
  }

  /**
   * Parse agent configuration from markdown frontmatter
   */
  static parseAgentConfig(content) {
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      return { content }; // No frontmatter, just return content
    }

    const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line === '---');
    if (frontmatterEnd === -1) {
      return { content };
    }

    const frontmatter = lines.slice(1, frontmatterEnd).join('\n');
    const body = lines.slice(frontmatterEnd + 1).join('\n');

    // Parse YAML-like frontmatter (simplified)
    const config = { content: body };

    frontmatter.split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;

        // Handle different value types
        if (value.startsWith('[') && value.endsWith(']')) {
          // Array
          config[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else if (value.startsWith('"') && value.endsWith('"')) {
          // String
          config[key] = value.slice(1, -1);
        } else {
          // Raw value
          config[key] = value;
        }
      }
    });

    return config;
  }

  /**
   * Execute task through the Claude Code agent system
   * This is where we bridge to the actual agent execution
   */
  static async executeAgentTask(task) {
    const { agentType, prompt, agentConfig, context } = task;

    // For now, simulate agent execution based on agent type
    // In a full implementation, this would invoke Claude Code's agent system

    switch (agentType) {
      case 'conductor':
        return await this.executeConductorTask(prompt, agentConfig, context);

      case 'critic':
        return await this.executeCriticTask(prompt, agentConfig, context);

      case 'terraform-infrastructure-expert':
        return await this.executeTerraformTask(prompt, agentConfig, context);

      case 'google-analytics-expert':
        return await this.executeGoogleAnalyticsTask(prompt, agentConfig, context);

      default:
        return await this.executeGenericTask(prompt, agentConfig, context);
    }
  }

  /**
   * Execute Conductor agent task
   * Implements goal-driven planning and delegation
   */
  static async executeConductorTask(prompt, config, context) {
    // Parse the request and create a plan
    const plan = {
      goal: prompt,
      phase: this.determinePhase(prompt),
      lane: this.determineLane(prompt),
      subtasks: this.decomposeTask(prompt),
      timeline: this.estimateTimeline(prompt),
      requiredApprovals: this.requiresApproval(prompt)
    };

    // Store plan for tracking
    await KVHandler.set({
      key: `conductor-plan:${Date.now()}`,
      value: JSON.stringify(plan),
      ttl_hours: 168
    });

    return {
      success: true,
      agentType: 'conductor',
      summary: `Created execution plan with ${plan.subtasks.length} subtasks in ${plan.phase} phase`,
      plan,
      nextSteps: plan.requiredApprovals ?
        ['Submit to Critic for approval'] :
        ['Proceed with subtask execution']
    };
  }

  /**
   * Execute Critic agent task
   * Implements safety validation and approval gating
   */
  static async executeCriticTask(prompt, config, context) {
    // Analyze the plan/request for safety
    const analysis = {
      safetyLevel: this.assessSafety(prompt),
      riskFactors: this.identifyRisks(prompt),
      blastRadius: this.assessBlastRadius(prompt),
      recommendation: null
    };

    // Make approval decision
    const approved = analysis.safetyLevel !== 'high-risk' &&
                    analysis.riskFactors.length === 0;

    analysis.recommendation = approved ? 'APPROVED' : 'REQUIRES_MODIFICATION';

    return {
      success: true,
      agentType: 'critic',
      summary: `Safety analysis complete: ${analysis.recommendation}`,
      analysis,
      approved,
      modifications: approved ? [] : this.suggestModifications(analysis)
    };
  }

  /**
   * Execute infrastructure task
   */
  static async executeTerraformTask(prompt, config, context) {
    return {
      success: true,
      agentType: 'terraform-infrastructure-expert',
      summary: 'Infrastructure analysis completed',
      recommendations: ['Review terraform plans', 'Validate resource costs'],
      estimatedCost: '$15-25/month'
    };
  }

  /**
   * Execute Google Analytics task
   */
  static async executeGoogleAnalyticsTask(prompt, config, context) {
    return {
      success: true,
      agentType: 'google-analytics-expert',
      summary: 'Analytics analysis completed',
      insights: ['Traffic patterns analyzed', 'Performance metrics reviewed'],
      reportGenerated: true
    };
  }

  /**
   * Execute generic task for unknown agent types
   */
  static async executeGenericTask(prompt, config, context) {
    return {
      success: true,
      agentType: 'generic',
      summary: 'Task completed successfully',
      output: `Processed request: ${prompt.substring(0, 100)}...`
    };
  }

  // Helper methods for task analysis

  static determinePhase(prompt) {
    const destructiveKeywords = ['delete', 'destroy', 'remove'];
    const modifyKeywords = ['update', 'modify', 'change'];

    if (destructiveKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
      return 'execute';
    }
    if (modifyKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
      return 'dry_run';
    }
    return 'read_only';
  }

  static determineLane(prompt) {
    return this.determinePhase(prompt); // Same logic for now
  }

  static decomposeTask(prompt) {
    // Simple task decomposition
    const sentences = prompt.split('.').filter(s => s.trim().length > 0);
    return sentences.map((sentence, index) => ({
      id: index + 1,
      description: sentence.trim(),
      estimated_duration: '15-30 minutes'
    }));
  }

  static estimateTimeline(prompt) {
    const wordCount = prompt.split(' ').length;
    const complexity = wordCount > 50 ? 'high' : wordCount > 20 ? 'medium' : 'low';

    return {
      complexity,
      estimatedDuration: complexity === 'high' ? '2-4 hours' :
                        complexity === 'medium' ? '30-60 minutes' : '15-30 minutes'
    };
  }

  static requiresApproval(prompt) {
    const highRiskKeywords = ['production', 'delete', 'destroy', 'payment'];
    return highRiskKeywords.some(kw => prompt.toLowerCase().includes(kw));
  }

  static assessSafety(prompt) {
    const highRiskKeywords = ['delete', 'destroy', 'production'];
    const mediumRiskKeywords = ['modify', 'update', 'change'];

    if (highRiskKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
      return 'high-risk';
    }
    if (mediumRiskKeywords.some(kw => prompt.toLowerCase().includes(kw))) {
      return 'medium-risk';
    }
    return 'low-risk';
  }

  static identifyRisks(prompt) {
    const risks = [];

    if (prompt.toLowerCase().includes('production')) {
      risks.push('production_environment');
    }
    if (prompt.toLowerCase().includes('delete')) {
      risks.push('data_loss');
    }
    if (prompt.toLowerCase().includes('payment')) {
      risks.push('financial_impact');
    }

    return risks;
  }

  static assessBlastRadius(prompt) {
    if (prompt.toLowerCase().includes('production')) return 'high';
    if (prompt.toLowerCase().includes('staging')) return 'medium';
    return 'low';
  }

  static suggestModifications(analysis) {
    const modifications = [];

    if (analysis.riskFactors.includes('production_environment')) {
      modifications.push('Test in staging environment first');
    }
    if (analysis.riskFactors.includes('data_loss')) {
      modifications.push('Create backup before proceeding');
    }
    if (analysis.riskFactors.includes('financial_impact')) {
      modifications.push('Get budget approval before proceeding');
    }

    return modifications;
  }

  /**
   * Get task status
   */
  static async getTaskStatus(taskId) {
    const result = await KVHandler.get({ key: `task:${taskId}` });
    return result.value ? JSON.parse(result.value) : null;
  }

  /**
   * List available agents
   */
  static async listAvailableAgents() {
    const agentsDir = path.join(process.cwd(), '.claude', 'agents');

    try {
      const files = await fs.readdir(agentsDir, { recursive: true });
      const agents = files
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', '').replace(/\//g, '-'));

      return agents;
    } catch (error) {
      return [];
    }
  }

  /**
   * Assess request complexity
   */
  static assessComplexity(request) {
    const words = request.toLowerCase().split(/\s+/);
    const complexWords = ['deploy', 'configure', 'monitoring', 'infrastructure', 'multiple', 'environment'];
    const simpleWords = ['get', 'show', 'list', 'view', 'simple'];

    const complexCount = words.filter(word => complexWords.some(cw => word.includes(cw))).length;
    const simpleCount = words.filter(word => simpleWords.some(sw => word.includes(sw))).length;
    const wordCount = words.length;

    if (complexCount > 1 || wordCount > 15) {
      return 'high';
    } else if (complexCount > 0 || wordCount > 8) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Identify domain from request
   */
  static identifyDomain(request) {
    const lowerRequest = request.toLowerCase();

    if (lowerRequest.includes('terraform') || lowerRequest.includes('infrastructure') || lowerRequest.includes('deploy')) {
      return 'infrastructure';
    } else if (lowerRequest.includes('analytics') || lowerRequest.includes('report') || lowerRequest.includes('metrics')) {
      return 'analytics';
    } else if (lowerRequest.includes('frontend') || lowerRequest.includes('ui') || lowerRequest.includes('component')) {
      return 'frontend';
    } else if (lowerRequest.includes('backend') || lowerRequest.includes('api') || lowerRequest.includes('database')) {
      return 'backend';
    } else if (lowerRequest.includes('security') || lowerRequest.includes('auth') || lowerRequest.includes('permission')) {
      return 'security';
    } else {
      return 'general';
    }
  }
}

export default TaskDelegation;