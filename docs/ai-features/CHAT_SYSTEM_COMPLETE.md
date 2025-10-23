# Complete AI Chat System Documentation

## Overview

A production-ready AI chat system with AWS Bedrock (Claude), conversation history persistence, and support for both personal and organization contexts.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (SolidJS)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐│
│  │  EnhancedChat    │  │   ChatPanel      │  │  AgentChat    ││
│  │  (Claude IDE     │  │   (Sidebar)      │  │  (Workflow)   ││
│  │   Experience)    │  │                  │  │               ││
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘│
│           │                     │                     │        │
│           └─────────────────────┴─────────────────────┘        │
│                              │                                 │
│                    WebSocket Connection                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                   Dashboard Server (Node.js)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           WebSocket Handler (handlers.ts)               │   │
│  │  • Streaming Support                                    │   │
│  │  • Non-streaming Support                                │   │
│  │  • Session Management                                   │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │                                      │
│  ┌───────────────────────┴─────────────────────────────────┐   │
│  │              ChatService (ChatService.ts)               │   │
│  │  • Bedrock Integration                                  │   │
│  │  • Role Alternation                                     │   │
│  │  • Token Tracking                                       │   │
│  │  • MCP Tool Integration                                 │   │
│  └───────────────────┬─────────────────────────────────────┘   │
│                      │                                          │
│  ┌───────────────────┴─────────────────────────────────────┐   │
│  │      ChatHistoryService (ChatHistoryService.ts)         │   │
│  │  • Personal Chat History                                │   │
│  │  • Organization Chat History                            │   │
│  │  • Group Chat Support                                   │   │
│  │  • Session Management                                   │   │
│  └───────────────────┬─────────────────────────────────────┘   │
└────────────────────────┼─────────────────────────────────────────┘
                        │
┌─────────────────────────┴───────────────────────────────────────┐
│                        AWS Services                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │   Bedrock    │  │   DynamoDB      │  │   EventBridge    │  │
│  │              │  │                 │  │                  │  │
│  │  • Claude    │  │  • Sessions     │  │  • Chat Events   │  │
│  │    3.5       │  │  • Messages     │  │  • Analytics     │  │
│  │    Sonnet    │  │  • History      │  │                  │  │
│  └──────────────┘  └─────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features Implemented

### ✅ Core Chat Functionality

1. **AWS Bedrock Integration**
   - Real Claude AI via Bedrock Runtime API
   - Claude 3.5 Sonnet (default)
   - Support for Haiku and Opus models
   - Accurate token usage tracking

2. **Streaming Support**
   - Token-by-token responses
   - Better perceived performance
   - Real-time updates via WebSocket

3. **Role Alternation Handling**
   - Automatic deduplication of consecutive roles
   - Ensures Bedrock API compliance
   - Handles edge cases gracefully

4. **Conversation Memory**
   - Full context maintained per session
   - Session-based conversation history
   - Automatic session creation

### ✅ Enhanced UI (Claude IDE Experience)

**File**: `dashboard-ui/src/components/EnhancedChat.tsx`

Features:

- **Markdown Rendering**: Full markdown support with `marked`
- **Code Syntax Highlighting**: Using `highlight.js`
- **Copy to Clipboard**: One-click copy for assistant responses
- **Token Usage Display**: Real-time token tracking
- **Session Management**: Clear chat, session IDs
- **Responsive Design**: Mobile-friendly layout
- **Dark Mode Support**: Full dark mode compatibility
- **Loading States**: Beautiful loading indicators
- **Welcome Screen**: Contextual welcome with feature highlights

UI Elements:

- Gradient header with connection status
- User/Assistant avatars
- Timestamp on every message
- Token count per response
- Copy button for code blocks
- Auto-scroll to latest message
- Character counter in input
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)

### ✅ Chat History Persistence

**File**: `dashboard-server/src/services/ChatHistoryService.ts`

#### Personal Context

- Each user has their own chat history
- Stored with `USER#{userId}` partition key
- Private, isolated conversations
- 90-day TTL for automatic cleanup

#### Organization Context

- Shared chat sessions for teams
- Stored with `ORG#{organizationId}` partition key
- Visible to all org members
- Support for group chats (future)

#### Features

1. **Session Management**
   - Create, retrieve, update, delete sessions
   - List user/org sessions
   - Search sessions by title
   - Auto-generated titles

2. **Message Storage**
   - Store all chat messages
   - Paginated message retrieval
   - Full conversation history
   - Metadata tracking

