import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock all Google and AWS dependencies
jest.mock('googleapis', () => ({
  google: {
    analyticsdata: jest.fn(() => ({
      properties: {
        runReport: jest.fn().mockResolvedValue({
          data: {
            rows: [
              {
                dimensionValues: [{ value: '/test-page' }, { value: 'Test Page Title' }],
                metricValues: [{ value: '150' }, { value: '300' }]
              }
            ],
            dimensionHeaders: [{ name: 'pagePath' }, { name: 'pageTitle' }],
            metricHeaders: [{ name: 'sessions' }, { name: 'pageviews' }]
          }
        })
      }
    })),
    searchconsole: jest.fn(() => ({
      searchanalytics: {
        query: jest.fn().mockResolvedValue({
          data: {
            rows: [
              {
                keys: ['test search query', '/landing-page'],
                clicks: 25,
                impressions: 500,
                ctr: 0.05,
                position: 8
              }
            ]
          }
        })
      }
    }))
  }
}));

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({})),
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    credentials: {}
  }))
}));

const mockSecretsManagerSend = jest.fn();
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: mockSecretsManagerSend,
  })),
  GetSecretValueCommand: jest.fn(),
}));

// Mock AWS clients to prevent credential issues
const mockEventBridgeClient = {
  send: jest.fn().mockResolvedValue({
    Entries: [{ EventId: 'test-event-id' }],
    FailedEntryCount: 0
  })
};

jest.mock('../../src/modules/aws/clients.js', () => ({
  eventBridge: mockEventBridgeClient,
  dynamodb: {},
  s3: {},
  stepFunctions: {}
}));

// Import the handler after mocking
const { GoogleAnalyticsHandler } = await import('../../src/modules/mcp/handlers/google-analytics.js');

describe('Google Analytics MCP Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set test environment to skip event sending
    process.env.NODE_ENV = 'test';
    
    // Reset handler state
    GoogleAnalyticsHandler.gaService = null;
    
    // Mock successful credential retrieval
    mockSecretsManagerSend.mockResolvedValue({
      SecretString: JSON.stringify({
        type: 'service_account',
        client_email: 'test@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n'
      })
    });
  });

  describe('End-to-End Google Analytics Integration', () => {
    test('should complete full getTopPages workflow', async () => {
      const result = await GoogleAnalyticsHandler.getTopPages({
        propertyId: '123456789',
        days: 30
      });

      // Verify response structure
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Verify data structure
      const firstItem = result.data[0];
      expect(firstItem).toHaveProperty('pagePath');
      expect(firstItem).toHaveProperty('pageTitle');
      expect(firstItem).toHaveProperty('sessions');
      expect(firstItem).toHaveProperty('pageviews');
      
      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.propertyId).toBe('123456789');
      expect(result.metadata.days).toBe(30);
      expect(result.metadata.retrievedAt).toBeDefined();
      
      // Event sending is skipped in test environment
    });

    test('should complete full getSearchConsoleData workflow', async () => {
      const result = await GoogleAnalyticsHandler.getSearchConsoleData({
        siteUrl: 'https://example.com',
        days: 30
      });

      // Verify response structure
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Verify data structure
      const firstItem = result.data[0];
      expect(firstItem).toHaveProperty('query');
      expect(firstItem).toHaveProperty('page');
      expect(firstItem).toHaveProperty('clicks');
      expect(firstItem).toHaveProperty('impressions');
      expect(firstItem).toHaveProperty('ctr');
      expect(firstItem).toHaveProperty('position');
      
      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.siteUrl).toBe('https://example.com');
      expect(result.metadata.days).toBe(30);
      
      // Event sending is skipped in test environment
    });

    test('should complete full analyzeContentOpportunities workflow', async () => {
      const result = await GoogleAnalyticsHandler.analyzeContentOpportunities({
        propertyId: '123456789',
        siteUrl: 'https://example.com'
      });

      // Verify response structure
      expect(result.success).toBe(true);
      expect(result.insights).toBeDefined();
      expect(result.insights.topPerformingContent).toBeDefined();
      expect(result.insights.keywordOpportunities).toBeDefined();
      expect(result.insights.contentGaps).toBeDefined();
      expect(result.insights.seasonalTrends).toBeDefined();
      
      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.propertyId).toBe('123456789');
      expect(result.metadata.siteUrl).toBe('https://example.com');
      expect(result.metadata.nextAnalysisRecommended).toBeDefined();
      
      // Event sending is skipped in test environment
    });

    test('should complete full generateContentCalendar workflow', async () => {
      const result = await GoogleAnalyticsHandler.generateContentCalendar({
        propertyId: '123456789',
        siteUrl: 'https://example.com',
        targetMonth: '2024-03'
      });

      // Verify response structure
      expect(result.success).toBe(true);
      expect(result.calendar).toBeDefined();
      expect(result.calendar.items).toBeDefined();
      expect(Array.isArray(result.calendar.items)).toBe(true);
      expect(result.calendar.month).toBeDefined();
      expect(result.calendar.year).toBeDefined();
      
      // Verify calendar items have correct structure
      if (result.calendar.items.length > 0) {
        const firstItem = result.calendar.items[0];
        expect(firstItem).toHaveProperty('type');
        expect(firstItem).toHaveProperty('title');
        expect(firstItem).toHaveProperty('description');
        expect(firstItem).toHaveProperty('dueDate');
        expect(firstItem).toHaveProperty('keywords');
        expect(firstItem).toHaveProperty('priority');
      }
      
      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.basedOnInsights).toBe(true);
      
      // Event sending is skipped in test environment
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle missing credentials gracefully', async () => {
      mockSecretsManagerSend.mockRejectedValue(new Error('SecretNotFound'));
      
      await expect(GoogleAnalyticsHandler.getTopPages({
        propertyId: '123456789'
      })).rejects.toThrow('Failed to initialize Google Analytics');
    });

    test('should validate required parameters across all methods', async () => {
      // Test all methods that require propertyId
      await expect(GoogleAnalyticsHandler.getTopPages({}))
        .rejects.toThrow('propertyId is required');
      
      // Test all methods that require siteUrl  
      await expect(GoogleAnalyticsHandler.getSearchConsoleData({}))
        .rejects.toThrow('siteUrl is required');
      
      // Test methods that require both
      await expect(GoogleAnalyticsHandler.analyzeContentOpportunities({ propertyId: '123' }))
        .rejects.toThrow('propertyId and siteUrl are required');
        
      await expect(GoogleAnalyticsHandler.generateContentCalendar({ siteUrl: 'https://example.com' }))
        .rejects.toThrow('propertyId and siteUrl are required');
    });
  });

  describe('Service Initialization Integration', () => {
    test('should initialize service only once and reuse instance', async () => {
      // First call should initialize
      const service1 = await GoogleAnalyticsHandler.initialize();
      expect(service1).toBeDefined();
      expect(mockSecretsManagerSend).toHaveBeenCalledTimes(1);
      
      // Second call should reuse existing instance
      const service2 = await GoogleAnalyticsHandler.initialize();
      expect(service2).toBe(service1);
      expect(mockSecretsManagerSend).toHaveBeenCalledTimes(1); // No additional calls
      
      // Handler should maintain the same service instance
      expect(GoogleAnalyticsHandler.gaService).toBe(service1);
    });
  });
});