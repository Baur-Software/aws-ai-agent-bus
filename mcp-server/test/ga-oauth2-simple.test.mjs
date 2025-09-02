import { jest, describe, test, expect } from '@jest/globals';
import { GoogleAnalyticsService } from '../src/services/google-analytics.js';

describe('Google Analytics OAuth2 Integration', () => {
  const mockOAuth2Credentials = {
    "client_id": "1077763346413-s7u1tgi1e0rgcf60ip1qome4pl401tso.apps.googleusercontent.com",
    "client_secret": "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",
    "project_id": "baursoftware-1756252326734",
    "redirect_uris": ["https://www.baursoftware.com"],
    "access_token": "mock_access_token_for_testing",
    "refresh_token": "mock_refresh_token_for_testing"
  };

  test('should initialize GoogleAnalyticsService with OAuth2 credentials', async () => {
    const service = new GoogleAnalyticsService();
    
    // Should not throw an error
    await expect(service.initialize(mockOAuth2Credentials)).resolves.toBe(true);
    
    // Should have initialized the required components
    expect(service.auth).toBeDefined();
    expect(service.analytics).toBeDefined();
    expect(service.searchconsole).toBeDefined();
    
    // Should use OAuth2Client for OAuth2 credentials
    expect(service.auth.constructor.name).toBe('OAuth2Client');
  });

  test('should detect OAuth2 vs Service Account credentials', async () => {
    const service1 = new GoogleAnalyticsService();
    
    // Test OAuth2 credentials (has access_token)
    await service1.initialize(mockOAuth2Credentials);
    expect(service1.auth.constructor.name).toBe('OAuth2Client');
    
    // Test Service Account credentials (has private_key)
    const serviceAccountCreds = {
      type: "service_account",
      project_id: "test-project",
      private_key: "-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----",
      client_email: "test@test-project.iam.gserviceaccount.com"
    };
    
    const service2 = new GoogleAnalyticsService();
    await service2.initialize(serviceAccountCreds);
    expect(service2.auth.constructor.name).toBe('GoogleAuth');
  });

  test('should set OAuth2 credentials correctly', async () => {
    const service = new GoogleAnalyticsService();
    await service.initialize(mockOAuth2Credentials);
    
    // Check that credentials are set on the OAuth2 client
    expect(service.auth.credentials).toBeDefined();
    expect(service.auth.credentials.access_token).toBe('mock_access_token_for_testing');
    expect(service.auth.credentials.refresh_token).toBe('mock_refresh_token_for_testing');
  });

  test('should generate valid authorization URL for OAuth2 setup', async () => {
    const { OAuth2Client } = await import('google-auth-library');
    
    const oauth2Client = new OAuth2Client(
      mockOAuth2Credentials.client_id,
      mockOAuth2Credentials.client_secret,
      mockOAuth2Credentials.redirect_uris[0]
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly'
      ],
      prompt: 'consent'
    });

    expect(authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
    expect(authUrl).toContain(mockOAuth2Credentials.client_id);
    expect(authUrl).toContain('analytics.readonly');
    expect(authUrl).toContain('webmasters.readonly');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('prompt=consent');
  });
});