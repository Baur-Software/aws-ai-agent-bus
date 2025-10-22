import { Logger } from '../utils/Logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { MCPServiceRegistry } from './MCPServiceRegistry.js';
import { JWTPayload } from '../middleware/auth.js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime';

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: {
    organizationId?: string;
    userId: string;
    mcpContextId?: string;
    tools?: string[];
  };
  metadata?: any;
}

interface ChatSession {
  sessionId: string;
  userId: string;
  organizationId?: string;
  title: string;
  backend: 'bedrock' | 'ollama' | 'openai';
  model: string;
  systemPrompt?: string;
  context: {
    mcpContextId?: string;
    tools: string[];
    temperature: number;
    maxTokens: number;
  };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ChatBackendConfig {
  bedrock?: {
    region: string;
    modelId: string;
    anthropicVersion?: string;
  };
  ollama?: {
    endpoint: string;
    model: string;
  };
  openai?: {
    apiKey: string;
    model: string;
    baseURL?: string;
  };
}

interface ChatRequest {
  sessionId: string;
  message: string;
  userId: string;
  organizationId?: string;
  context?: {
    mcpContextId?: string;
    tools?: string[];
  };
}

interface ChatResponse {
  messageId: string;
  content: string;
  role: 'assistant';
  timestamp: string;
  context?: {
    toolsUsed?: string[];
    mcpCalls?: any[];
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export class ChatService {
  private logger: Logger;
  private sessions = new Map<string, ChatSession>();
  private bedrockClient: BedrockRuntimeClient;

  constructor(
    private dynamodb: DynamoDBClient,
    private eventBridge: EventBridgeClient,
    private mcpRegistry: MCPServiceRegistry,
    private config: ChatBackendConfig
  ) {
    this.logger = new Logger('ChatService');

    // Initialize Bedrock client with region from config or environment
    const region = this.config.bedrock?.region || process.env.AWS_REGION || 'us-west-2';
    this.bedrockClient = new BedrockRuntimeClient({ region });
    this.logger.info(`Initialized Bedrock client for region: ${region}`);
  }

  /**
   * Save session to KV store for persistence
   */
  private async saveSessionToKV(session: ChatSession): Promise<void> {
    try {
      const key = `chat-session-${session.userId}-${session.sessionId}`;
      await this.mcpRegistry.executeTool(
        'kv_set',
        {
          key,
          value: JSON.stringify(session),
          ttl_hours: 24 * 30 // 30 days
        },
        {
          userId: session.userId,
          email: '',
          name: '',
          organizationMemberships: [],
          personalNamespace: session.userId,
          organizationId: session.organizationId || 'default-org'
        } as JWTPayload,
        session.organizationId || 'default-org'
      );
    } catch (error) {
      this.logger.warn(`Failed to save session ${session.sessionId} to KV:`, error);
    }
  }

  /**
   * Load session from KV store
   */
  private async loadSessionFromKV(userId: string, sessionId: string, organizationId?: string): Promise<ChatSession | null> {
    try {
      const key = `chat-session-${userId}-${sessionId}`;
      const result = await this.mcpRegistry.executeTool(
        'kv_get',
        { key },
        {
          userId,
          email: '',
          name: '',
          organizationMemberships: [],
          personalNamespace: userId,
          organizationId: organizationId || 'default-org'
        } as JWTPayload,
        organizationId || 'default-org'
      );

      if (result && result.value) {
        const session = JSON.parse(result.value) as ChatSession;
        this.sessions.set(sessionId, session);
        return session;
      }
    } catch (error) {
      this.logger.warn(`Failed to load session ${sessionId} from KV:`, error);
    }
    return null;
  }

  /**
   * List user's chat sessions
   * TODO: Once kv_list is available in MCP, we can load from KV store
   * For now, returns in-memory sessions only
   */
  async listUserSessions(userId: string, organizationId?: string): Promise<ChatSession[]> {
    // Return in-memory sessions for this user
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    return userSessions;
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    title: string,
    backend: 'bedrock' | 'ollama' | 'openai' = 'bedrock',
    organizationId?: string,
    mcpContextId?: string
  ): Promise<ChatSession> {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: ChatSession = {
      sessionId,
      userId,
      organizationId,
      title,
      backend,
      model: this.getDefaultModel(backend),
      systemPrompt: await this.getDefaultSystemPrompt(organizationId, mcpContextId, userId),
      context: {
        mcpContextId,
        tools: await this.getAvailableTools(userId, organizationId, mcpContextId),
        temperature: 0.7,
        maxTokens: 4000
      },
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);

    // Persist to KV store
    await this.saveSessionToKV(session);

    this.logger.info(`Created chat session ${sessionId} for user ${userId} with backend ${backend}`);

    return session;
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    let session = this.sessions.get(request.sessionId);

    // Try loading from KV if not in memory
    if (!session) {
      session = await this.loadSessionFromKV(request.userId, request.sessionId, request.organizationId);
      if (!session) {
        throw new Error(`Chat session not found: ${request.sessionId}`);
      }
    }

    // Validate user access
    if (session.userId !== request.userId) {
      throw new Error('Access denied to chat session');
    }

    // Add user message to session
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: request.sessionId,
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
      context: {
        ...request.context,
        userId: request.userId,
        organizationId: request.organizationId
      }
    };

    session.messages.push(userMessage);

    try {
      // Generate AI response based on backend
      const response = await this.generateResponse(session, request);

      // Add assistant message to session
      const assistantMessage: ChatMessage = {
        id: response.messageId,
        sessionId: request.sessionId,
        role: 'assistant',
        content: response.content,
        timestamp: response.timestamp,
        context: {
          ...response.context,
          userId: request.userId,
          organizationId: request.organizationId
        },
        metadata: { usage: response.usage }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date().toISOString();

      // Update session in storage
      this.sessions.set(request.sessionId, session);

      // Persist to KV store
      await this.saveSessionToKV(session);

      // Emit chat event
      await this.emitChatEvent('message_sent', {
        sessionId: request.sessionId,
        userId: request.userId,
        organizationId: request.organizationId,
        messageCount: session.messages.length,
        backend: session.backend
      });

      return response;

    } catch (error) {
      this.logger.error(`Failed to generate response for session ${request.sessionId}:`, error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        sessionId: request.sessionId,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      session.messages.push(errorMessage);
      session.updatedAt = new Date().toISOString();
      this.sessions.set(request.sessionId, session);

      throw error;
    }
  }

  /**
   * Generate AI response based on backend
   */
  private async generateResponse(session: ChatSession, request: ChatRequest): Promise<ChatResponse> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    switch (session.backend) {
      case 'bedrock':
        return await this.generateBedrockResponse(session, request, messageId, timestamp);
      case 'ollama':
        return await this.generateOllamaResponse(session, request, messageId, timestamp);
      case 'openai':
        return await this.generateOpenAIResponse(session, request, messageId, timestamp);
      default:
        throw new Error(`Unsupported chat backend: ${session.backend}`);
    }
  }

  /**
   * Generate response using AWS Bedrock
   */
  private async generateBedrockResponse(
    session: ChatSession,
    request: ChatRequest,
    messageId: string,
    timestamp: string
  ): Promise<ChatResponse> {
    try {
      // Check if we have MCP tools available
      const mcpCalls: any[] = [];
      let userMessage = request.message;

      // If MCP context is available, try to use relevant tools
      if (session.context.mcpContextId && session.context.tools.length > 0) {
        // Simple tool detection - in production, use more sophisticated routing
        if (userMessage.toLowerCase().includes('analytics') || userMessage.toLowerCase().includes('data')) {
          try {
            // Create minimal JWT payload for MCP tool execution
            const jwt: JWTPayload = {
              userId: request.userId,
              email: '', // Not available in ChatRequest
              name: '', // Not available in ChatRequest
              organizationMemberships: [],
              personalNamespace: request.userId,
              organizationId: request.organizationId
            };

            const toolResult = await this.mcpRegistry.executeTool(
              'ga-top-pages',
              {
                property_id: 'default',
                start_date: '30daysAgo',
                end_date: 'today'
              },
              jwt,
              request.organizationId
            );
            mcpCalls.push({ tool: 'ga-top-pages', result: toolResult });
            userMessage += `\n\nRelevant analytics data: ${JSON.stringify(toolResult, null, 2)}`;
          } catch (error) {
            this.logger.warn('Failed to execute MCP tool:', error);
          }
        }
      }

      // Prepare conversation history for Claude
      // Note: session.messages already contains the current user message (added in sendMessage)
      // So we just need to ensure proper alternation
      const messages = session.messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Ensure role alternation - Claude requires strict user/assistant alternation
      const alternatingMessages = [];
      let lastRole: string | null = null;

      for (const msg of messages) {
        // Skip consecutive messages with same role (keep only the last one)
        if (msg.role === lastRole) {
          // Replace the previous message with this one
          alternatingMessages.pop();
        }
        alternatingMessages.push(msg);
        lastRole = msg.role;
      }

      // Ensure the conversation starts with a user message
      if (alternatingMessages.length > 0 && alternatingMessages[0].role !== 'user') {
        alternatingMessages.shift();
      }

      // Get model ID from config
      const modelId = this.config.bedrock?.modelId || 'anthropic.claude-3-7-sonnet-20250219-v1:0';

      // Prepare Claude request body
      const requestBody = {
        anthropic_version: this.config.bedrock?.anthropicVersion || 'bedrock-2023-05-31',
        max_tokens: session.context.maxTokens,
        temperature: session.context.temperature,
        system: session.systemPrompt || await this.getDefaultSystemPrompt(session.organizationId, session.context.mcpContextId, session.userId),
        messages: alternatingMessages
      };

      this.logger.info(`Calling Bedrock Claude model: ${modelId} with ${alternatingMessages.length} messages (roles: ${alternatingMessages.map(m => m.role).join(', ')})`);

      // Call Bedrock API
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.bedrockClient.send(command);

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract content from Claude response
      const content = responseBody.content[0].text;

      // Extract usage stats
      const usage = {
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
        totalTokens: (responseBody.usage?.input_tokens || 0) + (responseBody.usage?.output_tokens || 0)
      };

      this.logger.info(`Bedrock response received. Tokens: ${usage.totalTokens}`);

      return {
        messageId,
        content,
        role: 'assistant',
        timestamp,
        context: {
          toolsUsed: mcpCalls.map(call => call.tool),
          mcpCalls
        },
        usage
      };

    } catch (error) {
      this.logger.error('Bedrock API error:', error);
      throw new Error(`Failed to generate response from Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate streaming response using AWS Bedrock (for WebSocket clients)
   */
  async *generateBedrockStreamingResponse(
    session: ChatSession,
    request: ChatRequest
  ): AsyncGenerator<{ type: 'token' | 'done'; content?: string; usage?: any }> {
    try {
      // Prepare conversation history (same as non-streaming)
      const messages = session.messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Ensure role alternation - Claude requires strict user/assistant alternation
      const alternatingMessages = [];
      let lastRole: string | null = null;

      for (const msg of messages) {
        // Skip consecutive messages with same role (keep only the last one)
        if (msg.role === lastRole) {
          alternatingMessages.pop();
        }
        alternatingMessages.push(msg);
        lastRole = msg.role;
      }

      // Ensure the conversation starts with a user message
      if (alternatingMessages.length > 0 && alternatingMessages[0].role !== 'user') {
        alternatingMessages.shift();
      }

      // Get model ID from config
      const modelId = this.config.bedrock?.modelId || 'anthropic.claude-3-7-sonnet-20250219-v1:0';

      // Prepare Claude request body
      const requestBody = {
        anthropic_version: this.config.bedrock?.anthropicVersion || 'bedrock-2023-05-31',
        max_tokens: session.context.maxTokens,
        temperature: session.context.temperature,
        system: session.systemPrompt || await this.getDefaultSystemPrompt(session.organizationId, session.context.mcpContextId, session.userId),
        messages: alternatingMessages
      };

      this.logger.info(`Calling Bedrock Claude model (streaming): ${modelId} with ${alternatingMessages.length} messages`);

      // Call Bedrock streaming API
      const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.bedrockClient.send(command);

      if (!response.body) {
        throw new Error('No response body from Bedrock streaming API');
      }

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      // Process streaming response
      for await (const event of response.body) {
        if (event.chunk) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

          // Handle different event types
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            const text = chunk.delta.text;
            fullContent += text;
            yield { type: 'token', content: text };
          } else if (chunk.type === 'message_start' && chunk.message?.usage) {
            inputTokens = chunk.message.usage.input_tokens || 0;
          } else if (chunk.type === 'message_delta' && chunk.usage) {
            outputTokens = chunk.usage.output_tokens || 0;
          }
        }
      }

      const usage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      };

      this.logger.info(`Bedrock streaming completed. Tokens: ${usage.totalTokens}`);

      // Signal completion
      yield { type: 'done', usage };

    } catch (error) {
      this.logger.error('Bedrock streaming API error:', error);
      throw new Error(`Failed to generate streaming response from Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate response using Ollama
   */
  private async generateOllamaResponse(
    session: ChatSession,
    request: ChatRequest,
    messageId: string,
    timestamp: string
  ): Promise<ChatResponse> {
    try {
      const ollamaConfig = this.config.ollama;
      if (!ollamaConfig) {
        throw new Error('Ollama configuration not available');
      }

      // Prepare messages for Ollama
      const messages = session.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      messages.push({ role: 'user', content: request.message });

      // For demo purposes, simulate Ollama response
      // In production, make HTTP request to Ollama API
      const response = await this.simulateOllamaResponse(request.message, session);

      return {
        messageId,
        content: response,
        role: 'assistant',
        timestamp,
        usage: {
          inputTokens: this.estimateTokens(request.message),
          outputTokens: this.estimateTokens(response),
          totalTokens: this.estimateTokens(request.message + response)
        }
      };

    } catch (error) {
      this.logger.error('Ollama API error:', error);
      throw new Error('Failed to generate response from Ollama');
    }
  }

  /**
   * Generate response using OpenAI
   */
  private async generateOpenAIResponse(
    session: ChatSession,
    request: ChatRequest,
    messageId: string,
    timestamp: string
  ): Promise<ChatResponse> {
    try {
      const openaiConfig = this.config.openai;
      if (!openaiConfig) {
        throw new Error('OpenAI configuration not available');
      }

      // For demo purposes, simulate OpenAI response
      // In production, integrate with OpenAI API
      const response = await this.simulateOpenAIResponse(request.message, session);

      return {
        messageId,
        content: response,
        role: 'assistant',
        timestamp,
        usage: {
          inputTokens: this.estimateTokens(request.message),
          outputTokens: this.estimateTokens(response),
          totalTokens: this.estimateTokens(request.message + response)
        }
      };

    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      throw new Error('Failed to generate response from OpenAI');
    }
  }

  /**
   * Simulate AI responses for demo purposes
   */
  private async simulateClaudeResponse(message: string, session: ChatSession): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const responses = [
      `I understand you're asking about "${message}". As Claude running on AWS Bedrock, I can help you with various tasks including data analysis, workflow automation, and MCP tool integration.`,
      `Based on your message about "${message}", I can assist you with this workflow. Let me know if you'd like me to use any of the available MCP tools to gather more information.`,
      `That's an interesting question about "${message}". In the context of your ${session.organizationId ? 'organization' : 'personal'} workspace, I can help you build workflows, analyze data, or integrate with your connected services.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private async simulateOllamaResponse(message: string, session: ChatSession): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    return `[Ollama Response] I've processed your message about "${message}". This is running on a local Ollama instance with the ${session.model} model.`;
  }

  private async simulateOpenAIResponse(message: string, session: ChatSession): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    return `[OpenAI Response] Thank you for your question about "${message}". I'm running on OpenAI's ${session.model} model and can help with your workflow automation needs.`;
  }

  /**
   * Get user's connected integrations from KV store
   * TODO: Once kv_list is available, we can discover dynamically
   * For now, checks known integration services
   */
  private async getUserConnections(
    userId: string,
    organizationId?: string
  ): Promise<Record<string, any[]>> {
    const connections: Record<string, any[]> = {};
    const orgId = organizationId || 'default-org';

    // Known integration services (from integration configs)
    const knownIntegrations = [
      'google-analytics',
      'slack',
      'github',
      'stripe',
      'sendgrid',
      'twilio',
      'hubspot',
      'salesforce',
      'aws-s3',
      'dynamodb'
    ];

    const knownConnectionIds = ['default', 'work', 'personal', 'backup'];

    try {
      for (const serviceId of knownIntegrations) {
        const serviceConnections = [];

        for (const connectionId of knownConnectionIds) {
          try {
            const key = `user-${userId}-integration-${serviceId}-${connectionId}`;
            const connData = await this.mcpRegistry.executeTool(
              'kv_get',
              { key },
              {
                userId,
                email: '',
                name: '',
                organizationMemberships: [],
                personalNamespace: userId,
                organizationId: orgId
              } as JWTPayload,
              orgId
            );

            if (connData && connData.value) {
              serviceConnections.push({
                connectionId,
                connectedAt: connData.value.connected_at || new Date().toISOString(),
                connectionName: connData.value.connection_name || `${serviceId} (${connectionId})`
              });
            }
          } catch (error) {
            // Connection not found, skip
            continue;
          }
        }

        if (serviceConnections.length > 0) {
          connections[serviceId] = serviceConnections;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to get user connections:', error);
    }

    return connections;
  }

  /**
   * Get available workflow task types
   * These are the node types that can be used in workflows
   */
  /**
   * Get available task types filtered by user's connected integrations
   */
  private getAvailableTaskTypes(userConnections: Record<string, any[]>): {
    available: any[];
    unavailable: any[];
    suggestions: string[];
  } {
    const connectedServices = Object.keys(userConnections).filter(
      key => userConnections[key].length > 0
    );

    // Comprehensive list of all 44 task types across 9 categories
    const allTaskTypes = [
      // Triggers (3 types)
      {
        type: 'trigger-schedule',
        category: 'trigger',
        description: 'Trigger workflow on a schedule (cron)',
        config: { schedule: '0 0 * * *' }
      },
      {
        type: 'trigger-webhook',
        category: 'trigger',
        description: 'Trigger workflow via HTTP webhook',
        config: { method: 'POST', path: '/webhook' }
      },
      {
        type: 'trigger-event',
        category: 'trigger',
        description: 'Trigger workflow on EventBridge event',
        config: { eventType: 'custom.event', source: 'custom' }
      },

      // HTTP/API (4 types)
      {
        type: 'http-get',
        category: 'http',
        description: 'Make HTTP GET request',
        requiredIntegrations: [],
        config: { url: '', headers: {} }
      },
      {
        type: 'http-post',
        category: 'http',
        description: 'Make HTTP POST request',
        config: { url: '', headers: {}, body: {} }
      },
      {
        type: 'http-put',
        category: 'http',
        description: 'Make HTTP PUT request',
        config: { url: '', headers: {}, body: {} }
      },
      {
        type: 'http-delete',
        category: 'http',
        description: 'Make HTTP DELETE request',
        config: { url: '', headers: {} }
      },

      // Data Processing (10 types)
      {
        type: 'transform-map',
        category: 'data-processing',
        description: 'Map/transform data using JavaScript',
        config: { transform: 'item => item' }
      },
      {
        type: 'transform-filter',
        category: 'data-processing',
        description: 'Filter array data',
        config: { condition: 'item => true' }
      },
      {
        type: 'transform-reduce',
        category: 'data-processing',
        description: 'Reduce array to single value',
        config: { reducer: '(acc, item) => acc' }
      },
      {
        type: 'transform-sort',
        category: 'data-processing',
        description: 'Sort array data',
        config: { sortBy: 'field', order: 'asc' }
      },
      {
        type: 'transform-group',
        category: 'data-processing',
        description: 'Group data by field',
        config: { groupBy: 'field' }
      },
      {
        type: 'json-parse',
        category: 'data-processing',
        description: 'Parse JSON string',
        config: {}
      },
      {
        type: 'json-stringify',
        category: 'data-processing',
        description: 'Convert to JSON string',
        config: { pretty: false }
      },
      {
        type: 'csv-parse',
        category: 'data-processing',
        description: 'Parse CSV data',
        config: { delimiter: ',', headers: true }
      },
      {
        type: 'csv-generate',
        category: 'data-processing',
        description: 'Generate CSV from data',
        config: { delimiter: ',', headers: true }
      },
      {
        type: 'template',
        category: 'data-processing',
        description: 'Apply template to data',
        config: { template: '{{value}}' }
      },

      // Events (3 types)
      {
        type: 'events-send',
        category: 'events',
        description: 'Send event to EventBridge',
        config: { source: 'workflow', detailType: 'custom' }
      },
      {
        type: 'events-query',
        category: 'events',
        description: 'Query event history',
        config: { startTime: '', endTime: '' }
      },
      {
        type: 'events-subscribe',
        category: 'events',
        description: 'Subscribe to event stream',
        config: { eventTypes: [] }
      },

      // Storage (5 types)
      {
        type: 'kv-get',
        category: 'storage',
        description: 'Get value from KV store',
        config: { key: '' }
      },
      {
        type: 'kv-set',
        category: 'storage',
        description: 'Set value in KV store',
        config: { key: '', value: '', ttl_hours: 24 }
      },
      {
        type: 'dynamodb-get',
        category: 'storage',
        description: 'Get item from DynamoDB',
        requiredIntegrations: ['dynamodb'],
        config: { table: '', key: {} }
      },
      {
        type: 'dynamodb-put',
        category: 'storage',
        description: 'Put item in DynamoDB',
        requiredIntegrations: ['dynamodb'],
        config: { table: '', item: {} }
      },
      {
        type: 's3-get',
        category: 'storage',
        description: 'Get object from S3',
        requiredIntegrations: ['aws-s3'],
        config: { bucket: '', key: '' }
      },

      // Logic (4 types)
      {
        type: 'condition',
        category: 'logic',
        description: 'Conditional branching',
        config: { condition: 'true', truePath: '', falsePath: '' }
      },
      {
        type: 'loop',
        category: 'logic',
        description: 'Loop over array items',
        config: { items: [] }
      },
      {
        type: 'parallel',
        category: 'logic',
        description: 'Execute branches in parallel',
        config: { branches: [] }
      },
      {
        type: 'delay',
        category: 'logic',
        description: 'Delay execution',
        config: { duration: 1000 }
      },

      // Output (6 types)
      {
        type: 'email',
        category: 'output',
        description: 'Send email via SendGrid',
        requiredIntegrations: ['sendgrid'],
        config: { to: '', subject: '', body: '' }
      },
      {
        type: 'slack-message',
        category: 'output',
        description: 'Send Slack message',
        requiredIntegrations: ['slack'],
        config: { channel: '', text: '' }
      },
      {
        type: 'sms',
        category: 'output',
        description: 'Send SMS via Twilio',
        requiredIntegrations: ['twilio'],
        config: { to: '', body: '' }
      },
      {
        type: 'log',
        category: 'output',
        description: 'Log data to console',
        config: { level: 'info' }
      },
      {
        type: 'chart-timeseries',
        category: 'visualization',
        description: 'Generate time-series chart with trend lines',
        config: {
          title: 'Time Series Chart',
          timeField: 'date',
          series: [{ field: 'value', label: 'Metric', color: '#2196F3' }],
          showTrendLine: true,
          width: 1200,
          height: 400
        }
      },
      {
        type: 'chart-bar',
        category: 'visualization',
        description: 'Generate bar chart (horizontal or vertical)',
        config: {
          title: 'Bar Chart',
          xAxis: 'category',
          yAxis: 'value',
          orientation: 'horizontal',
          showValues: true,
          width: 800,
          height: 500
        }
      },
      {
        type: 'chart-pie',
        category: 'visualization',
        description: 'Generate pie chart with percentages',
        config: {
          title: 'Pie Chart',
          labelField: 'category',
          valueField: 'value',
          showPercentages: true,
          showLegend: true,
          width: 600,
          height: 400
        }
      },

      // Agents (2 types)
      {
        type: 'agent-invoke',
        category: 'agents',
        description: 'Invoke AI agent',
        config: { agentId: '', prompt: '' }
      },
      {
        type: 'agent-delegate',
        category: 'agents',
        description: 'Delegate to specialist agent',
        config: { agentType: '', task: '' }
      },

      // Integration-specific (4 types)
      {
        type: 'ga-query',
        category: 'integrations',
        description: 'Query Google Analytics',
        requiredIntegrations: ['google-analytics'],
        config: { propertyId: '', startDate: '7daysAgo', endDate: 'today' }
      },
      {
        type: 'github-get-repo',
        category: 'integrations',
        description: 'Get GitHub repository info',
        requiredIntegrations: ['github'],
        config: { owner: '', repo: '' }
      },
      {
        type: 'stripe-get-customer',
        category: 'integrations',
        description: 'Get Stripe customer',
        requiredIntegrations: ['stripe'],
        config: { customerId: '' }
      },
      {
        type: 'hubspot-get-contact',
        category: 'integrations',
        description: 'Get HubSpot contact',
        requiredIntegrations: ['hubspot'],
        config: { contactId: '' }
      }
    ];

    // Filter task types by user's connected integrations
    const available: any[] = [];
    const unavailable: any[] = [];
    const missingIntegrations = new Set<string>();

    for (const taskType of allTaskTypes) {
      const requiredIntegrations = taskType.requiredIntegrations || [];

      if (requiredIntegrations.length === 0) {
        // No integration required - always available
        available.push(taskType);
      } else {
        // Check if all required integrations are connected
        const hasAllIntegrations = requiredIntegrations.every(integration =>
          connectedServices.includes(integration)
        );

        if (hasAllIntegrations) {
          available.push(taskType);
        } else {
          unavailable.push(taskType);
          requiredIntegrations.forEach(integration => {
            if (!connectedServices.includes(integration)) {
              missingIntegrations.add(integration);
            }
          });
        }
      }
    }

    // Generate helpful suggestions for missing integrations
    const suggestions: string[] = [];
    for (const integration of missingIntegrations) {
      const tasksUsingThis = unavailable.filter(t =>
        t.requiredIntegrations?.includes(integration)
      );

      suggestions.push(
        `Connect ${integration} to unlock ${tasksUsingThis.length} additional node types: ${tasksUsingThis.map(t => t.type).join(', ')}`
      );
    }

    return { available, unavailable, suggestions };
  }

  /**
   * Get available MCP tools for user context
   */
  private async getAvailableTools(
    userId: string,
    organizationId?: string,
    mcpContextId?: string
  ): Promise<string[]> {
    try {
      const tools = await this.mcpRegistry.listAllTools();
      return tools.map(tool => tool.name);
    } catch (error) {
      this.logger.warn('Failed to get MCP tools:', error);
      return [];
    }
  }

  /**
   * Get default model for backend
   */
  private getDefaultModel(backend: 'bedrock' | 'ollama' | 'openai'): string {
    switch (backend) {
      case 'bedrock':
        return this.config.bedrock?.modelId || 'anthropic.claude-3-7-sonnet-20250219-v1:0';
      case 'ollama':
        return this.config.ollama?.model || 'llama2';
      case 'openai':
        return this.config.openai?.model || 'gpt-4';
      default:
        return 'unknown';
    }
  }

  /**
   * Get default system prompt with workflow generation context
   */
  private async getDefaultSystemPrompt(
    organizationId?: string,
    mcpContextId?: string,
    userId?: string
  ): Promise<string> {
    const basePrompt = `You are Claude, an AI assistant integrated with the AWS AI Agent Bus platform. You have access to various MCP (Model Context Protocol) tools and can help with workflow automation, data analysis, and business process management.`;

    const contextInfo = organizationId
      ? `You are currently working in an organization context with access to shared resources and team workflows.`
      : `You are working in a personal context with access to individual tools and workflows.`;

    const mcpInfo = mcpContextId
      ? `You have access to MCP tools and can integrate with various services. When relevant, you can use these tools to provide more accurate and up-to-date information.`
      : `You currently don't have MCP context enabled, but you can still help with general questions and advice.`;

    // Get user's connected integrations
    let userConnectionsInfo = '';
    if (userId) {
      try {
        const connections = await this.getUserConnections(userId, organizationId);
        const connectedServices = Object.keys(connections);

        if (connectedServices.length > 0) {
          userConnectionsInfo = `\n\n## Connected Integrations\nYou have access to the following connected services:\n${connectedServices.map(service => {
            const conns = connections[service];
            return `- **${service}**: ${conns.length} connection(s) (${conns.map(c => c.connectionId).join(', ')})`;
          }).join('\n')}`;
        } else {
          userConnectionsInfo = `\n\n## Connected Integrations\nNo integrations currently connected. You can guide users to connect services at /settings/integrations`;
        }
      } catch (error) {
        this.logger.warn('Failed to get user connections for prompt:', error);
      }
    }

    // Get available workflow task types (filtered by user connections)
    const userConnections = userId
      ? await this.getUserConnections(userId, organizationId)
      : {};
    const taskTypeInfo = this.getAvailableTaskTypes(userConnections);

    const workflowInfo = `\n\n## Workflow Generation Capabilities

You can generate workflows using node types available to this user:

### ✅ Available Node Types (${taskTypeInfo.available.length} types):
${this.formatTaskTypesByCategory(taskTypeInfo.available)}

${taskTypeInfo.unavailable.length > 0 ? `
### ⚠️ Unavailable Node Types (${taskTypeInfo.unavailable.length} types - missing integrations):
${this.formatTaskTypesByCategory(taskTypeInfo.unavailable)}

### 💡 Integration Suggestions:
${taskTypeInfo.suggestions.map(s => `- ${s}`).join('\n')}

**When a user requests a workflow that needs unavailable nodes, suggest connecting the required integrations first.**
` : ''}

### Workflow JSON Schema:
When generating workflows, use this JSON structure:

\`\`\`json
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "nodes": [
    {
      "id": "unique-node-id",
      "type": "one of the available types above",
      "x": 50,        // X position on canvas (increment by ~200)
      "y": 100,       // Y position on canvas
      "inputs": ["input"],
      "outputs": ["output"],
      "config": {
        "name": "Node Name",
        "description": "What this node does",
        // ... node-specific configuration
      }
    }
  ],
  "connections": [
    {
      "from": "source-node-id",
      "to": "target-node-id",
      "fromOutput": "output",
      "toInput": "input"
    }
  ],
  "metadata": {
    "author": "Claude AI",
    "createdAt": "${new Date().toISOString()}",
    "version": "1.0.0"
  }
}
\`\`\`

### Workflow Generation Rules:
1. **Check Required Integrations**: Before using nodes with requiredIntegrations, verify the user has those services connected
2. **Missing Integrations**: If required services aren't connected, provide a helpful message like: "Please connect [ServiceName] at /settings/integrations before I can generate this workflow"
3. **Node Positioning**: Space nodes horizontally by ~200px (x: 50, 250, 450, etc.) for readability
4. **Valid Types Only**: Only use node types from the available list above
5. **Complete Config**: Fill in all required config fields for each node type
6. **Logical Flow**: Ensure connections create a valid data flow from triggers to outputs
7. **Descriptive Names**: Give each node a clear, descriptive name in its config

### Example Workflow Requests & Responses:

**Example 1: Simple Daily Notification**
User: "Build a workflow that sends me a Slack message every day at 9am"

Your Response:
1. Check if user has 'slack' connected
2. If yes, generate:
\`\`\`json
{
  "name": "Daily Slack Reminder",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger-schedule",
      "x": 50, "y": 100,
      "config": { "name": "Daily at 9am", "schedule": "0 9 * * *" }
    },
    {
      "id": "slack-1",
      "type": "slack-message",
      "x": 250, "y": 100,
      "config": { "name": "Send Message", "channel": "general", "text": "Good morning! 🌅" }
    }
  ],
  "connections": [{ "from": "trigger-1", "to": "slack-1" }]
}
\`\`\`
3. If no, explain: "Please connect Slack at /settings/integrations first"

**Example 2: Analytics with Visualization**
User: "Create a workflow that pulls Google Analytics data and creates a chart"

Your Response:
1. Check if user has 'google-analytics' connected
2. If yes, generate:
\`\`\`json
{
  "name": "Analytics Visualization",
  "description": "Fetch GA data and create time-series chart",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger-schedule",
      "x": 50, "y": 100,
      "config": { "schedule": "0 0 * * *" }
    },
    {
      "id": "ga-1",
      "type": "ga-query",
      "x": 250, "y": 100,
      "config": {
        "name": "Fetch Sessions",
        "metrics": ["sessions", "users", "pageviews"],
        "dimensions": ["date"],
        "dateRange": "last7days"
      }
    },
    {
      "id": "chart-1",
      "type": "chart-timeseries",
      "x": 450, "y": 100,
      "config": {
        "title": "7-Day Traffic Trends",
        "timeField": "date",
        "series": [
          { "field": "sessions", "label": "Sessions", "color": "#2196F3" },
          { "field": "users", "label": "Users", "color": "#4CAF50" }
        ],
        "showTrendLine": true
      }
    }
  ],
  "connections": [
    { "from": "trigger-1", "to": "ga-1" },
    { "from": "ga-1", "to": "chart-1" }
  ]
}
\`\`\`

**Example 3: Data Processing with Bar Chart**
User: "Build a workflow to show top pages from Google Analytics in a bar chart"

Your Response:
\`\`\`json
{
  "name": "Top Pages Bar Chart",
  "nodes": [
    {
      "id": "ga-1",
      "type": "ga-query",
      "x": 50, "y": 100,
      "config": {
        "metrics": ["pageviews"],
        "dimensions": ["pageTitle"],
        "dateRange": "yesterday",
        "orderBy": "pageviews DESC",
        "limit": 10
      }
    },
    {
      "id": "chart-1",
      "type": "chart-bar",
      "x": 250, "y": 100,
      "config": {
        "title": "Top 10 Pages Yesterday",
        "xAxis": "pageTitle",
        "yAxis": "pageviews",
        "orientation": "horizontal",
        "showValues": true
      }
    }
  ],
  "connections": [{ "from": "ga-1", "to": "chart-1" }]
}
\`\`\`

**Visualization Best Practices:**
- Use **chart-timeseries** for trends over time (sessions, users, metrics)
- Use **chart-bar** for comparisons (top pages, traffic sources, categories)
- Use **chart-pie** for distribution (traffic sources, device types, regions)
- Always set descriptive titles
- Choose appropriate colors for multiple series
- Include proper field mappings (timeField, xAxis, yAxis, labelField, valueField)`;

    return `${basePrompt}\n\n${contextInfo}\n\n${mcpInfo}${userConnectionsInfo}${workflowInfo}\n\nPlease be helpful, accurate, and specific in your responses. When generating workflows, always return valid JSON that matches the schema above.`;
  }

  /**
   * Format task types by category for prompt
   */
  private formatTaskTypesByCategory(taskTypes: any[]): string {
    const byCategory: Record<string, any[]> = {};

    taskTypes.forEach(task => {
      if (!byCategory[task.category]) {
        byCategory[task.category] = [];
      }
      byCategory[task.category].push(task);
    });

    return Object.entries(byCategory)
      .map(([category, tasks]) => {
        const taskList = tasks.map(t => {
          const integrations = t.requiredIntegrations?.length > 0
            ? ` (requires: ${t.requiredIntegrations.join(', ')})`
            : '';
          return `  - **${t.type}**${integrations}: ${t.description}`;
        }).join('\n');
        return `**${category.toUpperCase()}** (${tasks.length} types):\n${taskList}`;
      })
      .join('\n\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Emit chat-related events
   */
  private async emitChatEvent(eventType: string, data: any): Promise<void> {
    try {
      // In production, send to EventBridge
      this.logger.info(`Chat event: ${eventType}`, data);
    } catch (error) {
      this.logger.warn('Failed to emit chat event:', error);
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter(session => session.userId === userId);
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }

    this.sessions.delete(sessionId);
    return true;
  }
}

export default ChatService;