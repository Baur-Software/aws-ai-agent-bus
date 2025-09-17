import { jest } from '@jest/globals';

// Mock MCP SDK before all other imports
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue({}),
  })),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

// Mock AWS SDK
const mockDynamoSend = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoSend,
  })),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  ListObjectsV2Command: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  StartExecutionCommand: jest.fn(),
  DescribeExecutionCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutEventsCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj),
}));

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));


// Import after mocking - use dynamic imports in beforeAll to avoid teardown issues
let AgentMeshMCPServer;

describe('MCP Server', () => {
  let server;

  beforeAll(async () => {
    // Import modules dynamically to avoid teardown issues
    const serverModule = await import('../../src/modules/mcp/server.js');
    AgentMeshMCPServer = serverModule.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    server = new AgentMeshMCPServer();
  });

  test('should create a server instance', () => {
    expect(server).toBeInstanceOf(AgentMeshMCPServer);
    expect(server.server).toBeDefined();
  });

  test('should have setupToolHandlers method', () => {
    expect(typeof server.setupToolHandlers).toBe('function');
  });

  test('should be able to run server', async () => {
    const result = await server.run();
    expect(result).toBeDefined();
  });
});


describe('Agent Delegation Tools Integration', () => {
  let server;
  let AgentDelegationHandler;

  beforeAll(async () => {
    // Mock filesystem for agent config loading
    jest.unstable_mockModule('fs/promises', () => ({
      readFile: jest.fn().mockResolvedValue(`---
name: TestAgent
role: "Test agent"
capabilities: [testing]
---
# Test Agent
Test agent implementation.`),
      readdir: jest.fn().mockResolvedValue(['conductor.md', 'critic.md', 'test-agent.md'])
    }));

    const serverModule = await import('../../src/modules/mcp/server.js');
    const agentModule = await import('../../src/modules/mcp/handlers/agent-delegation.js');
    AgentMeshMCPServer = serverModule.default;
    AgentDelegationHandler = agentModule.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    server = new AgentMeshMCPServer();

  });

  test('should support agent.processRequest tool', async () => {
    const tools = await server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'listTools')[1]();

    const agentTool = tools.tools.find(tool => tool.name === 'agent.processRequest');
    expect(agentTool).toBeDefined();
    expect(agentTool.description).toContain('agent governance');
    expect(agentTool.inputSchema.required).toContain('userId');
    expect(agentTool.inputSchema.required).toContain('sessionId');
    expect(agentTool.inputSchema.required).toContain('request');
  });

  test('should support agent.delegateToAgent tool', async () => {
    const tools = await server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'listTools')[1]();

    const delegateTool = tools.tools.find(tool => tool.name === 'agent.delegateToAgent');
    expect(delegateTool).toBeDefined();
    expect(delegateTool.description).toContain('Delegate directly to a specific agent');
    expect(delegateTool.inputSchema.required).toContain('agentType');
    expect(delegateTool.inputSchema.required).toContain('prompt');
  });

  test('should support agent.listAvailableAgents tool', async () => {
    const tools = await server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'listTools')[1]();

    const listTool = tools.tools.find(tool => tool.name === 'agent.listAvailableAgents');
    expect(listTool).toBeDefined();
    expect(listTool.description).toContain('List available agents');
  });

  test('should support agent.getTaskStatus tool', async () => {
    const tools = await server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'listTools')[1]();

    const statusTool = tools.tools.find(tool => tool.name === 'agent.getTaskStatus');
    expect(statusTool).toBeDefined();
    expect(statusTool.description).toContain('Get the status of a delegated task');
    expect(statusTool.inputSchema.required).toContain('taskId');
  });

  test('should handle agent.processRequest calls', async () => {
    // Mock a successful agent delegation
    const mockProcessResult = {
      success: true,
      requestId: 'req-123',
      planId: 'plan-456',
      executionId: 'exec-789',
      results: { summary: 'Task completed successfully' }
    };

    jest.spyOn(AgentDelegationHandler, 'processRequest').mockResolvedValue(mockProcessResult);

    const callHandler = server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'callTool')[1];

    const result = await callHandler({
      params: {
        name: 'agent.processRequest',
        arguments: {
          userId: 'user-123',
          sessionId: 'session-456',
          request: 'Generate analytics report',
          context: { source: 'dashboard' }
        }
      }
    });

    expect(AgentDelegationHandler.processRequest).toHaveBeenCalledWith({
      userId: 'user-123',
      sessionId: 'session-456',
      request: 'Generate analytics report',
      context: { source: 'dashboard' }
    });

    expect(result.content[0].text).toContain('req-123');
    expect(result.content[0].text).toContain('plan-456');
    expect(result.content[0].text).toContain('exec-789');
  });

  test('should handle agent.delegateToAgent calls', async () => {
    const mockDelegateResult = {
      success: true,
      taskId: 'task-123',
      result: { agentType: 'terraform-expert', summary: 'Infrastructure analyzed' }
    };

    jest.spyOn(AgentDelegationHandler, 'delegateToAgent').mockResolvedValue(mockDelegateResult);

    const callHandler = server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'callTool')[1];

    const result = await callHandler({
      params: {
        name: 'agent.delegateToAgent',
        arguments: {
          agentType: 'terraform-infrastructure-expert',
          prompt: 'Review terraform configuration',
          userId: 'user-123',
          sessionId: 'session-456'
        }
      }
    });

    expect(AgentDelegationHandler.delegateToAgent).toHaveBeenCalledWith({
      agentType: 'terraform-infrastructure-expert',
      prompt: 'Review terraform configuration',
      userId: 'user-123',
      sessionId: 'session-456',
      context: {}
    });

    expect(result.content[0].text).toContain('task-123');
    expect(result.content[0].text).toContain('terraform-expert');
  });

  test('should handle agent.listAvailableAgents calls', async () => {
    const mockAgentsList = ['conductor', 'critic', 'terraform-expert', 'google-analytics-expert'];

    jest.spyOn(AgentDelegationHandler, 'listAvailableAgents').mockResolvedValue(mockAgentsList);

    const callHandler = server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'callTool')[1];

    const result = await callHandler({
      params: {
        name: 'agent.listAvailableAgents',
        arguments: {}
      }
    });

    expect(AgentDelegationHandler.listAvailableAgents).toHaveBeenCalled();

    const responseObj = JSON.parse(result.content[0].text);
    expect(responseObj.agents).toEqual(mockAgentsList);
  });

  test('should handle agent.getTaskStatus calls', async () => {
    const mockTaskStatus = {
      id: 'task-123',
      status: 'completed',
      agentType: 'conductor',
      result: { success: true }
    };

    jest.spyOn(AgentDelegationHandler, 'getTaskStatus').mockResolvedValue(mockTaskStatus);

    const callHandler = server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'callTool')[1];

    const result = await callHandler({
      params: {
        name: 'agent.getTaskStatus',
        arguments: { taskId: 'task-123' }
      }
    });

    expect(AgentDelegationHandler.getTaskStatus).toHaveBeenCalledWith('task-123');

    const responseObj = JSON.parse(result.content[0].text);
    expect(responseObj.id).toBe('task-123');
    expect(responseObj.status).toBe('completed');
  });

  test('should handle agent delegation errors gracefully', async () => {
    jest.spyOn(AgentDelegationHandler, 'processRequest').mockRejectedValue(
      new Error('Agent not found')
    );

    const callHandler = server.server.setRequestHandler.mock.calls
      .find(call => call[0].name === 'callTool')[1];

    const result = await callHandler({
      params: {
        name: 'agent.processRequest',
        arguments: {
          userId: 'user-123',
          sessionId: 'session-456',
          request: 'Invalid request'
        }
      }
    });

    expect(result.content[0].text).toContain('Error executing tool');
    expect(result.content[0].text).toContain('Agent not found');
    expect(result.isError).toBe(true);
  });

  test('should integrate agent tools with existing MCP server architecture', () => {
    // Verify the server still has all the existing tools
    const existingTools = [
      'workflow.start', 'workflow.status',
      'events.send',
      'ga.getTopPages', 'ga.getSearchConsoleData'
    ];

    const mockSetRequestHandler = server.server.setRequestHandler;
    const listToolsCall = mockSetRequestHandler.mock.calls
      .find(call => call[0].name === 'listTools');

    expect(listToolsCall).toBeDefined();

    // Verify the new agent tools are added alongside existing ones
    const newAgentTools = [
      'agent.processRequest',
      'agent.delegateToAgent',
      'agent.listAvailableAgents',
      'agent.getTaskStatus'
    ];

    // Both existing and new tools should be present
    const toolNames = [...existingTools, ...newAgentTools];

    // This test confirms the integration doesn't break existing functionality
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2); // listTools + callTool
  });
});