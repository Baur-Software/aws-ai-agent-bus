# Google Cloud Setup Guide for Google Analytics Integration

This guide walks you through setting up Google Cloud Console for Google Analytics API access in the AWS AI Agent Bus project.

## Overview

Google Cloud Console doesn't provide APIs for programmatic OAuth2 client creation, so you'll need to complete some steps manually. However, we've automated as much as possible with our setup scripts.

## Quick Start

Run our automated setup assistant:

```bash
npm run setup:ga-google-cloud
```

This script will guide you through the entire process and test your setup.

## Manual Setup Steps

If you prefer to do it manually or need to troubleshoot:

### 1. Create/Select Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID - you'll need it later

### 2. Enable Required APIs

Enable these APIs for your project:

1. **Google Analytics Reporting API**
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Google Analytics Reporting API"
   - Click "Enable"

2. **Google Analytics Data API** (for GA4)
   - Search for "Google Analytics Data API" 
   - Click "Enable"

### 3. Create OAuth2 Credentials

1. Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Configure the OAuth client:
   - **Name**: Something like "AWS AI Agent Bus - GA Integration"
   - **Authorized redirect URIs**: Add these URLs:
     - `http://localhost:3000/auth/google/callback`
     - `https://developers.google.com/oauthplayground`
5. Click "Create"
6. **Download the JSON file** - this contains your client credentials

### 4. Configure OAuth Consent Screen

1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose "External" user type (unless you have Google Workspace)
3. Fill out the required fields:
   - **App name**: "AWS AI Agent Bus"
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add scopes (optional for testing):
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`
5. Add test users:
   - Add your email address to the test users list
   - This allows you to use the app during development

### 5. Get Your Google Analytics Property ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Go to Admin (gear icon) → Property Settings
4. Your Property ID is shown at the top (format: `123456789`)

## Security Best Practices

### Credential Management

- **Never commit** the `client_secret_*.json` file to version control
- Store credentials securely in AWS Secrets Manager
- Use environment variables for configuration
- Rotate credentials periodically

### OAuth2 Security

- **Restrict your OAuth2 client**:
  - Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
  - Click on your OAuth2 client
  - Add application restrictions if needed
- **Use HTTPS** in production (localhost is exempt)
- **Validate redirect URIs** match your application

### API Security  

- **Restrict API keys** if you create any:
  - Add both application restrictions (HTTP referrers/IP addresses)
  - Add API restrictions (limit to specific APIs)
- **Monitor usage** in the Google Cloud Console
- **Set up quotas** to prevent unexpected charges

## Troubleshooting

### Common Issues

**"Invalid client" error**
- Check that your client ID and secret are correct
- Verify the redirect URI matches exactly
- Ensure the OAuth consent screen is configured

**"Access denied" error**  
- Add your email to test users in OAuth consent screen
- Check that required APIs are enabled
- Verify the scopes in your request

**"Redirect URI mismatch"**
- Ensure redirect URIs in your code match those in Google Cloud Console
- URLs must match exactly (including protocols and ports)

**"Property not found"**
- Verify your GA4 Property ID is correct (numeric only)
- Check that your Google account has access to the property
- Ensure you're using GA4, not Universal Analytics

### Getting Help

1. Check the [Google Analytics API documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
2. Review [OAuth2 troubleshooting guide](https://developers.google.com/identity/protocols/oauth2/web-server#troubleshooting)  
3. Create an issue in our [GitHub repository](https://github.com/Baur-Software/aws-ai-agent-bus/issues)

## Integration with AWS

Once you have your Google Cloud credentials:

1. **Option 1: Use our setup script**
   ```bash
   npm run setup:ga-credentials
   ```

2. **Option 2: Manual AWS Secrets Manager**
   ```bash
   aws secretsmanager create-secret \
     --name "spalding-content-pipeline/google-analytics" \
     --description "Google Analytics API credentials" \
     --secret-string '{
       "client_id": "your-client-id",
       "client_secret": "your-client-secret", 
       "access_token": "your-access-token",
       "refresh_token": "your-refresh-token",
       "property_id": "your-property-id"
     }'
   ```

## Testing Your Setup

Run a test report to verify everything works:

```bash
# Test with live data (requires credentials)
npm run report:users-by-country

# Test with sample data (no credentials needed)  
npm run report:users-by-country-sample
```

## Next Steps

- Set up automated reporting schedules
- Configure data exports to S3
- Set up EventBridge rules for data processing
- Explore advanced analytics queries

---

For more information, see:
- [Main Documentation](../README.md)
- [Google Analytics Setup](./google-analytics-setup.md)
- [AWS Integration Guide](./aws-integration.md)