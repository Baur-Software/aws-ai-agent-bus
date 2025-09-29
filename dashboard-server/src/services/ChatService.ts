import { Logger } from '../utils/Logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { MCPServiceRegistry } from './MCPServiceRegistry.js';

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

  constructor(
    private dynamodb: DynamoDBClient,
    private eventBridge: EventBridgeClient,
    private mcpRegistry: MCPServiceRegistry,
    private config: ChatBackendConfig
  ) {
    this.logger = new Logger('ChatService');
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
      systemPrompt: this.getDefaultSystemPrompt(organizationId, mcpContextId),
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

    this.logger.info(`Created chat session ${sessionId} for user ${userId} with backend ${backend}`);

    return session;
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Chat session not found: ${request.sessionId}`);
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
      context: request.context
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
        context: response.context,
        metadata: { usage: response.usage }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date().toISOString();

      // Update session in storage
      this.sessions.set(request.sessionId, session);

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
      let content = request.message;

      // If MCP context is available, try to use relevant tools
      if (session.context.mcpContextId && session.context.tools.length > 0) {
        // Simple tool detection - in production, use more sophisticated routing
        if (content.toLowerCase().includes('analytics') || content.toLowerCase().includes('data')) {
          try {
            const toolResult = await this.mcpRegistry.executeTool(
              'ga-top-pages',
              {
                property_id: 'default',
                start_date: '30daysAgo',
                end_date: 'today'
              },
              { userId: request.userId, organizationId: request.organizationId },
              request.organizationId
            );
            mcpCalls.push({ tool: 'ga-top-pages', result: toolResult });
            content += `\n\nRelevant analytics data: ${JSON.stringify(toolResult, null, 2)}`;
          } catch (error) {
            this.logger.warn('Failed to execute MCP tool:', error);
          }
        }
      }

      // For demo purposes, use Claude-like responses
      // In production, integrate with AWS Bedrock Claude
      const response = await this.simulateClaudeResponse(content, session);

      return {
        messageId,
        content: response,
        role: 'assistant',
        timestamp,
        context: {
          toolsUsed: mcpCalls.map(call => call.tool),
          mcpCalls
        },
        usage: {
          inputTokens: this.estimateTokens(content),
          outputTokens: this.estimateTokens(response),
          totalTokens: this.estimateTokens(content + response)
        }
      };

    } catch (error) {
      this.logger.error('Bedrock API error:', error);
      throw new Error('Failed to generate response from Bedrock');
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
        return this.config.bedrock?.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0';
      case 'ollama':
        return this.config.ollama?.model || 'llama2';
      case 'openai':
        return this.config.openai?.model || 'gpt-4';
      default:
        return 'unknown';
    }
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(organizationId?: string, mcpContextId?: string): string {
    const basePrompt = `You are Claude, an AI assistant integrated with the AWS AI Agent Bus platform. You have access to various MCP (Model Context Protocol) tools and can help with workflow automation, data analysis, and business process management.`;

    const contextInfo = organizationId
      ? `You are currently working in an organization context with access to shared resources and team workflows.`
      : `You are working in a personal context with access to individual tools and workflows.`;

    const mcpInfo = mcpContextId
      ? `You have access to MCP tools and can integrate with various services. When relevant, you can use these tools to provide more accurate and up-to-date information.`
      : `You currently don't have MCP context enabled, but you can still help with general questions and advice.`;

    return `${basePrompt}\n\n${contextInfo}\n\n${mcpInfo}\n\nPlease be helpful, accurate, and specific in your responses.`;
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