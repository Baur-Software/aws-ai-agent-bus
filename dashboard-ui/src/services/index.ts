// Service Layer Index
// Centralized exports for all service clients

// Import factories and services for use in createServiceContainer
import { HTTPService, createHTTPService } from './HTTPService';
import { MCPService, createMCPService } from './MCPService';
import { WorkflowStorageService, createWorkflowStorageService } from './WorkflowStorageService';
import { GoogleAnalyticsService, createGoogleAnalyticsService } from './GoogleAnalyticsService';
import { TrelloService, createTrelloService } from './TrelloService';

// Core service exports
export { HTTPService, APIClient, HTTPError, createHTTPService } from './HTTPService';
export { WorkflowStorageService, createWorkflowStorageService } from './WorkflowStorageService';
export { MCPService, createMCPService } from './MCPService';
export { GoogleAnalyticsService, createGoogleAnalyticsService } from './GoogleAnalyticsService';
export { TrelloService, createTrelloService } from './TrelloService';

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

// Type exports for MCP Client
export type { MCPClient } from './MCPService';

// Type exports for Google Analytics
export type {
  GATopPagesParams,
  GASearchConsoleParams,
  GAContentOpportunitiesParams,
  GAContentCalendarParams
} from './GoogleAnalyticsService';

// Type exports for Trello
export type {
  TrelloCreateCardParams,
  TrelloCreateBoardParams,
  TrelloCreateListParams
} from './TrelloService';

// Service factory functions for easy dependency injection
export interface ServiceContainer {
  http: HTTPService;
  workflowStorage: WorkflowStorageService;
  mcp: MCPService;
  googleAnalytics: GoogleAnalyticsService;
  trello: TrelloService;
}

export interface ServiceConfig {
  mcpClient?: any;
  httpClient?: any;
  httpTimeout?: number;
  httpRetries?: number;
  userId?: string;
}

export function createServiceContainer(config: ServiceConfig = {}): ServiceContainer {
  const httpService = config.httpClient || createHTTPService({
    timeout: config.httpTimeout,
    retries: config.httpRetries
  });

  const mcpClient = config.mcpClient;
  const mcpService = createMCPService(mcpClient);

  return {
    http: httpService,
    workflowStorage: createWorkflowStorageService(mcpService, config.userId),
    mcp: mcpService,
    googleAnalytics: createGoogleAnalyticsService(mcpClient),
    trello: createTrelloService(mcpClient)
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

    this.register('http', container.http);
    this.register('workflowStorage', container.workflowStorage);
  }
}

// Singleton instance for global service registry
export const serviceRegistry = new ServiceRegistry();