# Google Analytics Setup with AWS Secrets Manager

This guide walks you through setting up Google Analytics credentials in AWS Secrets Manager for secure access to the Google Analytics Data API and Search Console API.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Access to Google Cloud Console
- A Google Analytics 4 property
- Access to Google Search Console

## Step 1: Create Google Cloud Project & OAuth2 Credentials

### 1.1 Create Google Cloud Project

```bash
# Login to Google Cloud (if not already)
gcloud auth login

# Create new project (or use existing)
gcloud projects create your-project-id --name="Analytics API Project"
gcloud config set project your-project-id
```

### 1.2 Enable Required APIs

```bash
# Enable Google Analytics Data API
gcloud services enable analyticsdata.googleapis.com

# Enable Google Search Console API  
gcloud services enable searchconsole.googleapis.com
```

### 1.3 Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure consent screen if prompted:
   - **User Type**: External (for testing) or Internal (for organization)
   - **Application name**: Your app name
   - **Scopes**: Add these scopes:
     - `https://www.googleapis.com/auth/analytics.readonly`
     - `https://www.googleapis.com/auth/webmasters.readonly`
6. Create OAuth2 Client:
   - **Application type**: Web application
   - **Name**: Analytics MCP Client
   - **Authorized redirect URIs**: 
     - `https://www.yourdomain.com` (from route53 setup)
     - `http://localhost:3000/auth/callback` (for local testing)

7. Download the JSON credentials file

## Step 2: Get Access & Refresh Tokens

### 2.1 Create Token Exchange Script

Create a temporary script to get your tokens:

```javascript
// get-tokens.js
import { google } from 'googleapis';
import http from 'http';
import url from 'url';

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/auth/callback'
);

const scopes = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly'
];

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent' // Forces refresh_token generation
});

console.log('Visit this URL to authorize the application:');
console.log(authUrl);

// Simple HTTP server to capture callback
const server = http.createServer(async (req, res) => {
  const queryObject = url.parse(req.url, true).query;
  
  if (queryObject.code) {
    try {
      const { tokens } = await oauth2Client.getAccessToken(queryObject.code);
      console.log('\nTokens received:');
      console.log(JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        client_id: 'YOUR_CLIENT_ID',
        client_secret: 'YOUR_CLIENT_SECRET'
      }, null, 2));
      
      res.end('Authorization successful! Check your console for tokens.');
      server.close();
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.end('Authorization failed!');
      server.close();
    }
  }
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
```

### 2.2 Run Token Exchange

```bash
# Replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET in the script above
node get-tokens.js

# Follow the authorization URL
# Copy the tokens from console output
```

## Step 3: Store Credentials in AWS Secrets Manager

### 3.1 Create the Secret

```bash
# Create secret with Google Analytics credentials
aws secretsmanager create-secret \
    --name "spalding-content-pipeline/google-analytics" \
    --description "Google Analytics API credentials for MCP server" \
    --secret-string '{
      "client_id": "your-client-id.apps.googleusercontent.com",
      "client_secret": "your-client-secret",
      "access_token": "ya29.your-access-token",
      "refresh_token": "1//your-refresh-token",
      "property_id": "properties/123456789"
    }'
```

### 3.2 Verify Secret Creation

```bash
# Test secret retrieval
aws secretsmanager get-secret-value \
    --secret-id "spalding-content-pipeline/google-analytics" \
    --query SecretString --output text | jq .
```

### 3.3 Set Required IAM Permissions

Create an IAM policy for accessing the secret:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "arn:aws:secretsmanager:us-east-1:*:secret:spalding-content-pipeline/google-analytics-*"
            ]
        }
    ]
}
```

Attach this policy to your EC2 instance role, Lambda execution role, or user.

## Step 4: Find Your Google Analytics Property ID

### 4.1 Via Google Analytics Web Interface

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property
3. Click **Admin** (gear icon)
4. Under **Property** column, click **Property Settings**
5. Copy the **Property ID** (format: `123456789`)

### 4.2 Via API (Alternative)

```javascript
// list-properties.js
import { google } from 'googleapis';

const auth = new google.auth.OAuth2(
  'your-client-id',
  'your-client-secret'
);

