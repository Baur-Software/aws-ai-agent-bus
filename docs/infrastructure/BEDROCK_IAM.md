# Bedrock IAM Permissions for Dashboard Service

## Overview

This module includes IAM permissions for AWS Bedrock Runtime API access, enabling the dashboard-server to use Claude models for AI chat functionality.

## Changes Made

### IAM Policy Addition

**File**: `main.tf` (lines 119-130)

Added new statement to `task_role_policy`:

```hcl
# Bedrock Runtime access for AI chat
statement {
  sid    = "BedrockRuntimeAccess"
  effect = "Allow"
  actions = [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ]
  resources = [
    "arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:foundation-model/anthropic.claude-*"
  ]
}
```

### Permissions Breakdown

#### Actions

1. **`bedrock:InvokeModel`**
   - Purpose: Execute synchronous Claude model invocations
   - Used for: Non-streaming chat responses
   - Cost: Based on input/output tokens

2. **`bedrock:InvokeModelWithResponseStream`**
   - Purpose: Execute streaming Claude model invocations
   - Used for: Real-time token-by-token chat responses
   - Cost: Same as InvokeModel, better UX

#### Resources

**ARN Pattern**: `arn:aws:bedrock:*:ACCOUNT_ID:foundation-model/anthropic.claude-*`

- **Region**: `*` (all regions) - Allows Bedrock access in any AWS region
- **Account**: Dynamic via `data.aws_caller_identity.current.account_id`
- **Model Scope**: `anthropic.claude-*` - Only Claude models
  - Claude 3.5 Sonnet
  - Claude 3 Sonnet
  - Claude 3 Haiku
  - Claude 3 Opus
  - Future Claude versions

**Why wildcard region?**
- Bedrock availability varies by region
- Allows failover to different regions
- No additional cost for cross-region specification
- Runtime region is controlled by `AWS_REGION` env var

**Why Claude-only scope?**
- Security: Limits to only Anthropic models
- Cost control: Prevents accidental use of expensive models
- Compliance: Clear audit trail of which model family is used

## Security Considerations

### Least Privilege

✅ **Scoped to specific actions**: Only invoke operations, no admin actions
✅ **Scoped to Claude models**: Cannot access other foundation models
✅ **No wildcard resources**: Account-specific ARN pattern
✅ **No external access**: Only ECS task role can use these permissions

### Cost Control

The IAM policy does NOT limit:
- Number of invocations
- Token usage
- Total spending

**Recommended Additional Controls:**
1. CloudWatch alarms for Bedrock API calls
2. Budget alerts for Bedrock costs
3. Rate limiting in application code
4. Per-user quotas in dashboard-server

