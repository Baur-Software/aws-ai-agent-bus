# AI Chat Implementation - Quick Start Guide

## Architecture Overview

**Event-Driven Chat with MCP Tool Access:**

```
User (WebSocket) → Dashboard Server → ChatService → AWS Bedrock (Claude 3)
                                           ↓
                                    MCP Registry (tenant context)
                                           ↓
                                    Claude uses tools:
                                    - kv_get (integrations)
                                    - list workflows
                                    - check permissions
```

## What Already Exists ✅

### Backend

- **ChatService** (`dashboard-server/src/services/ChatService.ts`)
  - Bedrock integration configured
  - `getAvailableTools()` queries MCP registry
  - Session management
  - Tool context injection

- **MCPServiceRegistry**
  - Lists all available MCP tools
  - Tenant-aware tool execution

- **WebSocket Infrastructure** (`dashboard-server/src/websocket/handlers.ts`)
  - Message routing
  - Authentication
  - User context

### Frontend

- **CollapsibleAgentChat** component (needs fixes)
- **AgentChat** component (needs API wiring)
- **DashboardServerContext** with `sendMessageWithResponse()`

## What Needs to Be Built 🔨

### 1. WebSocket Chat Handlers (30 min)

**File:** `dashboard-server/src/websocket/handlers.ts`

Add to `handleWebSocketMessage` switch:

```typescript
case 'chat.send_message': {
  const { sessionId, message } = message.data;
  const chatService = getChatService(); // Initialize once globally

  // Create session if needed
  let targetSessionId = sessionId;
  if (!targetSessionId) {
    const session = await chatService.createSession(
      userContext.userId,
      'New Chat',
      'bedrock',
      userContext.organizationId
    );
    targetSessionId = session.sessionId;
  }

  // Send message and get AI response
  const response = await chatService.sendMessage({
    sessionId: targetSessionId,
    message,
    userId: userContext.userId,
    organizationId: userContext.organizationId
  });

  ws.send(JSON.stringify({
    id: message.id,
    type: 'chat.message_response',
    data: {
      sessionId: targetSessionId,
      message: response
    }
  }));
  break;
}

case 'chat.get_history': {
  const { sessionId } = message.data;
  const chatService = getChatService();
  const session = chatService.getSession(sessionId);

  ws.send(JSON.stringify({
    id: message.id,
    type: 'chat.history_response',
    data: {
      messages: session?.messages || []
    }
  }));
  break;
}
```

### 2. Initialize ChatService Globally (5 min)

**File:** `dashboard-server/src/websocket/handlers.ts`

```typescript
import { ChatService } from '../services/ChatService.js';

// At top of file, after imports
let chatServiceInstance: ChatService | null = null;

function getChatService(): ChatService {
  if (!chatServiceInstance) {
    const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const mcpRegistry = new MCPServiceRegistry();

    chatServiceInstance = new ChatService(dynamodb, eventBridge, mcpRegistry, {
      bedrock: {
        region: process.env.AWS_REGION || 'us-west-2',
        modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'
      }
    });
  }
  return chatServiceInstance;
}
```

### 3. Add Agent Chat State to WorkflowUIContext (15 min)

**File:** `dashboard-ui/src/contexts/WorkflowUIContext.tsx`

```typescript
export interface WorkflowUIState {
  // ... existing properties ...

  // Agent chat state
  agentChatState: () => 'launcher' | 'agentchat' | 'planning';
  setAgentChatState: (state: 'launcher' | 'agentchat' | 'planning') => void;
  agentChatPosition: () => { x: number; y: number };
  setAgentChatPosition: (pos: { x: number; y: number }) => void;
  isAgentChatPinned: () => boolean;
  setIsAgentChatPinned: (pinned: boolean) => void;
}

// In provider:
const [agentChatState, setAgentChatState] = createSignal<'launcher' | 'agentchat' | 'planning'>('launcher');
const [agentChatPosition, setAgentChatPosition] = createSignal({ x: 20, y: 20 });
const [isAgentChatPinned, setIsAgentChatPinned] = createSignal(false);

// Add to value object:
agentChatState,
setAgentChatState,
agentChatPosition,
setAgentChatPosition,
isAgentChatPinned,
setIsAgentChatPinned,
```

### 4. Fix AgentChat Component (20 min)

**File:** `dashboard-ui/src/components/AgentChat.tsx`

```typescript
// Remove this line (doesn't exist):
// const { agents } = useDashboardServer(); ❌

// Use this instead:
const { sendMessageWithResponse } = useDashboardServer();

// In handleSendMessage:
const response = await sendMessageWithResponse({
  type: 'chat.send_message',
  data: {
    sessionId: currentSessionId(),
    message: input()
  }
});

setMessages(prev => [...prev, {
  id: response.data.message.messageId,
  type: 'assistant',
  content: response.data.message.content,
  timestamp: new Date()
}]);

setCurrentSessionId(response.data.sessionId);
```

### 5. Remove REST Chat Routes (2 min)

**Files to delete/modify:**

- Delete: `dashboard-server/src/routes/chatRoutes.ts`
- Edit: `dashboard-server/src/server.ts` - Remove chatRoutes import and app.use

### 6. Configure Bedrock with Workflow Generation Prompt (30 min)

**File:** `dashboard-server/src/services/ChatService.ts`

Enhance `getDefaultSystemPrompt()`:

```typescript
private getDefaultSystemPrompt(organizationId?: string, mcpContextId?: string): string {
  return `You are an AI workflow design assistant for an automation platform.

## Your Capabilities
- Help users create workflow automations using drag-and-drop nodes
- Access MCP tools to query user's connected integrations
- Generate workflow JSON that can be loaded into the workflow canvas
- Suggest missing integrations with deep links

## Available MCP Tools
Use tools to understand the user's context:
- kv_get: Check connected integrations (key: user-{userId}-integrations-*)
- agent_list: List available workflow agents
- Check user permissions and organization settings

## Workflow Generation Format
When creating workflows, respond with JSON:
\`\`\`json
{
  "name": "Workflow Name",
  "description": "What it does",
  "nodes": [
    {
      "id": "node-1",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "config": { ... }
    },
    ...
  ],
  "edges": [
    { "from": "node-1", "to": "node-2" }
  ]
}
\`\`\`

## Deep Linking
Suggest missing integrations with: [Install Slack →](/apps/slack)

Be conversational, helpful, and proactive!`;
}
```

## Testing Plan

### Phase 1: Basic Chat (30 min)

1. Start dashboard-server and dashboard-ui
2. Open browser console
3. Send test message via WebSocket
4. Verify response from Bedrock

### Phase 2: MCP Tool Access (30 min)

1. Prompt: "What integrations do I have connected?"
2. Claude should use `kv_get` to check
3. Verify tool calls in logs

### Phase 3: Workflow Generation (1 hour)

1. Prompt: "Create a workflow that posts daily analytics to Slack"
2. Claude generates workflow JSON
3. Add "Create Workflow" button in UI
4. Load JSON onto canvas

## Success Criteria

- ✅ Chat panel opens without errors
- ✅ Messages send/receive via WebSocket
- ✅ Claude can access MCP tools
- ✅ Claude understands tenant context
- ✅ Workflow JSON generation works
- ✅ No REST endpoints remain

## Estimated Time

**Total: 2-3 hours for full implementation**

- WebSocket handlers: 30 min
- Frontend fixes: 35 min
- Bedrock configuration: 30 min
- Testing & polish: 1 hour
