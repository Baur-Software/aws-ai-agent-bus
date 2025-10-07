# MCP Server API Documentation

## Overview

The Agent Mesh MCP Server exposes tools through the Model Context Protocol for AI assistants to interact with AWS services and Google Analytics. All tools follow MCP standard conventions and provide comprehensive error handling.

## Available Tools

### 🔑 Key-Value Storage

#### `mcp__aws__kv_get`

Retrieve a value from DynamoDB by key.

**Parameters:**

- `key` (string, required): The key to retrieve

**Returns:**

```json
{
  "value": "stored-data",
  "ttl": 1693420800,
  "created_at": "2024-08-30T12:00:00Z"
}
```

**Example:**

```javascript
await mcpClient.request({
  method: 'tools/call',
  params: {
    name: 'mcp__aws__kv_get',
    arguments: { key: 'user-preferences' }
  }
});
```

#### `mcp__aws__kv_set`

Store a value in DynamoDB with optional TTL.

**Parameters:**

- `key` (string, required): The key to store
- `value` (string, required): The value to store
- `ttl_hours` (number, optional): Time to live in hours (default: 24)

**Returns:**

```json
{
  "success": true,
  "key": "user-preferences", 
  "expires_at": "2024-08-31T12:00:00Z"
}
```

### 🗂️ Artifact Management

#### `mcp__aws__artifacts_list`

List artifacts in S3 with optional prefix filtering.

**Parameters:**

- `prefix` (string, optional): Filter artifacts by prefix

**Returns:**

```json
{
  "artifacts": [
    {
      "key": "reports/2024/analytics.pdf",
      "size": 1024000,
      "lastModified": "2024-08-30T12:00:00Z",
      "contentType": "application/pdf"
    }
  ],
  "count": 1
}
```

#### `mcp__aws__artifacts_get`

Download an artifact from S3.

**Parameters:**

- `key` (string, required): The artifact key

**Returns:**

```json
{
  "content": "base64-encoded-content",
  "contentType": "application/pdf",
  "size": 1024000,
  "metadata": {
    "uploadedBy": "user@example.com",
    "version": "1.0"
  }
}
```

#### `mcp__aws__artifacts_put`

Upload an artifact to S3.

**Parameters:**

- `key` (string, required): The artifact key
- `content` (string, required): The content to store
- `content_type` (string, optional): MIME type (default: "text/plain")

**Returns:**

```json
{
  "success": true,
  "key": "documents/report.pdf",
  "url": "https://presigned-url-for-access",
  "size": 1024000
}
```

### 📊 Google Analytics

#### `mcp__aws__ga_getTopPages`

Get top performing pages from Google Analytics.

**Parameters:**

- `propertyId` (string, required): GA4 property ID
- `days` (number, optional): Number of days to analyze (default: 30)

**Returns:**

```json
{
  "success": true,
  "data": [
    {
      "pagePath": "/blog/post-1",
      "pageTitle": "How to Use Google Analytics",
      "sessions": 1500,
      "pageviews": 2100,
      "averageSessionDuration": 180,
      "bounceRate": 0.45
    }
  ],
  "metadata": {
    "propertyId": "properties/123456789",
    "days": 30,
    "retrievedAt": "2024-08-30T12:00:00Z"
  }
}
```

#### `mcp__aws__ga_getSearchConsoleData`

Get Search Console keyword data.

**Parameters:**

- `siteUrl` (string, required): Website URL in Search Console  
- `days` (number, optional): Number of days to analyze (default: 30)

**Returns:**

```json
{
  "success": true,
  "data": [
    {
      "query": "google analytics tutorial",
      "page": "/blog/analytics-guide",
      "clicks": 245,
      "impressions": 1200,
      "ctr": 0.204,
      "position": 5.2
    }
  ],
  "metadata": {
    "siteUrl": "https://example.com",
    "days": 30,
    "retrievedAt": "2024-08-30T12:00:00Z"
  }
}
```

#### `mcp__aws__ga_analyzeContentOpportunities`

Analyze content opportunities combining GA and Search Console data.

**Parameters:**

- `propertyId` (string, required): GA4 property ID
- `siteUrl` (string, required): Website URL in Search Console

**Returns:**

