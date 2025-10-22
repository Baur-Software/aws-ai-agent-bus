# AWS Bedrock Chat Integration Guide

This guide explains how the AI chat feature connects to AWS Bedrock using Claude models.

## Architecture Overview

```
Dashboard UI (SolidJS)
├── AgentChat.tsx
├── ChatPanel.tsx
└── CollapsibleAgentChat.tsx
        ↓ WebSocket
dashboard-server
├── WebSocket Handler (handlers.ts)
└── ChatService.ts
        ↓ AWS SDK
AWS Bedrock Runtime
└── Claude 3.5 Sonnet
```

## Features

### 1. Real-time Bedrock Integration
- Direct integration with AWS Bedrock Runtime API
- Uses Claude 3.5 Sonnet model by default
- Accurate token usage tracking
- Full conversation history support

### 2. Streaming Responses
- Token-by-token streaming for better UX
- Real-time display of Claude's responses
- Lower perceived latency
- WebSocket-based streaming

### 3. MCP Tool Integration
- Automatic tool detection (analytics, data queries)
- Context-aware responses
- Tool execution tracking

## Configuration

### Environment Variables

Create or update `dashboard-server/.env`:

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_PROFILE=baursoftware  # Optional, for local development

# Bedrock Model Configuration
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Alternative models you can use:
# BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
# BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
# BEDROCK_MODEL_ID=anthropic.claude-3-opus-20240229-v1:0
```

### AWS Credentials

The ChatService uses the AWS SDK's default credential provider chain:

1. **Environment variables**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
2. **AWS config files**: `~/.aws/credentials` (used when `AWS_PROFILE` is set)
3. **IAM role**: If running on EC2/ECS/Lambda

### Required IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
      ]
    }
  ]
}
```

### Bedrock Model Access

Before using Claude models, you must enable them in your AWS account:

1. Go to AWS Console → Bedrock → Model access
2. Select Claude models (Sonnet, Haiku, Opus)
3. Request access (usually instant for Claude)
4. Wait for "Access granted" status

## API Reference

### WebSocket Messages

#### Non-Streaming Chat (Default)

**Request:**
```json
{
  "id": "msg_123",
  "type": "chat.send_message",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "message": "Hello, can you help me with workflows?",
    "streaming": false
  }
}
```

**Response:**
```json
{
  "id": "msg_123",
  "type": "chat.message_response",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "message": {
      "messageId": "msg_1234567890_xyz",
      "content": "Of course! I can help you...",
      "role": "assistant",
      "timestamp": "2025-10-16T12:00:00.000Z",
      "usage": {
        "inputTokens": 42,
        "outputTokens": 156,
        "totalTokens": 198
      }
    }
  }
}
```

#### Streaming Chat (Recommended)

**Request:**
```json
{
  "id": "msg_456",
  "type": "chat.send_message",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "message": "Explain step functions",
    "streaming": true
  }
}
```

**Streaming Responses:**
```json
// Token chunks (multiple messages)
{
  "id": "msg_456",
  "type": "chat.message_stream",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "content": "AWS "
  }
}

{
  "id": "msg_456",
  "type": "chat.message_stream",
  "data": {
    "sessionId": "chat_1234567890_abc",
    "content": "Step Functions"
  }
}

// Completion signal
{
  "id": "msg_456",
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

### ChatService Methods

#### `sendMessage(request: ChatRequest): Promise<ChatResponse>`

Send a message and get complete response (non-streaming).

**Usage:**
```typescript
const response = await chatService.sendMessage({
  sessionId: 'chat_123',
  message: 'Hello',
  userId: 'user_456',
  organizationId: 'org_789'
});

console.log(response.content); // Claude's response
console.log(response.usage);   // Token counts
```

#### `generateBedrockStreamingResponse(session, request): AsyncGenerator`

Generate streaming response token-by-token.

**Usage:**
```typescript
for await (const chunk of chatService.generateBedrockStreamingResponse(session, request)) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.content); // Print tokens as they arrive
  } else if (chunk.type === 'done') {
    console.log('\nUsage:', chunk.usage);
  }
}
```

## Frontend Integration

### Enable Streaming in Chat Components

Update your chat component to use streaming:

```typescript
// In AgentChat.tsx or ChatPanel.tsx
const sendMessage = async (message: string) => {
  const sessionId = currentSessionId();

  // Send with streaming enabled
  const messageId = `msg_${Date.now()}`;
  ws.send(JSON.stringify({
    id: messageId,
    type: 'chat.send_message',
    data: {
      sessionId,
      message,
      streaming: true  // Enable streaming
    }
  }));

  // Handle streaming chunks
  const handleStream = (event: MessageEvent) => {
    const data = JSON.parse(event.data);

    if (data.type === 'chat.message_stream') {
      // Append token to UI
      appendTokenToLastMessage(data.data.content);
    } else if (data.type === 'chat.message_complete') {
      // Message complete
      console.log('Message complete', data.data.usage);
    }
  };

  ws.addEventListener('message', handleStream);
};
```

## Model Configuration

### Available Claude Models on Bedrock

| Model ID | Description | Use Case |
|----------|-------------|----------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet (Latest) | Best balance of intelligence, speed, and cost |
| `anthropic.claude-3-sonnet-20240229-v1:0` | Claude 3 Sonnet | Previous version, still excellent |
| `anthropic.claude-3-haiku-20240307-v1:0` | Claude 3 Haiku | Fastest, most cost-effective |
| `anthropic.claude-3-opus-20240229-v1:0` | Claude 3 Opus | Most capable, higher cost |

### Pricing (as of Oct 2024)

- **Claude 3.5 Sonnet**: $3/M input tokens, $15/M output tokens
- **Claude 3 Sonnet**: $3/M input tokens, $15/M output tokens
- **Claude 3 Haiku**: $0.25/M input tokens, $1.25/M output tokens
- **Claude 3 Opus**: $15/M input tokens, $75/M output tokens

## Testing

### Local Development

1. **Set AWS credentials**:
   ```bash
   export AWS_PROFILE=baursoftware
   export AWS_REGION=us-west-2
   ```

2. **Start dashboard-server**:
   ```bash
   cd dashboard-server
   bun run dev
   ```

3. **Test the chat**:
   - Open dashboard UI at http://localhost:5173
   - Navigate to chat interface
   - Send a message
   - Verify Claude responds correctly

### Test with curl

Test non-streaming:
```bash
wscat -c ws://localhost:3001

