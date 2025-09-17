import { jest } from '@jest/globals';

// Mock filesystem operations for agent config loading
const mockReadFile = jest.fn();
const mockReaddir = jest.fn();

jest.mock('fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
}));

// Mock other handlers
const mockEventsSend = jest.fn();

jest.mock('../../src/modules/mcp/handlers/events.js', () => ({
  default: {
    send: mockEventsSend,
  },
}));


// Import after mocking
const AgentDelegationHandler = (await import('../../src/modules/mcp/handlers/agent-delegation.js')).default;
const TaskDelegation = (await import('../../src/modules/claude/task-delegation.js')).default;

describe('TaskDelegation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should load agent config from .claude/agents', async () => {
    const mockAgentConfig = `---
name: TestAgent
role: "Test agent for unit testing"
capabilities:
  - test_execution
  - mock_responses
tools: [git, shell]
---

# Test Agent

This is a test agent configuration.`;

    mockReadFile.mockResolvedValue(mockAgentConfig);

    const config = await TaskDelegation.loadAgentConfig('test-agent');

    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('.claude/agents/test-agent.md'),
      'utf-8'
    );
    expect(config.name).toBe('TestAgent');
    expect(config.role).toBe('"Test agent for unit testing"');
    expect(config.content).toContain('This is a test agent configuration.');
  });

  test('should parse agent config frontmatter correctly', () => {
    const content = `---
name: Conductor
role: "Goal-driven planner"
capabilities: [planning, delegation]
tools: [git, shell, terraform]
---

# Conductor Agent

Agent implementation details.`;

    const config = TaskDelegation.parseAgentConfig(content);

    expect(config.name).toBe('Conductor');
    expect(config.role).toBe('Goal-driven planner'); // Fixed: quotes are stripped
    expect(config.capabilities).toEqual(['planning', 'delegation']);
    expect(config.tools).toEqual(['git', 'shell', 'terraform']);
    expect(config.content).toContain('# Conductor Agent');
  });

  test('should delegate task to conductor agent', async () => {
    // Mock the readFile to return valid agent config
    mockReadFile.mockResolvedValueOnce(`---
name: Conductor
role: "Goal-driven planner"
---
# Conductor Agent`);

    mockKVSet.mockResolvedValue({ success: true });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });

    const result = await TaskDelegation.delegateTask({
      agentType: 'conductor',
      taskDescription: 'Plan deployment strategy',
      prompt: 'Create a plan for deploying the new feature',
      userId: 'user-123',
      sessionId: 'session-456',
      context: { environment: 'staging' }
    });

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
    expect(result.result.agentType).toBe('conductor');
    expect(mockKVSet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^task-/),
        value: expect.any(String),
        ttl_hours: 24
      })
    );
    expect(mockEventsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detailType: 'Task.Delegated',
        source: 'task-delegation'
      })
    );
  });

  test('should execute conductor task with proper analysis', async () => {
    const result = await TaskDelegation.executeConductorTask(
      'Deploy new analytics dashboard to production',
      { name: 'Conductor' },
      { environment: 'production' }
    );

    expect(result.success).toBe(true);
    expect(result.agentType).toBe('conductor');
    expect(result.plan).toBeDefined();
    expect(result.plan.phase).toBe('execute'); // Should be high phase for production
    expect(result.plan.subtasks).toBeDefined();
    expect(result.plan.requiredApprovals).toBe(true); // Production should require approval
  });

  test('should execute critic task with safety validation', async () => {
    const result = await TaskDelegation.executeCriticTask(
      'Review plan to delete old database tables',
      { name: 'Critic' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.agentType).toBe('critic');
    expect(result.analysis).toBeDefined();
    expect(result.approved).toBe(false); // Should reject destructive operations
    expect(result.analysis.safetyLevel).toBe('high-risk');
    expect(result.modifications).toContain('Create backup before proceeding');
  });

  test('should determine correct execution phase', () => {
    expect(TaskDelegation.determinePhase('List all users')).toBe('read_only');
    expect(TaskDelegation.determinePhase('Update user preferences')).toBe('dry_run');
    expect(TaskDelegation.determinePhase('Delete production database')).toBe('execute');
  });

  test('should assess request complexity correctly', () => {
    expect(TaskDelegation.assessComplexity('Simple task')).toBe('low');
    expect(TaskDelegation.assessComplexity('Deploy the application and then configure monitoring')).toBe('high');
    expect(TaskDelegation.assessComplexity('Update configuration in staging environment')).toBe('medium');
  });

  test('should identify domain correctly', () => {
    expect(TaskDelegation.identifyDomain('Deploy infrastructure with terraform')).toBe('infrastructure');
    expect(TaskDelegation.identifyDomain('Generate analytics report')).toBe('analytics');
    expect(TaskDelegation.identifyDomain('Fix bug in authentication code')).toBe('development');
    expect(TaskDelegation.identifyDomain('General task')).toBe('general');
  });

  test('should get task status', async () => {
    const mockTask = {
      id: 'task-123',
      status: 'completed',
      result: { success: true }
    };

    mockKVGet.mockResolvedValue({ value: JSON.stringify(mockTask) });

    const result = await TaskDelegation.getTaskStatus('task-123');

    expect(result.id).toBe('task-123');
    expect(result.status).toBe('completed');
    expect(mockKVGet).toHaveBeenCalledWith({ key: 'task:task-123' });
  });

  test('should list available agents', async () => {
    mockReaddir.mockResolvedValue([
      'conductor.md',
      'critic.md',
      'terraform-expert.md',
      'universal'
    ]);

    const agents = await TaskDelegation.listAvailableAgents();

    expect(agents).toContain('conductor');
    expect(agents).toContain('critic');
    expect(agents).toContain('terraform-expert');
    expect(agents).not.toContain('universal'); // Should filter out directories
  });
});

