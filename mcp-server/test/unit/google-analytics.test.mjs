import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock Google APIs to prevent SSL errors
jest.mock('googleapis', () => ({
  google: {
    analyticsdata: jest.fn(() => ({
      properties: {
        runReport: jest.fn().mockResolvedValue({
          data: {
            rows: [
              {
                dimensionValues: [{ value: '/test' }, { value: 'Test Page' }],
                metricValues: [{ value: '100' }, { value: '200' }]
              }
            ],
            dimensionHeaders: [{ name: 'pagePath' }, { name: 'pageTitle' }],
            metricHeaders: [{ name: 'sessions' }, { value: 'pageviews' }]
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
                keys: ['test query', '/test-page'],
                clicks: 10,
                impressions: 100,
                ctr: 0.1,
                position: 5
              }
            ]
          }
        })
      }
    }))
  }
}));

// Mock Google Auth
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({})),
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    credentials: {}
  }))
}));

// Mock AWS Secrets Manager
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

// Import after mocking
const { GoogleAnalyticsHandler } = await import('../../src/modules/mcp/handlers/google-analytics.js');

describe('Google Analytics Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set test environment to skip event sending
    process.env.NODE_ENV = 'test';
    
    // Reset static properties
    GoogleAnalyticsHandler.gaService = null;
    
    // Mock secrets manager response
    mockSecretsManagerSend.mockResolvedValue({
      SecretString: JSON.stringify({
        type: 'service_account',
        client_email: 'test@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n'
      })
    });
  });

  describe('initialization', () => {
    test('should initialize Google Analytics service with credentials', async () => {
      const service = await GoogleAnalyticsHandler.initialize();
      
      expect(mockSecretsManagerSend).toHaveBeenCalled();
      expect(service).toBeDefined();
      expect(GoogleAnalyticsHandler.gaService).toBeDefined();
    });

    test('should reuse existing service instance', async () => {
      // First call
      await GoogleAnalyticsHandler.initialize();
      const callCount1 = mockSecretsManagerSend.mock.calls.length;
      
      // Second call should reuse
      await GoogleAnalyticsHandler.initialize();
      const callCount2 = mockSecretsManagerSend.mock.calls.length;
      
      expect(callCount2).toBe(callCount1); // No additional calls
    });

    test('should throw error when secrets retrieval fails', async () => {
      mockSecretsManagerSend.mockRejectedValue(new Error('Secret not found'));
      
      await expect(GoogleAnalyticsHandler.initialize()).rejects.toThrow('Failed to initialize Google Analytics');
    });
  });

  describe('getTopPages', () => {
    test('should get top pages successfully', async () => {
      const result = await GoogleAnalyticsHandler.getTopPages({
        propertyId: '12345',
        days: 30
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata.propertyId).toBe('12345');
      
      // Event sending is skipped in test environment
    });

    test('should throw error when propertyId is missing', async () => {
      await expect(GoogleAnalyticsHandler.getTopPages({})).rejects.toThrow('propertyId is required');
    });
  });

  describe('getSearchConsoleData', () => {
    test('should get search console data successfully', async () => {
      const result = await GoogleAnalyticsHandler.getSearchConsoleData({
        siteUrl: 'https://example.com',
        days: 30
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata.siteUrl).toBe('https://example.com');
      
      // Event sending is skipped in test environment
    });

    test('should throw error when siteUrl is missing', async () => {
      await expect(GoogleAnalyticsHandler.getSearchConsoleData({})).rejects.toThrow('siteUrl is required');
    });
  });

  describe('runReport', () => {
    test('should run custom report successfully', async () => {
      const reportRequest = {
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }]
      };

      const result = await GoogleAnalyticsHandler.runReport({
        propertyId: '12345',
        reportRequest
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata.propertyId).toBe('12345');
      expect(result.metadata.reportType).toBe('custom');
    });

    test('should throw error when required parameters are missing', async () => {
      await expect(GoogleAnalyticsHandler.runReport({ propertyId: '12345' })).rejects.toThrow('propertyId and reportRequest are required');
      await expect(GoogleAnalyticsHandler.runReport({ reportRequest: {} })).rejects.toThrow('propertyId and reportRequest are required');
    });
  });

  describe('analyzeContentOpportunities', () => {
    test('should analyze content opportunities successfully', async () => {
      const result = await GoogleAnalyticsHandler.analyzeContentOpportunities({
        propertyId: '12345',
        siteUrl: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.insights).toBeDefined();
      expect(result.metadata.propertyId).toBe('12345');
      expect(result.metadata.siteUrl).toBe('https://example.com');
      
      // Event sending is skipped in test environment
    });

    test('should throw error when required parameters are missing', async () => {
      await expect(GoogleAnalyticsHandler.analyzeContentOpportunities({ propertyId: '12345' }))
        .rejects.toThrow('propertyId and siteUrl are required');
      await expect(GoogleAnalyticsHandler.analyzeContentOpportunities({ siteUrl: 'https://example.com' }))
        .rejects.toThrow('propertyId and siteUrl are required');
    });
  });

  describe('generateContentCalendar', () => {
    test('should generate content calendar successfully', async () => {
      const result = await GoogleAnalyticsHandler.generateContentCalendar({
        propertyId: '12345',
        siteUrl: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.calendar).toBeDefined();
      expect(result.calendar.items).toBeDefined();
      expect(Array.isArray(result.calendar.items)).toBe(true);
      
      // Event sending is skipped in test environment
    });

    test('should throw error when required parameters are missing', async () => {
      await expect(GoogleAnalyticsHandler.generateContentCalendar({ propertyId: '12345' }))
        .rejects.toThrow('propertyId and siteUrl are required');
      await expect(GoogleAnalyticsHandler.generateContentCalendar({ siteUrl: 'https://example.com' }))
        .rejects.toThrow('propertyId and siteUrl are required');
    });
  });

  describe('buildContentCalendar', () => {
    test('should build calendar with pillar, social, and blog content', () => {
      const mockInsights = {
        topPerformingContent: [
          { pagePath: '/test', pageTitle: 'Test Page', sessions: 100 }
        ],
        keywordOpportunities: [
          { query: 'test keyword', impressions: 150, position: 15 }
        ],
        contentGaps: [
          { query: 'content gap', impressions: 200, ctr: 0.03 }
        ]
      };

      const calendar = GoogleAnalyticsHandler.buildContentCalendar(mockInsights);

      expect(calendar.items).toBeDefined();
      expect(Array.isArray(calendar.items)).toBe(true);
      expect(calendar.month).toBeDefined();
      expect(calendar.year).toBeDefined();
      
      // Should have items of different types
      const types = calendar.items.map(item => item.type);
      expect(types).toContain('pillar');
      expect(types).toContain('social');
      expect(types).toContain('blog');
    });

    test('should handle empty insights gracefully', () => {
      const emptyInsights = {
        topPerformingContent: [],
        keywordOpportunities: [],
        contentGaps: []
      };

      const calendar = GoogleAnalyticsHandler.buildContentCalendar(emptyInsights);

      expect(calendar.items).toBeDefined();
      expect(Array.isArray(calendar.items)).toBe(true);
      expect(calendar.items.length).toBe(0);
    });
  });
});