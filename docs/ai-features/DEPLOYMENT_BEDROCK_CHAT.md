# Deploying AWS Bedrock Chat Integration

Complete deployment guide for enabling Claude AI chat via AWS Bedrock in the dashboard-server.

## Overview

This deployment adds AWS Bedrock Runtime API access to the dashboard-server ECS task, enabling real Claude AI responses instead of simulated ones.

## Prerequisites

### 1. AWS Account Setup

- [ ] AWS account with admin access
- [ ] AWS CLI installed and configured
- [ ] Terraform installed (v1.0+)
- [ ] AWS profile configured (e.g., `your-aws-profile`)

### 2. Enable Claude Models in Bedrock

**Important**: Do this BEFORE deploying infrastructure changes!

1. Go to [AWS Console](https://console.aws.amazon.com/) → Bedrock
2. Select your region (us-west-2 recommended)
3. Navigate to "Model access" in left sidebar
4. Click "Manage model access"
5. Select Claude models:
   - ✅ **Claude 3.5 Sonnet** (recommended)
   - ✅ Claude 3 Sonnet
   - ✅ Claude 3 Haiku (cost-effective)
   - ⬜ Claude 3 Opus (optional, expensive)
6. Click "Request model access"
7. Wait for "Access granted" status (usually instant)

**Verify access:**
```bash
aws bedrock list-foundation-models \
  --region us-west-2 \
  --by-provider anthropic
```

Expected output:
```json
{
  "modelSummaries": [
    {
      "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "modelName": "Claude 3.5 Sonnet",
      "providerName": "Anthropic"
    }
  ]
}
```

## Deployment Steps

### Step 1: Review Code Changes

**Files Modified:**
1. [dashboard-server/src/services/ChatService.ts](../dashboard-server/src/services/ChatService.ts)
   - Added real Bedrock API integration
   - Added streaming support

2. [dashboard-server/src/websocket/handlers.ts](../dashboard-server/src/websocket/handlers.ts)
   - Added streaming chat handler

3. [infra/modules/ecs_dashboard_service/main.tf](../infra/modules/ecs_dashboard_service/main.tf)
   - Added Bedrock IAM permissions

**Dependencies Added:**
- `@aws-sdk/client-bedrock-runtime` in dashboard-server/package.json

### Step 2: Deploy Infrastructure Changes

#### 2.1 Set Environment Variables

```bash
export AWS_PROFILE=your-aws-profile
export AWS_REGION=us-west-2
```

#### 2.2 Navigate to Dashboard Service Workspace

```bash
cd infra/workspaces/small/dashboard_service
```

#### 2.3 Review Terraform Plan

```bash
terraform plan
```

**Expected changes:**
```hcl
# aws_iam_role_policy.task_role_policy will be updated in-place
~ resource "aws_iam_role_policy" "task_role_policy" {
    ~ policy = jsonencode({
        ~ Statement = [
            # Existing statements unchanged...
            + {
              + Sid    = "BedrockRuntimeAccess"
              + Effect = "Allow"
              + Action = [
                + "bedrock:InvokeModel",
                + "bedrock:InvokeModelWithResponseStream"
              ]
              + Resource = "arn:aws:bedrock:*:ACCOUNT_ID:foundation-model/anthropic.claude-*"
            }
        ]
      })
  }
```

**Important**: Should show NO other changes. If you see ECS service or task definition changes, something is wrong.

#### 2.4 Apply Changes

```bash
terraform apply
```

Type `yes` when prompted.

**Deployment time**: ~5 seconds (IAM policy update only)

**Zero downtime**: ✅ No service restart required

### Step 3: Verify IAM Policy

```bash
# Get role name (should be: agent-mesh-dev-dashboard-task)
ROLE_NAME="agent-mesh-dev-dashboard-task"

# Check policy contains Bedrock permissions
aws iam get-role-policy \
  --role-name $ROLE_NAME \
  --policy-name ${ROLE_NAME}-policy \
  | jq '.PolicyDocument.Statement[] | select(.Sid == "BedrockRuntimeAccess")'
```

**Expected output:**
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

### Step 4: Deploy Application Code

#### 4.1 Build Dashboard Server Container

```bash
cd dashboard-server

# Build Docker image
docker build -t dashboard-server:bedrock .

# Tag for ECR (replace ACCOUNT_ID and REGION)
docker tag dashboard-server:bedrock \
  ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/agent-mesh-dashboard-server:latest

# Push to ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com

docker push ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/agent-mesh-dashboard-server:latest
```

#### 4.2 Update ECS Service

```bash
# Force new deployment with latest image
aws ecs update-service \
  --cluster agent-mesh-dev-dashboard \
  --service agent-mesh-dev-dashboard \
  --force-new-deployment \
  --region us-west-2
```

**Deployment time**: ~2-3 minutes

**Watch deployment:**
```bash
watch -n 2 'aws ecs describe-services \
  --cluster agent-mesh-dev-dashboard \
  --services agent-mesh-dev-dashboard \
  --query "services[0].deployments" \
  --region us-west-2'
```

Wait until:
- `runningCount` matches `desiredCount`
- `status` is `PRIMARY`
- Old tasks are drained

### Step 5: Configure Environment (Optional)

If you want to use a different Claude model, add environment variable to ECS task definition:

```bash
# Edit task definition to add:
{
  "name": "BEDROCK_MODEL_ID",
  "value": "anthropic.claude-3-haiku-20240307-v1:0"
}
```

**Available models:**
- `anthropic.claude-3-5-sonnet-20241022-v2:0` (default, best balance)
- `anthropic.claude-3-sonnet-20240229-v1:0` (previous version)
- `anthropic.claude-3-haiku-20240307-v1:0` (fastest, cheapest)
- `anthropic.claude-3-opus-20240229-v1:0` (most capable, expensive)

## Testing

### Test 1: Check Container Logs

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster agent-mesh-dev-dashboard \
  --service agent-mesh-dev-dashboard \
  --query 'taskArns[0]' \
  --output text \
  --region us-west-2)

