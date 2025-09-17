// Service Layer Index
// Centralized exports for all service clients

// Core service exports
export { GoogleAnalyticsService, GoogleAnalyticsError, createGoogleAnalyticsService } from './GoogleAnalyticsService';
export { TrelloService, TrelloError, createTrelloService } from './TrelloService';
export { MCPService, MCPError, createMCPService } from './MCPService';
export { HTTPService, APIClient, HTTPError, createHTTPService } from './HTTPService';
export { WorkflowStorageService, createWorkflowStorageService } from './WorkflowStorageService';

// Type exports for Google Analytics
export type {
  GATopPagesParams,
  GATopPagesResult,
  GAPageRow,
  GATotal,
  GADateRange,
  GASearchParams,
  GASearchResult,
  GASearchRow,
  GAOpportunityParams,
  GAOpportunityResult,
  ContentOpportunity,
  PerformanceInsight,
  GACalendarParams,
  GACalendarResult,
  ContentSuggestion,
  KeywordTarget,
  PublishingSchedule
} from './GoogleAnalyticsService';

// Type exports for Trello
export type {
  TrelloCardParams,
  TrelloCard,
  TrelloLabel,
  TrelloMember,
  TrelloBoardParams,
  TrelloBoard,
  BoardPrefs,
  TrelloListParams,
  TrelloList,
  TrelloListAddParams,
  TrelloListResult
} from './TrelloService';

// Type exports for MCP
export type {
  KVGetResult,
  KVSetParams,
  KVSetResult,
  Artifact,
  ArtifactListResult,
  ArtifactPutParams,
  ArtifactPutResult,
  EventSendParams,
  EventSendResult,
  WorkflowStartParams,
  WorkflowResult,
  WorkflowStatusParams,
  WorkflowStatusResult
} from './MCPService';

// Type exports for HTTP
export type {
  HTTPRequestParams,
  AuthConfig,
  HTTPResponse,
  URLBuilderParams,
  URLBuilderResult
} from './HTTPService';

// Type exports for Workflow Storage
export type {
  WorkflowMetadata,
  WorkflowListItem,
  WorkflowSaveOptions,
  WorkflowSearchFilters,
  WorkflowImportResult
} from './WorkflowStorageService';

// Service factory functions for easy dependency injection
export interface ServiceContainer {
  googleAnalytics: GoogleAnalyticsService;
  trello: TrelloService;
  mcp: MCPService;
  http: HTTPService;
  workflowStorage: WorkflowStorageService;
}

export interface ServiceConfig {
  mcpClient?: any;
  trelloApiKey?: string;
  trelloToken?: string;
  httpTimeout?: number;
  httpRetries?: number;
  userId?: string;
}

export function createServiceContainer(config: ServiceConfig): ServiceContainer {
  const mcpService = createMCPService(config.mcpClient);
  
  return {
    googleAnalytics: createGoogleAnalyticsService(config.mcpClient),
    trello: createTrelloService({ 
      apiKey: config.trelloApiKey, 
      token: config.trelloToken 
    }),
    mcp: mcpService,
    http: createHTTPService({ 
      timeout: config.httpTimeout, 
      retries: config.httpRetries 
    }),
    workflowStorage: createWorkflowStorageService(mcpService, config.userId)
  };
}

// Service registry for dependency injection
export class ServiceRegistry {
  private services = new Map<string, any>();

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }
    return service as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
  }

  // Setup method for common service registration
  setupDefaultServices(config: ServiceConfig): void {
    const container = createServiceContainer(config);
    
    this.register('googleAnalytics', container.googleAnalytics);
    this.register('trello', container.trello);
    this.register('mcp', container.mcp);
    this.register('http', container.http);
    this.register('workflowStorage', container.workflowStorage);
  }
}

// Singleton instance for global service registry
export const serviceRegistry = new ServiceRegistry();