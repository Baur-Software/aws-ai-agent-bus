# MCP Server Setup Guide

## Overview

This guide covers complete setup of the Agent Mesh MCP Server including AWS infrastructure, Google Analytics OAuth2 authentication, and development environment configuration.

## Prerequisites

### System Requirements

- **Node.js**: 18.x LTS or higher
- **npm**: 8.0.0 or higher
- **AWS CLI**: 2.x configured with appropriate permissions
- **Terraform**: 1.0+ (for infrastructure deployment)

### AWS Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem", 
        "dynamodb:Query",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "events:PutEvents",
        "states:StartExecution",
        "states:DescribeExecution",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd aws-ai-agent-bus/mcp-server

# Install dependencies
npm install

# Run tests to verify setup
npm test
```

### 2. Environment Configuration

Create your environment file:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_PROFILE=your-aws-profile

# MCP Server Resources
DYNAMODB_TABLE=agent-mesh-dev-kv
S3_BUCKET=agent-mesh-dev-artifacts
EVENT_BUS_NAME=agent-mesh-dev
STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::123456789012:role/StepFunctionsRole

# Google Analytics (optional)
GOOGLE_ANALYTICS_SECRET=myproject-content-pipeline/google-analytics

# Development
NODE_ENV=development
LOG_LEVEL=info
```

### 3. AWS Infrastructure Setup

#### Option A: Use Existing Infrastructure

If you have AWS resources already deployed, update `.env` with your resource names.

#### Option B: Deploy with Terraform

```bash
# Navigate to infrastructure
cd ../infra

# Deploy core services
terraform init
terraform workspace new dev
terraform plan -var="environment=dev"
terraform apply -auto-approve -var="environment=dev"

# Update .env with deployed resource names
```

### 4. Start the Server

```bash
# Stdio interface (for MCP clients)
npm start

# HTTP interface (for web integrations)  
npm run start:http

# Development mode with hot reload
npm run dev
```

## Google Analytics OAuth2 Setup

### Step 1: Google Cloud Console Configuration

1. **Create/Select Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing: `your-project-name`

2. **Enable APIs**

   ```bash
   # Enable required APIs
   gcloud services enable analyticsdata.googleapis.com
   gcloud services enable searchconsole.googleapis.com
   ```

3. **Create OAuth2 Credentials**
   - Navigate to **APIs & Credentials > Credentials**
   - Click **Create Credentials > OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://your-domain.com/auth/callback`

### Step 2: OAuth2 Flow Implementation

#### Web Application Credentials

For server-to-server access, use service account credentials:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@your-project.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

#### OAuth2 Web Flow (Interactive)

For user-authenticated access:

1. **Generate Authorization URL**

   ```javascript
   const authUrl = oauth2Client.generateAuthUrl({
     access_type: 'offline',
     scope: [
       'https://www.googleapis.com/auth/analytics.readonly',
       'https://www.googleapis.com/auth/webmasters.readonly'
     ],
     prompt: 'consent'
   });
   ```

2. **Exchange Authorization Code**

   ```javascript
   const { tokens } = await oauth2Client.getToken(authorizationCode);
   oauth2Client.setCredentials(tokens);
   ```

3. **Store Tokens Securely**

   ```json
   {
     "client_id": "your-client-id",
     "client_secret": "your-client-secret",
     "access_token": "access-token-from-flow",
     "refresh_token": "refresh-token-from-flow",
     "scope": "analytics.readonly webmasters.readonly",
     "token_type": "Bearer",
     "expiry_date": 1693420800000
   }
   ```

### Step 3: AWS Secrets Manager Storage

Store your Google Analytics credentials in AWS Secrets Manager:

```bash
# Create secret with service account credentials
aws secretsmanager create-secret \
  --name "myproject-content-pipeline/google-analytics" \
  --description "Google Analytics API credentials" \
  --secret-string file://google-credentials.json

# Or update existing secret
aws secretsmanager update-secret \
  --secret-id "myproject-content-pipeline/google-analytics" \
  --secret-string file://google-credentials.json
```