describe('AgentDelegationHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process request through full agent governance flow', async () => {
    // Mock agent config loading
    mockReadFile.mockResolvedValue(`---
name: Conductor
---
# Test Agent`);

    // Mock KV operations
    mockKVSet.mockResolvedValue({ success: true });
    mockKVGet.mockResolvedValue({ value: null });

    // Mock events
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });

    // Mock artifacts
    mockArtifactsPut.mockResolvedValue({ success: true });

    const result = await AgentDelegationHandler.processRequest({
      userId: 'user-123',
      sessionId: 'session-456',
      request: 'Analyze website performance metrics',
      context: { source: 'dashboard' }
    });

    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(result.planId).toBeDefined();
    expect(result.executionId).toBeDefined();
    expect(result.results).toBeDefined();

    // Verify events were published
    expect(mockEventsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detailType: 'Task.Delegated',
        source: 'task-delegation'
      })
    );

    expect(mockEventsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detailType: 'AgentDelegation.Completed',
        source: 'agent-delegation'
      })
    );
  });

  test('should reject request when critic disapproves', async () => {
    // Mock agent config
    mockReadFile.mockResolvedValue(`---
name: TestAgent
---
# Test`);

    // Mock storage operations
    mockKVSet.mockResolvedValue({ success: true });
    mockKVGet.mockResolvedValue({ value: null });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });

    const result = await AgentDelegationHandler.processRequest({
      userId: 'user-123',
      sessionId: 'session-456',
      request: 'Delete all production data permanently',
      context: {}
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Critic rejected execution plan');
    expect(result.criticAnalysis).toBeDefined();
    expect(result.requiredModifications).toBeDefined();
  });

  test('should select appropriate specialist agent', () => {
    expect(AgentDelegationHandler.selectAgentForTask({
      description: 'Deploy terraform infrastructure'
    })).toBe('terraform-infrastructure-expert');

    expect(AgentDelegationHandler.selectAgentForTask({
      description: 'Generate google analytics report'
    })).toBe('google-analytics-expert');

    expect(AgentDelegationHandler.selectAgentForTask({
      description: 'Build react frontend component'
    })).toBe('react-component-architect');

    expect(AgentDelegationHandler.selectAgentForTask({
      description: 'Generic task'
    })).toBe('general-purpose');
  });

  test('should store and publish execution results', async () => {
    const mockExecution = {
      id: 'execution-123',
      tasks: [
        { success: true, agentType: 'conductor' },
        { success: true, agentType: 'specialist' },
        { success: false, agentType: 'critic', error: 'Validation failed' }
      ],
      startedAt: '2023-01-01T00:00:00Z',
      completedAt: '2023-01-01T00:05:00Z'
    };

    mockKVSet.mockResolvedValue({ success: true });
    mockArtifactsPut.mockResolvedValue({ success: true });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });

    const result = await AgentDelegationHandler.storeAndPublish({
      userId: 'user-123',
      sessionId: 'session-456',
      execution: mockExecution,
      context: {}
    });

    expect(result.id).toBeDefined();
    expect(result.executionId).toBe('execution-123');
    expect(result.totalTasks).toBe(3);
    expect(result.successfulTasks).toBe(2);
    expect(result.summary.overallSuccess).toBe(false);
    expect(result.summary.successRate).toBe(2/3);

    // Verify storage operations
    expect(mockKVSet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^result-/),
        ttl_hours: 168
      })
    );

    expect(mockArtifactsPut).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^executions\//),
        content_type: 'application/json'
      })
    );

    expect(mockEventsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detailType: 'AgentDelegation.Completed',
        source: 'agent-delegation'
      })
    );
  });

  test('should delegate directly to specific agent', async () => {
    mockReadFile.mockResolvedValue(`---
name: TestAgent
---
# Test Agent`);
    mockKVSet.mockResolvedValue({ success: true });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });

    const result = await AgentDelegationHandler.delegateToAgent({
      agentType: 'terraform-infrastructure-expert',
      prompt: 'Review terraform configuration',
      userId: 'user-123',
      sessionId: 'session-456',
      context: { environment: 'staging' }
    });

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
    expect(result.result).toBeDefined();
  });

  test('should handle missing parameters gracefully', async () => {
    await expect(AgentDelegationHandler.processRequest({}))
      .rejects.toThrow('userId, sessionId, and request are required');

    await expect(AgentDelegationHandler.delegateToAgent({
      agentType: 'test',
      userId: 'user-123'
    })).rejects.toThrow('agentType, taskDescription, and prompt are required');
  });

  test('should summarize execution results correctly', () => {
    const execution = {
      tasks: [
        { success: true },
        { success: true },
        { success: false }
      ],
      startedAt: '2023-01-01T00:00:00Z',
      completedAt: '2023-01-01T00:05:00Z'
    };

    const summary = AgentDelegationHandler.summarizeExecution(execution);

    expect(summary.overallSuccess).toBe(false);
    expect(summary.successRate).toBe(2/3);
    expect(summary.tasksCompleted).toBe(2);
    expect(summary.totalTasks).toBe(3);
    expect(summary.duration).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
  });
});