# View logs
aws logs tail /ecs/agent-mesh-dev-dashboard \
  --follow \
  --region us-west-2
```

**Look for:**
```
[ChatService] Initialized Bedrock client for region: us-west-2
```

### Test 2: WebSocket Chat Test

```bash
# Install wscat if needed
npm install -g wscat

# Get ALB URL or use localhost
ALB_URL="ws://your-alb-url.amazonaws.com/ws"
# OR for local testing:
ALB_URL="ws://localhost:3001"

# Connect
wscat -c $ALB_URL

# Send test message (paste this):
{
  "type": "chat.send_message",
  "data": {
    "message": "Hello Claude, can you confirm you're running on Bedrock?",
    "streaming": false
  }
}
```

**Expected response:**
```json
{
  "type": "chat.message_response",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "message": {
      "messageId": "msg_1234567890_xyz",
      "content": "Yes, I'm Claude running on AWS Bedrock...",
      "role": "assistant",
      "usage": {
        "inputTokens": 42,
        "outputTokens": 156,
        "totalTokens": 198
      }
    }
  }
}
```

**Verify:**
- ✅ Response is contextually appropriate (not generic)
- ✅ `usage` object contains real token counts
- ✅ Response time is reasonable (2-5 seconds)

### Test 3: Streaming Chat Test

```bash
wscat -c $ALB_URL

# Send streaming request:
{
  "type": "chat.send_message",
  "data": {
    "message": "Explain AWS Step Functions in 3 sentences",
    "streaming": true
  }
}
```

**Expected response (multiple messages):**
```json
// Token chunks (arrives in real-time)
{"type": "chat.message_stream", "data": {"content": "AWS "}}
{"type": "chat.message_stream", "data": {"content": "Step "}}
{"type": "chat.message_stream", "data": {"content": "Functions "}}
...

// Completion signal
{
  "type": "chat.message_complete",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "messageId": "msg_1234567890_xyz",
    "usage": {
      "inputTokens": 28,
      "outputTokens": 342,
      "totalTokens": 370
    }
  }
}
```

### Test 4: Dashboard UI Test

1. Open dashboard UI: http://localhost:5173 (or ALB URL)
2. Navigate to Chat or Workflows page
3. Open chat panel (sidebar or workflow designer)
4. Send message: "What can you help me with?"
5. Verify Claude responds appropriately

**Success criteria:**
- ✅ Response appears within 2-5 seconds
- ✅ Content is contextually relevant
- ✅ No error messages in browser console
- ✅ Token counts visible in network tab

### Test 5: CloudWatch Metrics

```bash
# Check Bedrock invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InvokeModelCount \
  --dimensions Name=ModelId,Value=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-west-2
```

**Should show non-zero datapoints after testing.**

## Troubleshooting

### Issue: "AccessDeniedException"

**Error:**
```
User: arn:aws:sts::ACCOUNT_ID:assumed-role/agent-mesh-dev-dashboard-task/...
is not authorized to perform: bedrock:InvokeModel
```

**Solutions:**
1. Verify IAM policy applied (Step 3)
2. Wait 5 seconds for IAM propagation
3. Check model access enabled (Prerequisites Step 2)
4. Restart ECS task to pick up new IAM policy

```bash
# Force task restart
aws ecs update-service \
  --cluster agent-mesh-dev-dashboard \
  --service agent-mesh-dev-dashboard \
  --force-new-deployment \
  --region us-west-2