### Step 4: Grant Analytics Access

1. **Google Analytics**
   - Add service account email to GA4 property as **Viewer**
   - Property Admin > Property Settings > Property Access Management

2. **Search Console**
   - Add service account email to Search Console property as **Owner** or **Full User**
   - Search Console > Settings > Users and Permissions

## Development Environment

### Local Development Setup

```bash
# Install development dependencies
npm install --include=dev

# Run in development mode
npm run dev

# Run tests with coverage
npm test

# Run specific test suites
npm run test:unit
npm run test:integration

# Lint code
npm run lint
```

### Docker Development

```bash
# Build development container
docker build -f Dockerfile.dev -t mcp-server:dev .

# Run with AWS credentials
docker run -it \
  -v ~/.aws:/root/.aws:ro \
  -v $(pwd):/app \
  -p 3000:3000 \
  mcp-server:dev npm run dev
```

### Testing OAuth2 Integration

Test your Google Analytics setup:

```bash
# Run OAuth2 validation tests
npm run test:oauth2

# Test specific GA functionality
node -e "
import { GoogleAnalyticsService } from './src/services/google-analytics.js';
const ga = new GoogleAnalyticsService();
const credentials = /* your credentials */;
await ga.initialize(credentials);
console.log('✅ Google Analytics connected successfully');
"
```

## Production Deployment

### Environment Variables

```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=warn

# AWS Resources (production names)
DYNAMODB_TABLE=agent-mesh-prod-kv
S3_BUCKET=agent-mesh-prod-artifacts
EVENT_BUS_NAME=agent-mesh-prod

# Security
GOOGLE_ANALYTICS_SECRET=prod/google-analytics
```

### Health Checks

The server provides health check endpoints:

```bash
# HTTP server health
curl http://localhost:3000/health

# MCP server info
curl http://localhost:3000/info
```

### Monitoring

Enable CloudWatch monitoring:

```bash
# Environment variables for monitoring
ENABLE_METRICS=true
METRICS_NAMESPACE=AgentMesh/MCP
CLOUDWATCH_LOGS_GROUP=/aws/mcp/agent-mesh
```

## Troubleshooting

### Common Issues

#### 1. AWS Credentials Not Found

```bash
# Check AWS credentials
aws sts get-caller-identity

# Configure if needed
aws configure --profile your-profile
```

#### 2. Google Analytics Access Denied

- Verify service account has proper permissions
- Check credentials in Secrets Manager
- Ensure APIs are enabled in Google Cloud Console

#### 3. DynamoDB Access Issues

```bash
# Test DynamoDB access
aws dynamodb describe-table --table-name agent-mesh-dev-kv

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
  --action-names dynamodb:GetItem \
  --resource-arns "arn:aws:dynamodb:*:*:table/agent-mesh-dev-kv"
```

#### 4. EventBridge Events Not Delivered

- Verify EventBridge bus exists
- Check IAM permissions for `events:PutEvents`
- Review CloudWatch Logs for errors

### Debug Mode

Enable detailed logging:

```bash
# Start with debug logging
DEBUG=* npm start

# Or specific modules
DEBUG=mcp:*,aws:* npm start
```

### Getting Help

1. **Check logs**: `docker logs <container-id>` or application logs
2. **Run tests**: `npm test` to verify functionality  
3. **Check issues**: GitHub issues for known problems
4. **AWS Support**: For AWS service-specific issues

## Next Steps

After setup, refer to:

- [API Documentation](./API.md) for tool usage
- [Examples](../examples/) for integration patterns
- [Contributing Guide](../CONTRIBUTING.md) for development

## Security Considerations

1. **Credentials**: Never commit credentials to version control
2. **IAM**: Use least-privilege principle for AWS permissions
3. **Secrets**: Store all sensitive data in AWS Secrets Manager
4. **Network**: Use VPC endpoints for AWS service communication in production
5. **Logging**: Ensure no sensitive data appears in logs