auth.setCredentials({
  access_token: 'your-access-token',
  refresh_token: 'your-refresh-token'
});

const analyticsadmin = google.analyticsadmin({ version: 'v1alpha', auth });

async function listProperties() {
  try {
    const response = await analyticsadmin.properties.list();
    console.log('Available properties:');
    response.data.properties?.forEach(property => {
      console.log(`- ${property.displayName}: ${property.name}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listProperties();
```

## Step 5: Test the Setup

### 5.1 Test with Sample Report

```bash
cd /path/to/aws-ai-agent-bus
npm run report:users-by-country
```

Expected output:
```
Starting users by country report...
Initializing Google Analytics service...
Using AWS region: us-east-1
Fetching unique users by country report...

=== UNIQUE USERS BY COUNTRY - LAST 30 DAYS ===
[Report data...]
```

### 5.2 Common Issues & Solutions

**Issue**: `Could not load credentials from any providers`
```bash
# Solution: Configure AWS credentials
aws configure

# Or export environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

**Issue**: `Failed to initialize Google Analytics: Invalid credentials`
```bash
# Solution: Verify secret format and refresh tokens
aws secretsmanager update-secret \
    --secret-id "spalding-content-pipeline/google-analytics" \
    --secret-string '{...updated credentials...}'
```

**Issue**: `Property ID not found`
```bash
# Solution: Verify property ID format
# Should be just the number: "123456789"
# Not the full path: "properties/123456789"
```

## Step 6: Production Considerations

### 6.1 Secret Rotation

Set up automatic secret rotation for security:

```bash
aws secretsmanager update-secret \
    --secret-id "spalding-content-pipeline/google-analytics" \
    --description "Google Analytics API credentials with auto-rotation" \
    --rotation-lambda-arn "arn:aws:lambda:us-east-1:account:function:rotate-ga-credentials" \
    --rotation-rules AutomaticallyAfterDays=90
```

### 6.2 Cross-Region Replication

For multi-region deployments:

```bash
aws secretsmanager replicate-secret-to-regions \
    --secret-id "spalding-content-pipeline/google-analytics" \
    --add-replica-regions Region=us-west-2,KmsKeyId=alias/aws/secretsmanager \
    --add-replica-regions Region=eu-west-1,KmsKeyId=alias/aws/secretsmanager
```

### 6.3 Monitoring

Add CloudWatch alarms for secret access:

```bash
aws logs create-log-group --log-group-name /aws/secretsmanager/google-analytics
```

## Security Best Practices

1. **Principle of Least Privilege**: Only grant `secretsmanager:GetSecretValue` permission
2. **Network Security**: Use VPC endpoints for Secrets Manager access
3. **Audit Logging**: Enable CloudTrail for secret access monitoring
4. **Token Rotation**: Refresh tokens periodically (Google tokens expire)
5. **Environment Separation**: Use separate secrets for dev/staging/prod

## Troubleshooting

### Debug Secret Access

```javascript
// debug-secret.js
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function testSecret() {
  try {
    const response = await client.send(new GetSecretValueCommand({
      SecretId: 'spalding-content-pipeline/google-analytics'
    }));
    
    const credentials = JSON.parse(response.SecretString);
    console.log('Secret retrieved successfully');
    console.log('Has client_id:', !!credentials.client_id);
    console.log('Has refresh_token:', !!credentials.refresh_token);
    console.log('Property ID:', credentials.property_id);
  } catch (error) {
    console.error('Error accessing secret:', error.message);
  }
}

testSecret();
```

### Validate Google Analytics Access

```javascript
// validate-ga-access.js
import { GoogleAnalyticsService } from './src/services/google-analytics.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function validateAccess() {
  const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await secretsClient.send(new GetSecretValueCommand({
    SecretId: 'spalding-content-pipeline/google-analytics'
  }));
  
  const credentials = JSON.parse(response.SecretString);
  const gaService = new GoogleAnalyticsService();
  
  await gaService.initialize(credentials);
  const metadata = await gaService.getPropertyDetails(credentials.property_id);
  
  console.log('✅ Google Analytics access validated');
  console.log('Property:', metadata.name);
}

validateAccess().catch(console.error);
```

This setup ensures your Google Analytics credentials are securely stored and accessible to your MCP server while following AWS security best practices.