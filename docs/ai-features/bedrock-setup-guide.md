# AWS Bedrock Chat - Quick Setup

## Prerequisites

1. **AWS Account** with Bedrock access
2. **Claude model access** enabled in AWS Console → Bedrock → Model access
3. **AWS credentials** configured locally

## Configuration

### 1. Environment Variables

Create `dashboard-server/.env`:

```bash
AWS_REGION=us-west-2
AWS_PROFILE=your-aws-profile
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 2. IAM Permissions

Your AWS user/role needs:

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
}
```

### 3. Enable Claude Models

1. Go to [AWS Console](https://console.aws.amazon.com/) → Bedrock
2. Navigate to "Model access" in left sidebar
3. Click "Manage model access"
4. Select Claude models:
   - ✅ Claude 3.5 Sonnet
   - ✅ Claude 3 Sonnet
   - ✅ Claude 3 Haiku
   - ✅ Claude 3 Opus (optional)
5. Click "Request model access"
6. Wait for "Access granted" status (usually instant)

## Testing

### Start the Server

```bash
cd dashboard-server
bun run dev
```

### Test the Chat

1. Open Dashboard UI: http://localhost:5173
2. Navigate to Chat or Workflows page
3. Send a message in the chat
4. Verify Claude responds

### Check Logs

```bash
# Look for these log messages:
# ✅ Initialized Bedrock client for region: us-west-2
# ✅ Calling Bedrock Claude model: anthropic.claude-3-5-sonnet-20241022-v2:0
# ✅ Bedrock response received. Tokens: 198
```

## Features Enabled

- ✅ **Real AWS Bedrock Integration** - No more simulated responses
- ✅ **Streaming Responses** - Token-by-token updates for better UX
- ✅ **Accurate Token Tracking** - Real usage metrics from Claude
- ✅ **Conversation History** - Full context maintained per session
- ✅ **MCP Tool Integration** - Can call analytics and data tools

## Model Options

| Model | Speed | Cost | Use Case |
|-------|-------|------|----------|
| Claude 3.5 Sonnet (default) | Fast | Medium | Best balance |
| Claude 3 Haiku | Fastest | Lowest | Simple queries |
| Claude 3 Opus | Slower | Highest | Complex analysis |

Change model by setting `BEDROCK_MODEL_ID` in `.env`.

## Streaming vs Non-Streaming

### Non-Streaming (Default)

```typescript
{
  type: 'chat.send_message',
  data: { message: 'Hello', streaming: false }
}
// Returns complete response at once
```

### Streaming (Recommended)

```typescript
{
  type: 'chat.send_message',
  data: { message: 'Hello', streaming: true }
}
// Returns tokens as they arrive
// Better UX, same latency
```

## Troubleshooting

### "Failed to generate response from Bedrock"

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Bedrock access
aws bedrock list-foundation-models --region us-west-2
```

### "ResourceNotFoundException"

- Model ID incorrect or not available in your region
- Check `BEDROCK_MODEL_ID` in `.env`
- Verify model access granted in AWS Console

### No streaming updates

- Ensure `streaming: true` in WebSocket message
- Check browser console for errors
- Verify WebSocket connection is active

## Cost Estimation

Claude 3.5 Sonnet pricing (per 1M tokens):

- Input: $3.00
- Output: $15.00

Example conversation (200 tokens total):

- Input (50 tokens): $0.15
- Output (150 tokens): $2.25
- **Total: $2.40**

For typical chat usage (100 messages/day, 200 tokens avg):

- Daily cost: ~$240
- Monthly cost: ~$7,200

Consider using Haiku for cost-sensitive applications (1/12th the price).

## Next Steps

1. **Frontend**: Update chat components to enable streaming
2. **Monitoring**: Add CloudWatch metrics and alarms
3. **Rate Limiting**: Implement per-user limits
4. **Persistence**: Store sessions in DynamoDB

## Documentation

Full documentation: [docs/aws-bedrock-chat-setup.md](../docs/aws-bedrock-chat-setup.md)
