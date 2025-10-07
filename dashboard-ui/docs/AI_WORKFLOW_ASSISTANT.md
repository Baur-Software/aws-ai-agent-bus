# AI Workflow Assistant - Implementation Plan

## Overview

An AI-powered workflow design assistant that helps users create workflows through natural language conversation using Claude via AWS Bedrock.

## User Experience Flow

### 1. Opening the Assistant

- **UI**: Floating chat button (bottom-right of canvas)
- **States**:
  - `launcher`: Collapsed button with notification dot
  - `agentchat`: Expanded chat panel (320x400px)
  - `planning`: Full-screen planning mode with workflow preview

### 2. Conversation Example

```
User: "Create a workflow that monitors my top Google Analytics pages daily and posts them to Slack"

AI: "I'll help you create that workflow! Here's what I'm designing:

📊 **Workflow: Daily GA Top Pages to Slack**

Nodes:
1. ⏰ Schedule Trigger (daily at 9am)
2. 📈 Google Analytics - Get Top Pages (last 24h)
3. 📝 Format Message (markdown table)
4. 💬 Slack - Post Message (#analytics channel)

Required Integrations:
- ✅ Google Analytics (connected)
- ❌ Slack (not connected) [Install →]

Would you like me to:
- Create this workflow now
- Adjust the schedule or format
- Add more analytics data"
```

### 3. Deep Linking

- AI can generate links: `[Install Slack →](/apps/slack)`
- Links open apps tab and pre-filter to specific app
- One-click connection flow

### 4. Planning Mode

- Split screen: AI chat on left, workflow canvas preview on right
- Live editing: User can drag/drop nodes while chatting
- AI updates suggestions based on manual changes

## Technical Architecture

### Frontend Components

#### 1. CollapsibleAgentChat (existing, needs fixes)

**Location**: `dashboard-ui/src/components/workflow/ui/CollapsibleAgentChat.tsx`
**State Management**: WorkflowUIContext
**Missing Properties**:

```typescript
// Add to WorkflowUIState interface:
agentChatState: () => 'launcher' | 'agentchat' | 'planning';
setAgentChatState: (state: 'launcher' | 'agentchat' | 'planning') => void;
agentChatPosition: () => { x: number; y: number };
setAgentChatPosition: (pos: { x: number; y: number }) => void;
isAgentChatPinned: () => boolean;
setIsAgentChatPinned: (pinned: boolean) => void;
```

#### 2. AgentChat (existing, needs API wiring)

**Location**: `dashboard-ui/src/components/AgentChat.tsx`
**Current Issues**:

- References `agents` property that doesn't exist in DashboardServerContext
- Needs to use ChatService API instead

**Required Changes**:

```typescript
// Remove:
const { agents } = useDashboardServer(); // ❌ doesn't exist

// Add to DashboardServerContext:
chat: {
  createSession: (title: string, backend?: 'bedrock') => Promise<string>;
  sendMessage: (sessionId: string, message: string) => Promise<ChatResponse>;
  getHistory: (sessionId: string) => Promise<ChatMessage[]>;
}
```

### Backend Services

#### 1. ChatService (existing, ready to use!)

**Location**: `dashboard-server/src/services/ChatService.ts`
**Already Has**:

- ✅ Bedrock integration
- ✅ Session management
- ✅ Message history
- ✅ MCP tool integration

**Needs**:

- WebSocket handler integration
- Workflow generation system prompt
- Response parsing for workflow JSON

#### 2. WebSocket Message Handlers (new)

**Location**: `dashboard-server/src/websocket/chatHandler.ts` (create)

```typescript
interface ChatMessages {
  'chat.create_session': { title: string; backend?: 'bedrock' };
  'chat.send_message': { sessionId: string; message: string };
  'chat.get_history': { sessionId: string };
}

// Response includes:
// - message content
// - workflow JSON (if generated)
// - deep links
// - required apps
```

#### 3. Workflow Generation Prompt

**System Prompt** (added to ChatService):

```typescript
const WORKFLOW_ASSISTANT_PROMPT = `You are an AI workflow design assistant.
Help users create automation workflows using available MCP tools and integrations.

Available MCP Tools:
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

User's Connected Integrations:
${connectedApps.map(a => `- ${a.name} (${a.provider})`).join('\n')}

When suggesting workflows:
1. Use only available tools/integrations
2. Provide workflow JSON in this format:
   \`\`\`json
   {
     "name": "workflow name",
     "nodes": [...],
     "edges": [...]
   }
   \`\`\`
3. Suggest missing integrations with deep links: [Install Slack →](/apps/slack)
4. Explain each step clearly
5. Offer alternatives and refinements

Be conversational and helpful!`;
```

## Implementation Phases

### Phase 1: Fix Broken UI (1-2 hours)

- [x] Document architecture
- [ ] Add missing properties to WorkflowUIContext
- [ ] Add `chat` API to DashboardServerContext
- [ ] Fix AgentChat component imports
- [ ] Test: Chat panel opens/closes without crashing

### Phase 2: Wire Up Bedrock (2-3 hours)

- [ ] Create `chatHandler.ts` WebSocket handlers
- [ ] Add workflow generation system prompt to ChatService
- [ ] Integrate ChatService with WebSocket server
- [ ] Add MCP context injection (available tools, connected apps)
- [ ] Test: Send message, get Claude response

### Phase 3: Workflow Generation (3-4 hours)

- [ ] Parse Claude responses for workflow JSON
- [ ] Add workflow preview in planning mode
- [ ] Implement "Create Workflow" button
- [ ] Generate nodes/edges from JSON
- [ ] Test: Full workflow generation flow

### Phase 4: Deep Linking & Polish (2-3 hours)

- [ ] Parse AI responses for app links
- [ ] Implement app navigation from chat
- [ ] Add workflow editing in planning mode
- [ ] Add conversation history persistence
- [ ] Polish UI/UX

## Total Estimate: 8-12 hours of focused work

## Success Criteria

1. ✅ Chat panel opens without errors
2. ✅ User can send messages and get Claude responses
3. ✅ AI understands available MCP tools and apps
4. ✅ AI generates valid workflow JSON
5. ✅ User can create workflow with one click
6. ✅ Deep links navigate to apps tab
7. ✅ Planning mode shows live preview

## Future Enhancements

- Workflow templates library
- Multi-step workflow refinement
- Cost estimation before creating
- Workflow testing/debugging assistance
- Integration recommendations based on usage
