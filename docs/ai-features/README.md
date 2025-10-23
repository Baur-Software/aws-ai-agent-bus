# AI Features Documentation

This folder contains documentation for all AI-powered features in the AWS AI Agent Bus platform.

## Overview

The platform provides sophisticated AI capabilities powered by AWS Bedrock (Claude 3.7 Sonnet) with context-aware workflow generation, persistent chat history, and intelligent integration suggestions.

## Documentation Index

### Setup & Configuration

- **[bedrock-setup-guide.md](./bedrock-setup-guide.md)** - Complete AWS Bedrock setup guide
- **[aws-bedrock-chat-setup.md](./aws-bedrock-chat-setup.md)** - Chat system integration with Bedrock

### Deployment

- **[DEPLOYMENT_BEDROCK_CHAT.md](./DEPLOYMENT_BEDROCK_CHAT.md)** - Production deployment guide for Bedrock-powered chat
- **[../infrastructure/BEDROCK_IAM.md](../infrastructure/BEDROCK_IAM.md)** - IAM permissions for Bedrock access

### System Documentation

- **[CHAT_SYSTEM_COMPLETE.md](./CHAT_SYSTEM_COMPLETE.md)** - Complete chat system architecture and features

## Key Features

### 1. AI-Powered Workflow Generation

- **Context-Aware Generation**: Claude knows your connected integrations and only suggests workflows you can actually build
- **44 Node Types**: Across 9 categories (triggers, HTTP, data processing, events, storage, logic, output, visualization, agents, integrations)
- **Smart Filtering**: Automatically filters unavailable nodes based on missing integrations
- **Integration Suggestions**: Tells you exactly what to connect to unlock new workflow capabilities

**Example:**

```
User: "Build a workflow that gets Google Analytics data and sends it to Slack"

Claude (without Slack connected):
"I can help you build this workflow, but you'll need to connect Slack first.
Currently you have Google Analytics connected, which is great for the first part.

Connect Slack at /settings/integrations to unlock the 'slack-message' node type."
```

### 2. Persistent Chat History

- **30-Day Retention**: All chat sessions stored in DynamoDB via KV store
- **Session Management**: Auto-loads most recent session on mount
- **Context Preservation**: Full conversation history maintained per session
- **Multi-Session**: Track multiple conversation threads

### 3. Enhanced Chat Experience

- **Two Modes**:
  - **Plan Mode**: General conversation and assistance
  - **Edit Mode**: Focused workflow generation with visual indicators
- **Real-Time Rendering**: Markdown with syntax highlighting
- **Token Tracking**: See Claude usage metrics (input/output tokens)
- **Streaming Support**: Token-by-token responses (when enabled)

### 4. Event-Driven Architecture

- **Workflow Publishing**: AI-generated workflows publish to EventBridge
- **Canvas Integration**: Workflows automatically load to visual canvas
- **Real-Time Updates**: WebSocket-based event streaming
- **Pub/Sub Pattern**: Clean separation of concerns

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     EnhancedChat UI                         │
│  - Plan Mode / Edit Mode toggle                            │
│  - Message history with markdown rendering                  │
│  - Example prompts (clickable)                             │
└─────────────────┬───────────────────────────────────────────┘
                  │ WebSocket
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                  Dashboard Server                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ChatService                             │  │
│  │  - getUserConnections() → queries KV store           │  │
│  │  - getAvailableTaskTypes() → filters by integrations│  │
│  │  - saveSessionToKV() → DynamoDB persistence         │  │
│  │  - Bedrock InvokeModel API                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ↓                 ↓
┌──────────────────┐  ┌──────────────────┐
│  AWS Bedrock     │  │  DynamoDB        │
│  Claude 3.7      │  │  (KV Store)      │
│  Sonnet          │  │  - Chat sessions │
└──────────────────┘  │  - User data     │
                      └──────────────────┘