```

### Issue: "ResourceNotFoundException"

**Error:**
```
Could not find model anthropic.claude-3-5-sonnet-20241022-v2:0
```

**Solutions:**
1. Check model access enabled in AWS Console → Bedrock
2. Verify region supports Claude models
3. Check `BEDROCK_MODEL_ID` environment variable
4. Use default model by removing `BEDROCK_MODEL_ID` env var

### Issue: Simulated Responses Still Appearing

**Symptoms:**
- Responses are generic/templated
- No `usage` object in response
- Response format: "I understand you're asking about..."

**Solutions:**
1. Verify container deployed with new code:
   ```bash
   aws ecs describe-tasks \
     --cluster agent-mesh-dev-dashboard \
     --tasks $TASK_ARN \
     --query 'tasks[0].containers[0].image' \
     --region us-west-2
   ```

2. Check logs for Bedrock initialization:
   ```bash
   aws logs tail /ecs/agent-mesh-dev-dashboard --follow --region us-west-2 | grep Bedrock
   ```

3. Force new deployment (Step 4.2)

### Issue: High Latency

**Symptoms:**
- Responses take >10 seconds
- Timeout errors

**Solutions:**
1. Check region: Use us-west-2 or us-east-1 (closest to Bedrock)
2. Switch to Haiku model for faster responses
3. Enable streaming for better perceived performance
4. Check conversation history size (limit to last 10 messages)

### Issue: Unexpected Costs

**Check current usage:**
```bash
# Get token metrics for last 24 hours
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InputTokenCount \
  --dimensions Name=ModelId,Value=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region us-west-2
```

**Cost controls:**
1. Switch to Haiku (1/12th the cost)
2. Implement rate limiting per user
3. Set up CloudWatch alarms (see below)
4. Limit conversation history to reduce input tokens

## Post-Deployment Setup

### 1. Set Up Cost Alarms

```bash
# Create SNS topic for alerts
aws sns create-topic --name bedrock-cost-alerts --region us-west-2

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-west-2:ACCOUNT_ID:bedrock-cost-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-west-2

# Create CloudWatch alarm
aws cloudwatch put-metric-alarm \
  --alarm-name bedrock-daily-invocation-limit \
  --alarm-description "Alert when Bedrock calls exceed 1000/day" \
  --namespace AWS/Bedrock \
  --metric-name InvokeModelCount \
  --dimensions Name=ModelId,Value=anthropic.claude-3-5-sonnet-20241022-v2:0 \
  --statistic Sum \
  --period 86400 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:bedrock-cost-alerts \
  --region us-west-2
```

### 2. Enable CloudWatch Logs Insights

Save this query for debugging chat issues:

```
fields @timestamp, @message
| filter @message like /Bedrock/
| sort @timestamp desc
| limit 100
```

### 3. Set Up Dashboard (Optional)

Create CloudWatch dashboard to monitor Bedrock usage:
- Invocation count (daily)
- Input/output tokens (hourly)
- Error rate
- Average latency

## Rollback Procedure

If you need to revert changes:

### Rollback IAM Changes

```bash
cd infra/workspaces/small/dashboard_service

# Revert main.tf to remove Bedrock statement
git checkout HEAD~1 -- ../../../modules/ecs_dashboard_service/main.tf

# Apply rollback
terraform apply
```

### Rollback Application Code

```bash
# Deploy previous container image
aws ecs update-service \
  --cluster agent-mesh-dev-dashboard \
  --service agent-mesh-dev-dashboard \
  --task-definition agent-mesh-dev-dashboard:PREVIOUS_REVISION \
  --region us-west-2
```

**Note**: Chat will revert to simulated responses but remain functional.

## Success Checklist

- [ ] Claude model access enabled in AWS Console
- [ ] Terraform applied successfully (IAM policy updated)
- [ ] Container deployed with new code
- [ ] CloudWatch logs show "Initialized Bedrock client"
- [ ] WebSocket test returns real Claude responses
- [ ] Usage metrics show actual token counts
- [ ] Dashboard UI chat works correctly
- [ ] Cost alarms configured
- [ ] Team notified of new feature

## Cost Estimation

**Claude 3.5 Sonnet pricing:**
- Input: $3 per million tokens
- Output: $15 per million tokens

**Example usage:**
- 100 messages/day
- 200 tokens per message (50 input, 150 output)

**Daily cost:**
- Input: `100 × 50 / 1,000,000 × $3 = $0.015`
- Output: `100 × 150 / 1,000,000 × $15 = $0.225`
- **Total: $0.24/day** = **$7.20/month**

**For cost-sensitive applications**, use Claude 3 Haiku:
- Input: $0.25 per million tokens
- Output: $1.25 per million tokens
- **Same usage: $0.60/month** (12x cheaper)

## Related Documentation

- [AWS Bedrock Chat Setup Guide](./aws-bedrock-chat-setup.md) - Full feature documentation
- [Bedrock IAM Documentation](../infra/modules/ecs_dashboard_service/BEDROCK_IAM.md) - Detailed IAM reference
- [Dashboard Server Setup](../dashboard-server/BEDROCK_SETUP.md) - Quick reference

## Support

If issues persist:
1. Check CloudWatch logs: `/ecs/agent-mesh-dev-dashboard`
2. Review CloudTrail for Bedrock API calls
3. Verify IAM policy with `aws iam get-role-policy`
4. Test Bedrock access directly with AWS CLI

## Next Steps

After successful deployment:
1. **Frontend Updates**: Enable streaming in chat components for better UX
2. **Rate Limiting**: Implement per-user quotas
3. **Monitoring**: Set up CloudWatch dashboards
4. **Cost Optimization**: Review usage patterns, consider Haiku for simple queries
5. **Session Persistence**: Store chat sessions in DynamoDB instead of memory