```json
{
  "success": true,
  "insights": {
    "topPerformingContent": [
      {
        "pagePath": "/blog/tutorial",
        "pageTitle": "Complete Tutorial",
        "sessions": 2500,
        "opportunity": "high"
      }
    ],
    "keywordOpportunities": [
      {
        "query": "tutorial guide",
        "impressions": 5000,
        "position": 12.5,
        "opportunity": "medium"
      }
    ],
    "contentGaps": [
      {
        "query": "advanced tutorial",
        "impressions": 3000,
        "ctr": 0.02,
        "recommendation": "Create comprehensive content"
      }
    ],
    "seasonalTrends": {
      "message": "Seasonal analysis requires historical data",
      "recommendation": "Run monthly reports to build patterns"
    }
  },
  "metadata": {
    "analysisDate": "2024-08-30T12:00:00Z",
    "nextAnalysisRecommended": "2024-09-30T12:00:00Z"
  }
}
```

#### `mcp__aws__ga_generateContentCalendar`

Generate a monthly content calendar based on analytics insights.

**Parameters:**

- `propertyId` (string, required): GA4 property ID
- `siteUrl` (string, required): Website URL in Search Console
- `targetMonth` (string, optional): Target month in YYYY-MM format

**Returns:**

```json
{
  "success": true,
  "calendar": {
    "month": 9,
    "year": 2024,
    "items": [
      {
        "type": "pillar",
        "title": "Expand on: Popular Tutorial",
        "description": "Create comprehensive content based on high-performing page",
        "dueDate": "2024-09-07T00:00:00.000Z",
        "keywords": ["high-performing", "expansion"],
        "priority": "high"
      },
      {
        "type": "social",
        "title": "Target keyword: analytics tutorial",
        "description": "Create social content targeting this keyword opportunity",
        "dueDate": "2024-09-06T00:00:00.000Z",
        "keywords": ["analytics tutorial"],
        "priority": "medium",
        "platform": "linkedin"
      }
    ]
  },
  "metadata": {
    "generatedAt": "2024-08-30T12:00:00Z",
    "targetMonth": "2024-09",
    "basedOnInsights": true
  }
}
```

### 📧 Event Management

#### `mcp__aws__events_send`

Send an event to EventBridge.

**Parameters:**

- `detailType` (string, required): The event type
- `detail` (object, required): Event details
- `source` (string, optional): Event source (default: "mcp-client")

**Returns:**

```json
{
  "eventId": "12345678-1234-5678-9012-123456789012",
  "success": true,
  "timestamp": "2024-08-30T12:00:00Z"
}
```

### 🔄 Workflow Management

#### `mcp__aws__workflow_start`

Start a Step Functions workflow.

**Parameters:**

- `name` (string, required): The workflow name
- `input` (object, optional): Input data for the workflow

**Returns:**

```json
{
  "executionArn": "arn:aws:states:us-west-2:123456789012:execution:MyWorkflow:execution-name",
  "startDate": "2024-08-30T12:00:00Z",
  "success": true
}
```

#### `mcp__aws__workflow_status`

Get workflow execution status.

**Parameters:**

- `executionArn` (string, required): The execution ARN

**Returns:**

```json
{
  "status": "RUNNING",
  "input": "{}",
  "output": null,
  "startDate": "2024-08-30T12:00:00Z",
  "stopDate": null,
  "error": null
}
```

## Error Handling

All tools return consistent error structures:

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The parameter 'key' is required",
    "details": {
      "parameter": "key",
      "provided": null
    }
  },
  "success": false
}
```

### Common Error Codes

- `INVALID_PARAMETER`: Required parameter missing or invalid
- `NOT_FOUND`: Requested resource not found
- `ACCESS_DENIED`: Insufficient permissions
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server-side error

## Authentication

### AWS Services

AWS services use IAM roles and credentials. Ensure your environment has:

- Appropriate IAM permissions for DynamoDB, S3, EventBridge, Step Functions
- AWS CLI configured or instance/container role

### Google Analytics

Requires OAuth2 setup with service account or web application credentials:

- Service account: Requires `private_key` and `client_email`
- OAuth2: Requires `access_token` and `refresh_token`

Credentials are managed through AWS Secrets Manager with key: `myproject-content-pipeline/google-analytics`

## Rate Limits

- **Google Analytics**: 100 requests/100 seconds per property
- **Search Console**: 1,200 requests/minute
- **AWS Services**: Follow standard AWS service limits

## Best Practices

1. **Caching**: Results are cached when appropriate to reduce API calls
2. **Pagination**: Large datasets are automatically paginated
3. **Error Resilience**: All operations have retry logic with exponential backoff
4. **Monitoring**: All operations emit CloudWatch metrics and EventBridge events
5. **Security**: Sensitive data is encrypted at rest and in transit