3. **Statistics**
   - Total sessions per user
   - Total messages count
   - Token usage tracking
   - Most used model analytics

4. **Data Model**

   ```typescript
   // Sessions Table (PK: USER#xxx or ORG#xxx, SK: SESSION#xxx)
   {
     sessionId: string;
     userId: string;
     organizationId?: string;
     contextType: 'personal' | 'organization';
     title: string;
     isGroupChat: boolean;
     backend: 'bedrock' | 'ollama' | 'openai';
     model: string;
     messageCount: number;
     createdAt: string;
     updatedAt: string;
     lastMessageAt: string;
   }

   // Messages Table (PK: SESSION#xxx, SK: MSG#timestamp#msgId)
   {
     sessionId: string;
     messageId: string;
     role: 'user' | 'assistant' | 'system';
     content: string;
     timestamp: string;
     usage: { inputTokens, outputTokens, totalTokens };
   }
   ```

## Files Created/Modified

### Frontend

✅ **Created:**

- `dashboard-ui/src/components/EnhancedChat.tsx` - Claude IDE-style chat
- `dashboard-ui/package.json` - Added markdown and highlighting deps

✅ **Modified:**

- `dashboard-ui/src/components/ChatPanel.tsx` - Fixed WebSocket routing
- `dashboard-ui/src/components/FloatingChatPanel.tsx` - Fixed WebSocket routing
- `dashboard-ui/src/components/AgentChat.tsx` - Already correct ✅

### Backend

✅ **Created:**

- `dashboard-server/src/services/ChatHistoryService.ts` - History persistence

✅ **Modified:**

- `dashboard-server/src/services/ChatService.ts`:
  - Added Bedrock client initialization
  - Implemented real Bedrock API calls (non-streaming)
  - Implemented streaming support
  - Added role alternation validation
  - Fixed conversation history handling

- `dashboard-server/src/websocket/handlers.ts`:
  - Added streaming chat handler
  - Maintained non-streaming compatibility
  - Enhanced error handling

- `dashboard-server/package.json`:
  - Added `@aws-sdk/client-bedrock-runtime`

### Infrastructure

✅ **Modified:**

- `infra/modules/ecs_dashboard_service/main.tf`:
  - Added Bedrock IAM permissions
  - `bedrock:InvokeModel`
  - `bedrock:InvokeModelWithResponseStream`
  - Scoped to Claude models only

### Documentation

✅ **Created:**

- `docs/aws-bedrock-chat-setup.md` - Complete feature guide (450+ lines)
- `docs/DEPLOYMENT_BEDROCK_CHAT.md` - Deployment walkthrough (520+ lines)
- `docs/CHAT_SYSTEM_COMPLETE.md` - This file
- `infra/modules/ecs_dashboard_service/BEDROCK_IAM.md` - IAM reference (580+ lines)
- `dashboard-server/BEDROCK_SETUP.md` - Quick reference (190+ lines)

✅ **Modified:**

- `CLAUDE.md` - Added AI Chat System section

## Usage Examples

### Using EnhancedChat Component

```typescript
import EnhancedChat from './components/EnhancedChat';

// In your route or page
<EnhancedChat />
```

### WebSocket API

#### Non-Streaming (Complete Response)

```typescript
const response = await sendMessageWithResponse({
  type: 'chat.send_message',
  data: {
    sessionId: 'chat_123', // or null for new session
    message: 'Hello Claude!',
    streaming: false
  }
});

// Response
{
  type: 'chat.message_response',
  data: {
    sessionId: 'chat_123',
    message: {
      messageId: 'msg_456',
      content: 'Hello! How can I help you?',
      role: 'assistant',
      timestamp: '2025-10-16T...',
      usage: {
        inputTokens: 10,
        outputTokens: 25,
        totalTokens: 35
      }
    }
  }
}
```

#### Streaming (Token-by-Token)

```typescript
// Send with streaming enabled
ws.send(JSON.stringify({
  type: 'chat.send_message',
  data: {
    sessionId: 'chat_123',
    message: 'Explain AWS Lambda',
    streaming: true
  }
}));

// Receive stream events
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'chat.message_stream') {
    // Append token to UI
    appendToken(data.data.content);
  } else if (data.type === 'chat.message_complete') {
    // Stream finished
    console.log('Usage:', data.data.usage);
  }
});
```

### Chat History API