```

## Getting Started

### Quick Start (Development)

1. **Set up AWS Bedrock** (see [bedrock-setup-guide.md](./bedrock-setup-guide.md))

   ```bash
   # Enable Claude 3.7 Sonnet in AWS Console
   # Set AWS credentials
   export AWS_PROFILE=your-profile
   export AWS_REGION=us-west-2
   ```

2. **Start the services**

   ```bash
   npm run dev:all
   ```

3. **Open chat interface**
   - Navigate to `/chat` route
   - FloatingChatPanel appears with EnhancedChat
   - Try example prompts or ask anything!

### Production Deployment

See [DEPLOYMENT_BEDROCK_CHAT.md](./DEPLOYMENT_BEDROCK_CHAT.md) for complete production setup including:

- ECS task role configuration
- Bedrock model access
- DynamoDB table setup
- CloudWatch monitoring
- Cost optimization

## Configuration

### Environment Variables

```bash
# AWS Bedrock
AWS_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-7-sonnet-20250219-v1:0

# DynamoDB (KV Store)
AGENT_MESH_KV_TABLE=agent-mesh-kv

# Optional: Chat settings
CHAT_SESSION_TTL_HOURS=720  # 30 days default
```

### Model Selection

Currently using **Claude 3.7 Sonnet** for best balance of:

- **Quality**: Superior reasoning and context awareness
- **Speed**: Fast response times for good UX
- **Cost**: Reasonable pricing for production use

Can switch to other models:

- **Claude 3 Haiku**: Faster, cheaper (good for high-volume simple queries)
- **Claude 3 Opus**: Highest quality (for complex reasoning tasks)

## Cost Considerations

### Token Usage

- **Average conversation**: 2,000-5,000 tokens
- **Workflow generation**: 5,000-10,000 tokens (includes schema and context)
- **Pricing** (Claude 3.7 Sonnet): ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens

### Optimization Tips

1. **Session reuse**: Load previous sessions instead of starting fresh
2. **Compact system prompts**: Only include relevant context
3. **Streaming**: Better UX without extra cost
4. **Caching** (future): Use prompt caching for system prompts

### Monthly Estimates

- **Light use** (100 chats/month): ~$5-10
- **Medium use** (1000 chats/month): ~$50-100
- **Heavy use** (10,000 chats/month): ~$500-1000

## Testing

### Manual Testing

```bash
# Test chat endpoint
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Build a workflow that gets GA data",
    "sessionId": "test-session",
    "userId": "user-demo-123"
  }'
```

### Integration Testing

See test files:

- `dashboard-server/test/integration/chat.test.ts`
- `dashboard-server/test/unit/ChatService.test.ts`

## Troubleshooting

### "Model use case details have not been submitted"

**Solution**: Enable Claude models in AWS Console → Bedrock → Model access

### "Unknown tool: kv_set"

**Solution**: Ensure MCP server (Rust binary) is running and tool routing is configured

### Chat history not loading

**Solution**: Check DynamoDB table exists and credentials are correct

### Slow responses

**Possible causes**:

- Large system prompts (trim unnecessary context)
- Network latency to Bedrock (check AWS region)
- Too many connected integrations (optimize getUserConnections query)

## Contributing

When adding new AI features:

1. Update this README with feature description
2. Add architecture diagrams if needed
3. Document configuration options
4. Add troubleshooting section
5. Update cost estimates

## Related Documentation

- [Demo Script](../../DEMO_SCRIPT.md) - Presentation guide for showcasing AI features
- [MCP Documentation](../../mcp-rust/README.md) - Model Context Protocol server
- [Infrastructure Docs](../infrastructure/) - AWS resource setup

## Future Enhancements

- [ ] Prompt caching for system prompts (reduce costs)
- [ ] Multi-modal support (images, documents)
- [ ] Tool use / function calling for MCP integration
- [ ] Custom fine-tuned models for specific domains
- [ ] A/B testing different models/prompts
- [ ] Analytics dashboard for AI usage metrics