describe('Agent Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should integrate with existing KV, Events, and Artifacts handlers', async () => {
    // Mock successful operations
    mockReadFile.mockResolvedValue('---\nname: TestAgent\n---\n# Test');
    mockKVSet.mockResolvedValue({ success: true });
    mockKVGet.mockResolvedValue({ value: null });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });
    mockArtifactsPut.mockResolvedValue({ success: true });

    const result = await AgentDelegationHandler.processRequest({
      userId: 'user-123',
      sessionId: 'session-456',
      request: 'Test integration with existing handlers',
      context: {}
    });

    // Verify integration with KV handler
    expect(mockKVSet).toHaveBeenCalled();

    // Verify integration with Events handler
    expect(mockEventsSend).toHaveBeenCalled();

    // Verify integration with Artifacts handler
    expect(mockArtifactsPut).toHaveBeenCalled();

    expect(result.success).toBe(true);
  });

  test('should handle agent config loading errors gracefully', async () => {
    mockReadFile.mockRejectedValue(new Error('Agent config not found'));

    await expect(TaskDelegation.delegateTask({
      agentType: 'non-existent-agent',
      taskDescription: 'Test task',
      prompt: 'Test prompt',
      userId: 'user-123',
      sessionId: 'session-456'
    })).rejects.toThrow('Agent type \'non-existent-agent\' not found');
  });

  test('should maintain event-driven architecture', async () => {
    mockReadFile.mockResolvedValue('---\nname: TestAgent\n---\n# Test');
    mockKVSet.mockResolvedValue({ success: true });
    mockEventsSend.mockResolvedValue({ eventId: 'event-123' });
    mockArtifactsPut.mockResolvedValue({ success: true });

    await AgentDelegationHandler.processRequest({
      userId: 'user-123',
      sessionId: 'session-456',
      request: 'Test event publishing',
      context: {}
    });

    // Verify multiple events are published throughout the flow
    const eventCalls = mockEventsSend.mock.calls;

    // Should have events for: Task.Delegated, Task.Completed, AgentDelegation.Completed
    expect(eventCalls.length).toBeGreaterThanOrEqual(3);

    // Check for key event types
    const eventTypes = eventCalls.map(call => call[0].detailType);
    expect(eventTypes).toContain('Task.Delegated');
    expect(eventTypes).toContain('Task.Completed');
    expect(eventTypes).toContain('AgentDelegation.Completed');
  });
});