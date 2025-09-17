// Testing utilities for mock data
import { MockDataGenerator } from './index';

// Environment variable helpers for testing
export class TestEnvironment {
  static enableMockData(): void {
    // @ts-ignore - Setting on import.meta.env for testing
    import.meta.env.VITE_USE_MOCK_DATA = 'true';
  }

  static disableMockData(): void {
    // @ts-ignore
    import.meta.env.VITE_USE_MOCK_DATA = 'false';
  }

  static enableMockFeature(feature: string): void {
    const envVar = `VITE_MOCK_${feature.toUpperCase()}`;
    // @ts-ignore
    import.meta.env[envVar] = 'true';
  }

  static disableMockFeature(feature: string): void {
    const envVar = `VITE_MOCK_${feature.toUpperCase()}`;
    // @ts-ignore
    import.meta.env[envVar] = 'false';
  }

  static resetMockEnvironment(): void {
    // Reset all mock-related environment variables
    const mockEnvVars = [
      'VITE_USE_MOCK_DATA',
      'VITE_MOCK_WORKFLOWS',
      'VITE_MOCK_CONTEXTS',
      'VITE_MOCK_MCP',
      'VITE_MOCK_OAUTH',
      'VITE_MOCK_EVENTS'
    ];

    mockEnvVars.forEach(varName => {
      // @ts-ignore
      delete import.meta.env[varName];
    });
  }
}

// Test data factories
export class TestDataFactory {
  static createWorkflow(overrides: Partial<any> = {}): any {
    const baseWorkflow = MockDataGenerator.getRandomWorkflow();
    return {
      ...baseWorkflow,
      workflowId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...overrides
    };
  }

  static createUser(overrides: Partial<any> = {}): any {
    const baseUser = MockDataGenerator.getRandomUser();
    return {
      ...baseUser,
      id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...overrides
    };
  }

  static createOrganization(overrides: Partial<any> = {}): any {
    const baseOrg = MockDataGenerator.getRandomOrganization();
    return {
      ...baseOrg,
      id: `test-org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...overrides
    };
  }

  static createEvent(overrides: Partial<any> = {}): any {
    return MockDataGenerator.generateRealtimeEvent(overrides);
  }
}

// Mock API response builders
export class MockApiBuilder {
  static workflowsResponse(workflows: any[] = []): any {
    return {
      workflows,
      count: workflows.length,
      userId: 'test-user',
      organizationId: 'test-org'
    };
  }

  static contextsResponse(contexts: any[] = []): any {
    return {
      contexts,
      count: contexts.length,
      userId: 'test-user',
      organizationId: 'test-org'
    };
  }

  static mcpToolsResponse(tools: any[] = []): any {
    return {
      tools,
      count: tools.length,
      status: 'healthy'
    };
  }

  static errorResponse(message: string, code: number = 500): any {
    return {
      error: true,
      message,
      code,
      timestamp: new Date().toISOString()
    };
  }
}

// Performance testing helpers
export class MockPerformance {
  static simulateSlowApi(delayMs: number = 2000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  static simulateNetworkError(): Promise<never> {
    return Promise.reject(new Error('Simulated network error'));
  }

  static simulateTimeoutError(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 5000);
    });
  }

  static async withRandomDelay<T>(
    promise: Promise<T>,
    minMs: number = 100,
    maxMs: number = 1000
  ): Promise<T> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
    return promise;
  }
}

// Test scenario helpers
export class TestScenarios {
  static async emptyDashboard(): Promise<void> {
    TestEnvironment.enableMockData();
    TestEnvironment.enableMockFeature('workflows');

    // Override mock data to return empty arrays
    MockDataGenerator.workflows.length = 0;
    MockDataGenerator.contexts.length = 0;
  }

  static async loadedDashboard(): Promise<void> {
    TestEnvironment.enableMockData();
    // Uses default mock data with workflows and contexts
  }

  static async offlineMode(): Promise<void> {
    TestEnvironment.disableMockData();
    // This will cause API calls to fail, simulating offline mode
  }

  static async errorState(): Promise<void> {
    TestEnvironment.enableMockData();

    // Override API methods to return errors
    const originalRequest = MockDataGenerator.prototype;
    // TODO: Implement error state overrides
  }

  static reset(): void {
    TestEnvironment.resetMockEnvironment();
    // Reset mock data to defaults
    // TODO: Implement data reset
  }
}

// Export commonly used testing utilities
export { MockDataGenerator } from './index';