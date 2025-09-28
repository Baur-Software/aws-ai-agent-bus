# Error Handling System

## Overview

The dashboard-server now includes a robust error handling system that categorizes errors and provides user-friendly messages while protecting infrastructure details.

## How It Works

### Error Categories

1. **Infrastructure**: AWS service issues, auth failures, missing resources
2. **User Error**: Invalid input, validation failures
3. **Authentication**: Auth/permission issues
4. **Business Logic**: Application-specific errors
5. **External Service**: Third-party API failures
6. **System Error**: Internal system failures

### Error Flow

```
Backend Error → ErrorHandler.categorizeError() → User-Safe Message → UI Notification
                                               → Detailed Logging → EventBridge (if needed)
```

## Examples

### Before (Raw AWS Error)
```json
{
  "error": "AccessDenied: User: arn:aws:iam::123456789012:user/demo is not authorized to perform: dynamodb:DescribeTable on resource: arn:aws:dynamodb:us-west-2:123456789012:table/agent-mesh-kv"
}
```

### After (Categorized Error)
**To User:**
```json
{
  "error": {
    "message": "Service temporarily unavailable. Our team has been notified.",
    "category": "infrastructure",
    "shouldRetry": false
  }
}
```

**In Logs:**
```
⚠️ WARNING [AWS_AUTH_ERROR]: AWS Auth Error: AccessDenied: User: arn:aws:iam::123456789012:user/demo is not authorized...
```

**In EventBridge:**
```json
{
  "detailType": "Infrastructure Error",
  "detail": {
    "category": "infrastructure",
    "severity": "medium",
    "code": "AWS_AUTH_ERROR",
    "context": "mcp_call_kv_get",
    "userId": "demo-user-123"
  }
}
```

## UI Integration

The UI now shows appropriate notifications:

- **Infrastructure Issues**: Yellow warning - "Service temporarily unavailable"
- **User Errors**: Red error - Helpful validation message
- **Auth Issues**: Yellow warning - "Authentication service is being configured"
- **System Errors**: Red error - "An unexpected error occurred"

## Development vs Production

- **Development**: More detailed error messages for debugging
- **Production**: Sanitized messages that don't expose internal details
- **Infrastructure secrets**: Always filtered out (ARNs, IPs, UUIDs)

## Benefits

1. **Security**: No infrastructure details leaked to users
2. **UX**: Clear, actionable error messages
3. **Observability**: Proper error categorization and telemetry
4. **Reliability**: Retry guidance for transient failures
5. **Development**: Detailed logs for debugging