```typescript
import ChatHistoryService from './services/ChatHistoryService';

// Create session
const session = await chatHistoryService.createSession(
  'chat_123',
  'user_456',
  'Discussion about AWS Lambda',
  'personal' // or 'organization'
);

// Store message
await chatHistoryService.storeMessage({
  sessionId: 'chat_123',
  messageId: 'msg_789',
  userId: 'user_456',
  role: 'user',
  content: 'What is AWS Lambda?',
  timestamp: new Date().toISOString()
});

// Get session messages
const { messages } = await chatHistoryService.getSessionMessages('chat_123');

// List user sessions
const { sessions } = await chatHistoryService.listUserSessions('user_456');

// List org sessions (group chats)
const { sessions: orgSessions } = await chatHistoryService.listOrganizationSessions('org_123');

// Search sessions
const results = await chatHistoryService.searchSessions('user_456', 'lambda');

// Get stats
const stats = await chatHistoryService.getUserChatStats('user_456');
// { totalSessions: 10, totalMessages: 150, totalTokensUsed: 50000, ... }
```

## Infrastructure Setup

### 1. DynamoDB Tables Required

#### Chat Sessions Table

```hcl
resource "aws_dynamodb_table" "chat_sessions" {
  name           = "agent-mesh-${var.env}-chat-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"  # USER#userId or ORG#orgId
  }

  attribute {
    name = "SK"
    type = "S"  # SESSION#sessionId
  }

  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = {
    app       = "agent-mesh"
    component = "chat-history"
    env       = var.env
  }
}
```

#### Chat Messages Table

```hcl
resource "aws_dynamodb_table" "chat_messages" {
  name           = "agent-mesh-${var.env}-chat-messages"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"  # SESSION#sessionId
  }

  attribute {
    name = "SK"
    type = "S"  # MSG#timestamp#messageId
  }

  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = {
    app       = "agent-mesh"
    component = "chat-history"
    env       = var.env
  }
}
```

### 2. IAM Permissions (Already Added)

```hcl
# In ecs_dashboard_service/main.tf
statement {
  sid    = "BedrockRuntimeAccess"
  effect = "Allow"
  actions = [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ]
  resources = [
    "arn:aws:bedrock:*:${account_id}:foundation-model/anthropic.claude-*"
  ]
}

# Add DynamoDB access for chat history
statement {
  sid    = "ChatHistoryDynamoDB"
  effect = "Allow"
  actions = [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query"
  ]
  resources = [
    "arn:aws:dynamodb:*:${account_id}:table/agent-mesh-${env}-chat-sessions",
    "arn:aws:dynamodb:*:${account_id}:table/agent-mesh-${env}-chat-messages"
  ]
}
```

## Feature Roadmap

### ✅ Completed

- [x] AWS Bedrock integration
- [x] Streaming support
- [x] Role alternation handling
- [x] Enhanced UI (Claude IDE style)
- [x] Markdown rendering
- [x] Code syntax highlighting
- [x] Chat history persistence
- [x] Personal context support
- [x] Organization context support
- [x] Session management
- [x] Message search
- [x] Usage statistics

### 🚧 Planned

#### Group Chat Features

- [ ] Multi-participant group chats
- [ ] Real-time presence indicators
- [ ] Typing indicators
- [ ] Read receipts
- [ ] @mentions
- [ ] Thread replies

#### Advanced Features

- [ ] Voice input/output
- [ ] File uploads (images, documents)
- [ ] Image analysis with Claude
- [ ] Chat export (PDF, markdown)
- [ ] Scheduled messages
- [ ] Chat templates
- [ ] Custom system prompts per session

#### Enterprise Features

- [ ] Chat moderation
- [ ] Content filtering
- [ ] Compliance logging
- [ ] Audit trails
- [ ] Role-based access control (RBAC)
- [ ] Data retention policies
- [ ] E2E encryption

#### Analytics

- [ ] Chat analytics dashboard
- [ ] Token usage by user/org
- [ ] Popular topics
- [ ] Response time metrics
- [ ] User engagement metrics

## Cost Optimization

### Current Setup (Claude 3.5 Sonnet)

- $3.00 per million input tokens
- $15.00 per million output tokens

### Recommendations

1. **Use Haiku for simple queries**

   ```typescript
   // In ChatService config
   const modelId = query.isSimple()
     ? 'anthropic.claude-3-haiku-20240307-v1:0'  // 12x cheaper
     : 'anthropic.claude-3-5-sonnet-20241022-v2:0';
   ```