# Send:
{
  "id": "test_1",
  "type": "chat.send_message",
  "data": {
    "message": "Hello Claude",
    "streaming": false
  }
}
```

Test streaming:
```bash
{
  "id": "test_2",
  "type": "chat.send_message",
  "data": {
    "message": "Explain AWS Lambda",
    "streaming": true
  }
}
```

## Troubleshooting

### Error: "Failed to generate response from Bedrock"

**Possible causes:**
1. No AWS credentials configured
2. Model not enabled in Bedrock
3. Insufficient IAM permissions

**Solution:**
```bash
# Check credentials
aws sts get-caller-identity

# Check Bedrock access
aws bedrock list-foundation-models --region us-west-2

# Enable model access in AWS Console
```

### Error: "ResourceNotFoundException"

The model ID is invalid or not available in your region.

**Solution:**
- Verify `BEDROCK_MODEL_ID` matches available models
- Check model availability in your AWS region
- Some regions don't have all Claude models

### Streaming not working

**Symptoms:**
- Messages appear all at once
- No token-by-token updates

**Solution:**
- Verify `streaming: true` in WebSocket message
- Check browser console for WebSocket errors
- Ensure dashboard-server is running latest code

### High latency

**Possible causes:**
1. Using Opus model (slower but more capable)
2. Large conversation history
3. Network latency to AWS

**Solutions:**
- Switch to Haiku for faster responses
- Limit conversation history to last 10 messages
- Use streaming for better perceived performance

## Performance Optimization

### 1. Model Selection
- **Interactive chat**: Use Claude 3.5 Sonnet or Haiku
- **Complex analysis**: Use Opus
- **Simple queries**: Use Haiku

### 2. Context Management
```typescript
// Limit conversation history
const messages = session.messages.slice(-10); // Last 10 messages only
```

### 3. System Prompt Optimization
Keep system prompts concise and specific:
```typescript
const systemPrompt = `You are a workflow automation assistant.
Be concise and specific. Use bullet points when listing items.`;
```

### 4. Use Streaming
Streaming provides better UX even if total latency is the same:
```typescript
streaming: true  // Always prefer streaming for chat UI
```

## Security Considerations

### 1. Credential Management
- Never commit AWS credentials to git
- Use environment variables or AWS profiles
- Rotate credentials regularly

### 2. User Isolation
- Each chat session is user-specific
- WebSocket authentication enforced
- Organization context isolated

### 3. Content Filtering
Consider implementing:
- Input sanitization
- Output content filtering
- Rate limiting per user

### 4. Logging
- Log all Bedrock API calls for auditing
- Track token usage per user/organization
- Monitor for unusual patterns

## Cost Management

### Token Usage Tracking

The system tracks token usage automatically:
```typescript
{
  "usage": {
    "inputTokens": 42,
    "outputTokens": 156,
    "totalTokens": 198
  }
}
```

### Cost Estimation

For Claude 3.5 Sonnet:
- Input: `inputTokens / 1000 * $3.00`
- Output: `outputTokens / 1000 * $15.00`

Example (200 tokens total, 50 input / 150 output):
- Input: `50 / 1000 * $3.00 = $0.15`
- Output: `150 / 1000 * $15.00 = $2.25`
- **Total**: `$2.40` per conversation

### Budget Alerts

Set up CloudWatch alarms for Bedrock usage:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name bedrock-high-usage \
  --metric-name InvokeModelCount \
  --namespace AWS/Bedrock \
  --statistic Sum \
  --period 86400 \
  --threshold 10000 \
  --comparison-operator GreaterThanThreshold
```

## Next Steps

1. **Frontend Updates**: Update chat components to use streaming
2. **Error Handling**: Add retry logic for transient failures
3. **Analytics**: Track usage metrics per user
4. **Rate Limiting**: Implement per-user rate limits
5. **Session Persistence**: Store sessions in DynamoDB instead of memory

## Related Documentation

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude API Reference](https://docs.anthropic.com/claude/reference)
- [Dashboard Server Architecture](./dashboard-server-architecture.md)
- [WebSocket API Reference](./websocket-api.md)
