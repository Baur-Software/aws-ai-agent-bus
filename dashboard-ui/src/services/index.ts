// Service Layer Index
// Centralized exports for all service clients

// Core service exports
export { HTTPService, APIClient, HTTPError, createHTTPService } from './HTTPService';
export { WorkflowStorageService, createWorkflowStorageService } from './WorkflowStorageService';

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
  http: HTTPService;
  workflowStorage: WorkflowStorageService;
}

export interface ServiceConfig {
  mcpClient?: any;
  httpTimeout?: number;
  httpRetries?: number;
  userId?: string;
}

export function createServiceContainer(config: ServiceConfig): ServiceContainer {
  return {
    http: createHTTPService({
      timeout: config.httpTimeout,
      retries: config.httpRetries
    }),
    workflowStorage: createWorkflowStorageService(config.mcpClient, config.userId)
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