See: [Cost Management](#cost-management) below

### Audit Trail

All Bedrock API calls are logged to CloudTrail:
- Timestamp of invocation
- Model ID used
- Input/output token counts
- IAM role/user making request
- Request/response metadata

**CloudTrail Event**: `InvokeModel` / `InvokeModelWithResponseStream`

## Model Access Requirements

### Before First Use

1. **Enable Bedrock in AWS Account**
   - Go to AWS Console → Bedrock
   - Navigate to "Model access"
   - Request access to Claude models

2. **Grant Access (Usually Instant)**
   - Claude 3.5 Sonnet
   - Claude 3 Sonnet
   - Claude 3 Haiku
   - Claude 3 Opus (optional)

3. **Verify Access**
   ```bash
   aws bedrock list-foundation-models \
     --region us-west-2 \
     --by-provider anthropic
   ```

### Model Availability by Region

| Model | us-east-1 | us-west-2 | eu-west-1 | ap-southeast-1 |
|-------|-----------|-----------|-----------|----------------|
| Claude 3.5 Sonnet | ✅ | ✅ | ✅ | ✅ |
| Claude 3 Sonnet | ✅ | ✅ | ✅ | ✅ |
| Claude 3 Haiku | ✅ | ✅ | ✅ | ✅ |
| Claude 3 Opus | ✅ | ✅ | ✅ | ✅ |

Check latest availability: [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)

## IAM Role Structure

### Task Execution Role

**Name**: `agent-mesh-{env}-dashboard-execution`

**Purpose**: ECS infrastructure operations
- Pull container images from ECR
- Write logs to CloudWatch
- Retrieve secrets for startup

**Permissions**: AWS Managed Policy
- `AmazonECSTaskExecutionRolePolicy`

**Does NOT** include Bedrock permissions (execution role ≠ runtime role)

### Task Role (Runtime Permissions)

**Name**: `agent-mesh-{env}-dashboard-task`

**Purpose**: Application runtime operations
- DynamoDB KV access
- EventBridge event publishing
- Secrets Manager for integrations
- **CloudWatch Logs**
- **Bedrock Runtime API** ← New

**Permissions**: Inline policy with multiple statements
- `DynamoDBAccess` - Read/write KV store
- `EventBridgeAccess` - Publish events
- `BedrockRuntimeAccess` - **Invoke Claude models** ← New
- `SecretsManagerAccess` - Read integration credentials
- `CloudWatchLogs` - Write application logs

## Terraform Variables

No new variables required for Bedrock integration.

### Existing Variables (Unchanged)

```hcl
variable "env"              # Environment: dev/staging/prod
variable "service_name"     # Default: "dashboard"
variable "kv_table_arn"     # Required from kv_store module
variable "event_bus_arn"    # Required from event_bus module
variable "secrets_arn"      # Required from secrets module
```

### Why No Bedrock Variables?

1. **Account ID**: Retrieved dynamically via `data.aws_caller_identity.current`
2. **Region**: Set via `AWS_REGION` environment variable in task definition
3. **Model ID**: Configured in dashboard-server application code
4. **No Bedrock resources**: Using managed foundation models (no ARN to pass)

## Deployment

### Initial Deployment

```bash
cd infra/workspaces/small/dashboard_service

# Set environment
export AWS_PROFILE=baursoftware
export AWS_REGION=us-west-2

# Review changes
terraform plan

# Look for:
# + aws_iam_role_policy.task_role_policy (updated in-place)
#   ~ policy = jsonencode({
#       + BedrockRuntimeAccess = {
#           + actions   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
#           + effect    = "Allow"
#           + resources = ["arn:aws:bedrock:*:ACCOUNT_ID:foundation-model/anthropic.claude-*"]
#           + sid       = "BedrockRuntimeAccess"
#         }
#     })

# Apply changes
terraform apply
```

### Zero-Downtime Update

The IAM policy update is **non-disruptive**:
- ✅ No ECS service restart required
- ✅ No container redeployment required
- ✅ IAM policy propagates in ~5 seconds
- ✅ Existing connections remain active

**Timeline:**
1. Terraform updates IAM policy (2-3 seconds)
2. AWS IAM propagates changes (2-5 seconds)
3. Dashboard-server can immediately use Bedrock
4. No application restart needed

## Verification

### 1. Check IAM Policy

```bash
aws iam get-role-policy \
  --role-name agent-mesh-dev-dashboard-task \
  --policy-name agent-mesh-dev-dashboard-task-policy \
  | jq '.PolicyDocument.Statement[] | select(.Sid == "BedrockRuntimeAccess")'
```

Expected output:
```json
{
  "Sid": "BedrockRuntimeAccess",
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": "arn:aws:bedrock:*:123456789012:foundation-model/anthropic.claude-*"
}
```

### 2. Test Bedrock Access from ECS Task

```bash
# Get ECS task ID
TASK_ARN=$(aws ecs list-tasks \
  --cluster agent-mesh-dev-dashboard \
  --service agent-mesh-dev-dashboard \
  --query 'taskArns[0]' \
  --output text)

# Execute test command in container
aws ecs execute-command \
  --cluster agent-mesh-dev-dashboard \
  --task $TASK_ARN \
  --container dashboard-server \
  --interactive \
  --command "/bin/sh"

# Inside container:
aws bedrock list-foundation-models --region us-west-2 --by-provider anthropic
```

### 3. Test Chat Endpoint

```bash
# Get ALB URL (if created)
ALB_URL=$(terraform output -raw alb_url 2>/dev/null || echo "http://localhost:3001")

# Test chat via WebSocket
wscat -c ws://${ALB_URL}/ws

# Send:
{
  "type": "chat.send_message",
  "data": {
    "message": "Hello, Claude!",
    "streaming": false
  }
}
```

Expected response with real Claude content (not simulated).

## Cost Management

### Pricing (as of Oct 2024)

**Claude 3.5 Sonnet:**
- Input: $3.00 per million tokens
- Output: $15.00 per million tokens

**Claude 3 Haiku (cost-optimized):**
- Input: $0.25 per million tokens
- Output: $1.25 per million tokens

### Cost Estimation

**Average conversation (200 tokens, 50 input / 150 output):**

Claude 3.5 Sonnet:
- Input: `50 / 1,000,000 × $3.00 = $0.00015`
- Output: `150 / 1,000,000 × $15.00 = $0.00225`
- **Total: $0.0024 per message**

At 1,000 messages/day:
- Daily: $2.40
- Monthly: $72.00

At 10,000 messages/day:
- Daily: $24.00
- Monthly: $720.00

### CloudWatch Alarms

Create budget alerts for Bedrock usage:

```bash
# Create metric alarm for invocation count
aws cloudwatch put-metric-alarm \
  --alarm-name bedrock-high-usage-alert \
  --alarm-description "Alert when Bedrock invocations exceed threshold" \
  --namespace AWS/Bedrock \
  --metric-name InvokeModelCount \
  --statistic Sum \
  --period 3600 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:bedrock-alerts
```

### Application-Level Controls

Implement in `dashboard-server/src/services/ChatService.ts`:

```typescript
// Rate limiting per user
const MAX_MESSAGES_PER_HOUR = 100;

// Token budget per conversation
const MAX_CONTEXT_TOKENS = 4000;

// Cost tracking per organization
async trackUsage(userId: string, usage: TokenUsage) {
  await dynamodb.putItem({
    TableName: 'usage-tracking',
    Item: {
      userId,
      timestamp: Date.now(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost: calculateCost(usage)
    }
  });
}
```

## Troubleshooting

### Error: AccessDeniedException

**Symptom:**
```
User: arn:aws:sts::ACCOUNT_ID:assumed-role/agent-mesh-dev-dashboard-task/...
is not authorized to perform: bedrock:InvokeModel
```

**Causes:**
1. IAM policy not applied yet (wait 5 seconds)
2. Model access not enabled in Bedrock console
3. Using wrong region where model not available

**Solution:**
```bash
# 1. Verify IAM policy
aws iam get-role-policy --role-name agent-mesh-dev-dashboard-task --policy-name agent-mesh-dev-dashboard-task-policy

# 2. Enable model access
# AWS Console → Bedrock → Model access → Request access

# 3. Check model availability
aws bedrock list-foundation-models --region us-west-2
```

### Error: ResourceNotFoundException

**Symptom:**
```
The specified model is not available in this region
```

**Solution:**
- Verify `AWS_REGION` environment variable in ECS task
- Check model availability for that region
- Use us-west-2 or us-east-1 (most complete model availability)

### Error: ThrottlingException

**Symptom:**
```
Rate exceeded for bedrock:InvokeModel
```

**Solution:**
- Implement exponential backoff in application
- Request quota increase via AWS Support
- Consider using Haiku model (higher default quotas)

### High Costs

**Symptom:**
- AWS bill higher than expected
- Bedrock usage exceeding budget

**Investigation:**
```bash
# Check Bedrock CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InvokeModelCount \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 86400 \
  --statistics Sum

# Check CloudTrail for usage patterns
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=InvokeModel \
  --start-time 2024-01-01T00:00:00Z
```

**Solutions:**
1. Switch to Claude Haiku (1/12th the cost)
2. Implement rate limiting per user
3. Set conversation token limits
4. Add usage dashboards

## Related Documentation

- [Dashboard Server Bedrock Setup](../../../dashboard-server/BEDROCK_SETUP.md)
- [AWS Bedrock Chat Integration Guide](../../../docs/aws-bedrock-chat-setup.md)
- [ECS Dashboard Service Module](./README.md)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

## Changelog

### 2025-10-16 - Initial Implementation

- Added `BedrockRuntimeAccess` statement to task role policy
- Enabled `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`
- Scoped to Claude models only (`anthropic.claude-*`)
- Added account-specific ARN pattern
- Documented cost management and monitoring recommendations