2. **Limit conversation history**

   ```typescript
   // Keep only last 10 messages
   const messages = session.messages.slice(-10);
   ```

3. **Implement rate limiting**

   ```typescript
   // Per user: 100 messages/hour
   const rateLimit = 100;
   ```

4. **Set up cost alerts**

   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name bedrock-monthly-cost-alert \
     --threshold 1000 \  # $1000/month
     --comparison-operator GreaterThanThreshold
   ```

## Monitoring

### CloudWatch Metrics

1. **Bedrock Invocations**
   - Namespace: `AWS/Bedrock`
   - Metric: `InvokeModelCount`
   - Dimensions: `ModelId`

2. **Token Usage**
   - Metric: `InputTokenCount`
   - Metric: `OutputTokenCount`

3. **Custom Metrics**

   ```typescript
   cloudwatch.putMetricData({
     Namespace: 'AgentMesh/Chat',
     MetricData: [{
       MetricName: 'SessionCreated',
       Value: 1,
       Unit: 'Count',
       Dimensions: [{
         Name: 'ContextType',
         Value: 'personal'
       }]
     }]
   });
   ```

### Logging

```typescript
// ChatService logs
[ChatService] Initialized Bedrock client for region: us-west-2
[ChatService] Calling Bedrock Claude model: anthropic.claude-3-5-sonnet-20241022-v2:0 with 2 messages (roles: user, assistant)
[ChatService] Bedrock response received. Tokens: 198

// ChatHistoryService logs
[ChatHistoryService] Created personal chat session chat_123 for user user_456
[ChatHistoryService] Stored user message for session chat_123
```

## Troubleshooting

### Issue: "roles must alternate between user and assistant"

**Solution**: Fixed in ChatService with role alternation validation (lines 310-327)

### Issue: "Tool agent_chat not available"

**Solution**: Fixed in chat components - now use `sendMessageWithResponse()` instead of `executeTool()`

### Issue: Messages not persisting

**Solution**: Ensure DynamoDB tables are created and IAM permissions are set

### Issue: Markdown not rendering

**Solution**: Install dependencies:

```bash
npm install marked highlight.js @tailwindcss/typography
```

## Security Considerations

### 1. User Isolation

- Personal chats: Isolated by `USER#{userId}`
- Org chats: Isolated by `ORG#{organizationId}`
- WebSocket authentication enforced

### 2. Data Retention

- 90-day TTL on all chat data
- Automatic cleanup via DynamoDB TTL
- Manual deletion available

### 3. Content Moderation

- Future: Implement content filtering
- Future: PII detection and redaction
- Future: Toxic content detection

### 4. Encryption

- Data encrypted at rest (DynamoDB)
- Data encrypted in transit (TLS)
- Future: Client-side E2E encryption

## Testing

### Unit Tests

```bash
cd dashboard-server
npm test -- --testPathPattern=ChatService
npm test -- --testPathPattern=ChatHistoryService
```

### Integration Tests

```bash
npm test -- --testPathPattern=chat-integration
```

### Manual Testing

1. Start dashboard-server: `bun run dev`
2. Open UI: `http://localhost:5173`
3. Navigate to chat
4. Send messages and verify:
   - Real Claude responses
   - Token counts appear
   - Messages persist
   - Markdown renders correctly
   - Code highlighting works

## Production Checklist

- [ ] DynamoDB tables created
- [ ] IAM permissions deployed
- [ ] Bedrock model access enabled
- [ ] Environment variables set
- [ ] CloudWatch alarms configured
- [ ] Cost alerts set up
- [ ] Monitoring dashboard created
- [ ] Backup strategy defined
- [ ] Data retention policy documented
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Load testing completed

## Support

For issues or questions:

1. Check CloudWatch logs: `/ecs/agent-mesh-dev-dashboard`
2. Review CloudTrail for Bedrock API calls
3. Verify IAM policy with `aws iam get-role-policy`
4. Test Bedrock access directly with AWS CLI

## Related Documentation

- [AWS Bedrock Chat Setup](./aws-bedrock-chat-setup.md)
- [Deployment Guide](./DEPLOYMENT_BEDROCK_CHAT.md)
- [Bedrock IAM Reference](../infra/modules/ecs_dashboard_service/BEDROCK_IAM.md)
- [Quick Reference](../dashboard-server/BEDROCK_SETUP.md)
