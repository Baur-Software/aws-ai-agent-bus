# Agent Management System

## Overview

The agent management system allows users to create, customize, and use AI agents as workflow nodes. Agents are stored in S3 with metadata cached in DynamoDB, following the same tenant-aware architecture as workflows and artifacts.

## Architecture

### Storage Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Storage Architecture                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐        ┌──────────────────┐            │
│  │ Agent Markdown  │        │ Agent Metadata   │            │
│  │ Prompts         │───────▶│ Cache            │            │
│  │                 │        │                  │            │
│  │ S3 Artifacts    │        │ KV Store         │            │
│  │ via             │        │ (DynamoDB)       │            │
│  │ ArtifactService │        │                  │            │
│  └─────────────────┘        └──────────────────┘            │
│         │                            │                       │
│         │ Tenant Context             │ Quick Lookups        │
│         │ Automatically              │ 30-day TTL          │
│         │ Handled                    │                      │
│         ▼                            ▼                       │
│  ┌─────────────────────────────────────────┐                │
│  │ Workflow Nodes                          │                │
│  │ Reference agents by ID + context        │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### File Paths (via ArtifactService)

- **System Agents**: `system/agents/{agentId}.md`
- **Personal Agents**: `users/{userId}/agents/{agentId}.md`
- **Organization Agents**: `orgs/{orgId}/agents/{agentId}.md`

### KV Store Keys

- **Metadata Cache**: `agent-metadata-{agentId}`
- **30-day TTL** for frequently accessed agent definitions

## Agent Definition Structure

```typescript
interface AgentDefinition {
  id: string;                      // Unique identifier
  name: string;                    // Display name
  description: string;             // Short description
  category: string;                // orchestrators | core | specialized | custom
  icon: string;                    // Emoji icon
  color: string;                   // Tailwind color class

  // Storage
  context: 'system' | 'personal' | 'organizational';
  version: number;                 // Incremented on updates

  // Metadata
  createdBy?: string;
  createdAt: string;
  updatedAt: string;

  // Capabilities
  requiredMCPTools?: string[];     // ['kv_get', 'artifacts_put']
  requiredIntegrations?: string[]; // ['github', 'slack']

  // Preview
  promptPreview?: string;          // First 200 chars of markdown
}
```

## Agent Prompt Format

Agents are stored as markdown files with optional YAML frontmatter:

```markdown
---
name: event-architect
description: |
  Event-driven architecture specialist focusing on EventBridge,
  pub/sub patterns, event sourcing, and CQRS.
---

# Event-Driven Architecture Specialist

You are an event-driven architecture expert...

## Required MCP Tools
```yaml
- events_send
- events_query
- kv_get
- kv_set
```

## Required Integrations
```yaml
- eventbridge (optional)
```

## Core Expertise

### Event-Driven Patterns
- Event sourcing and CQRS
- Pub/sub messaging patterns
...
```

## Service API

### AgentDefinitionService

```typescript
class AgentDefinitionService {
  // Seed system agents from .claude/agents (server-side)
  async seedSystemAgent(
    agentId: string,
    markdown: string,
    metadata: { category, name?, description? }
  ): Promise<AgentDefinition>

  // Get agent definition (checks metadata cache first)
  async getAgent(
    agentId: string,
    context?: ArtifactContext
  ): Promise<AgentDefinition | null>

  // Get full agent prompt markdown
  async getAgentPrompt(
    agentId: string,
    context?: ArtifactContext
  ): Promise<AgentPrompt | null>

  // Save agent (creates or updates)
  async saveAgent(
    agentId: string,
    markdown: string,
    metadata: {
      name: string;
      description?: string;
      category?: string;
      icon?: string;
      color?: string;
      context?: ArtifactContext;
    }
  ): Promise<AgentDefinition>

  // List agents in current context
  async listAgents(
    context?: ArtifactContext
  ): Promise<AgentDefinition[]>

  // Delete agent (user/org only, not system)
  async deleteAgent(
    agentId: string,
    context: 'personal' | 'organizational'
  ): Promise<void>

  // Fork system agent to user/org scope
  async forkAgent(
    systemAgentId: string,
    newName?: string,
    newId?: string
  ): Promise<AgentDefinition>
}
```

### Usage

```typescript
import { useArtifactService } from './services/ArtifactService';
import { useAgentDefinitionService } from './services/AgentDefinitionService';
import { useDashboardServer } from './contexts/DashboardServerContext';

// In component
const artifactService = useArtifactService();
const { callMCPTool } = useDashboardServer();
const agentService = useAgentDefinitionService(artifactService, { callMCPTool });

// List system agents
const systemAgents = await agentService.listAgents('system');

// Fork a system agent for customization
const customAgent = await agentService.forkAgent(
  'event-architect',
  'My Event Architect'
);

// Edit the forked agent
const prompt = await agentService.getAgentPrompt(customAgent.id);
const updatedMarkdown = prompt.markdown + '\n\n## My Custom Section\n...';

await agentService.saveAgent(customAgent.id, updatedMarkdown, {
  name: 'My Event Architect (v2)',
  description: 'Customized for our event patterns'
});

// Use in workflow node
const agentNode = {
  id: 'node-123',
  type: 'agent',
  config: {
    agentId: customAgent.id,
    agentContext: customAgent.context, // 'personal' or 'organizational'
    prompt: 'Design an event-driven workflow for...',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7
  }
};
```

## Workflow Integration

### Agent Node Type

Added to [nodeDefinitions.ts](../src/config/nodeDefinitions.ts):

```typescript
{
  type: 'agent',
  name: 'Agent',
  description: 'AI agent task executor',
  category: 'agents',
  icon: '🤖',
  color: 'bg-purple-600',
  configFields: [
    { key: 'agentId', label: 'Agent', type: 'select', required: true },
    { key: 'prompt', label: 'Additional Instructions', type: 'textarea' },
    { key: 'model', label: 'Model', type: 'select', options: [...] },
    { key: 'temperature', label: 'Temperature', type: 'number' }
  ],
  outputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      result: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['completed', 'failed', 'partial'] },
          output: { type: 'string' },
          artifacts: { type: 'array', items: { type: 'string' } },
          thinking: { type: 'string' }
        }
      },
      tokensUsed: { type: 'number' },
      duration: { type: 'number' }
    }
  }
}
```

### Dry-Run Support

Agent nodes use JSON Schema for sample data generation:

```typescript
// In dry-run mode, WorkflowEngine generates sample output from schema
const sampleOutput = sampleDataGenerator.generateFromSchema(agentNode.outputSchema);

// Example generated output:
{
  agentId: "event-architect",
  result: {
    status: "completed",
    output: "Sample agent output...",
    artifacts: ["artifact1.md", "artifact2.json"],
    thinking: "Sample reasoning process..."
  },
  tokensUsed: 1500,
  duration: 2.5
}
```

## Schema-Based Sample Data

### Migration from Hardcoded Samples

**Before** (hardcoded):
```typescript
defaultSampleOutput: {
  key: 'user-preferences',
  value: { theme: 'dark', language: 'en' },
  ttl: 3600,
  timestamp: '2025-09-30T10:30:00Z'
}
```

**After** (schema-based):
```typescript
outputSchema: {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'The key that was retrieved' },
    value: {
      type: 'object',
      description: 'The stored value',
      additionalProperties: true
    },
    ttl: { type: 'number', description: 'Time to live in seconds' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['key', 'value']
}
```

### SampleDataGenerator

The [sampleDataGenerator.ts](../src/utils/sampleDataGenerator.ts) generates realistic sample data from JSON Schema:

- **Formats**: date, date-time, email, uri, uuid, etc.
- **Enums**: First enum value selected
- **Descriptions**: Used as hints for sample generation
- **Defaults**: Used when provided
- **Nested objects**: Full support with depth limiting
- **Arrays**: Generated with 2-3 sample items

## Permissions & Security

### Tenant Isolation

- **System agents**: Read-only for all users
- **Personal agents**: Only accessible by creating user
- **Organizational agents**: Accessible by org members with proper roles

Enforced through:
1. **ArtifactService**: Automatically applies tenant context
2. **MCP Rust Backend**: Validates tenant context on all operations
3. **KV Store**: Scoped keys prevent cross-tenant access

### Operations Matrix

| Operation | System | Personal | Organizational |
|-----------|--------|----------|----------------|
| Read      | ✅ All | ✅ Owner | ✅ Org Members |
| Fork      | ✅ All | ❌ N/A   | ❌ N/A         |
| Create    | ❌ No  | ✅ Owner | ✅ Org Admins  |
| Update    | ❌ No  | ✅ Owner | ✅ Org Admins  |
| Delete    | ❌ No  | ✅ Owner | ✅ Org Admins  |

## Seeding System Agents

System agents from `.claude/agents/` should be seeded on first deployment:

```typescript
// Server-side script (dashboard-server)
import fs from 'fs';
import path from 'path';

const AGENT_PATHS = [
  '.claude/agents/universal/event-architect.md',
  '.claude/agents/universal/api-architect.md',
  '.claude/agents/conductor.md',
  '.claude/agents/critic.md',
  // ... all agent files
];

async function seedSystemAgents() {
  for (const agentPath of AGENT_PATHS) {
    const markdown = fs.readFileSync(agentPath, 'utf-8');
    const agentId = path.basename(agentPath, '.md');
    const category = extractCategoryFromPath(agentPath);

    await agentService.seedSystemAgent(agentId, markdown, {
      category,
      name: formatAgentName(agentId)
    });
  }
}
```

## UI Components

All components are canvas-based modals - no routing, stays on the workflow canvas.

### 1. Create Agent Wizard

**CreateAgentWizard.tsx** - AI-assisted agent creation (3-step wizard)

```typescript
const [showCreateWizard, setShowCreateWizard] = createSignal(false);

<Show when={showCreateWizard()}>
  <CreateAgentWizard
    onClose={() => setShowCreateWizard(false)}
    onCreated={(agent) => {
      console.log('Created agent:', agent.id);
      // Optionally: Add agent node to canvas
    }}
    agentService={agentService}
    mcpClient={mcpClient}
  />
</Show>
```

**3-Step Flow:**

**Step 1: Input**
- Agent name, category (custom/orchestrators/core/etc), icon
- Natural language description: "What should this agent do?"
- Tips and examples provided inline
- Validation: name and description required

**Step 2: Generating** (animated spinner)
- Calls LLM via MCP to generate professional markdown
- Uses Claude 3.5 Sonnet with agent generation prompt
- Shows progress indicator

**Step 3: Review**
- Displays generated markdown in editable textarea
- User can edit directly before creating
- "Back" button to modify description and regenerate
- "Create Agent" saves to S3 + KV cache

**Features:**
- 🪄 AI-powered generation from natural language
- ✏️ Editable before finalizing
- 📝 Inline tips and examples
- 🎨 Customizable metadata (name, icon, category)

### 2. Agent Editor Modal

**AgentPromptEditor.tsx** - Edit existing agent prompts

```typescript
const [showEditor, setShowEditor] = createSignal(false);
const [editingAgentId, setEditingAgentId] = createSignal<string>('');

<Show when={showEditor()}>
  <AgentPromptEditor
    agentId={editingAgentId()}
    context="personal" // or 'system', 'organizational'
    onSave={async (markdown, metadata) => {
      await agentService.saveAgent(editingAgentId(), markdown, metadata);
    }}
    onClose={() => setShowEditor(false)}
    agentService={agentService}
  />
</Show>
```

**Features:**
- 📝 Full markdown editor with monospace font
- 👁️ Preview toggle (Edit ⟷ Preview)
- 🔒 Read-only for system agents
- 🔀 Fork button for system agents
- 📊 Metadata editor (name, icon, description, category)
- 📏 Live character count
- 🏷️ Auto-extracted capabilities from markdown
- ⚠️ Warning banner when editing system agents

### 3. Agent Selector

**AgentSelector.tsx** - Choose agent for workflow node config

```typescript
<AgentSelector
  value={node.config.agentId}
  onChange={(agentId, context) => {
    updateNodeConfig({
      agentId,
      agentContext: context
    });
  }}
  onEdit={(agentId, context) => {
    setEditingAgentId(agentId);
    setEditingContext(context);
    setShowEditor(true);
  }}
  onFork={async (systemAgentId) => {
    const forked = await agentService.forkAgent(systemAgentId);
    updateNodeConfig({ agentId: forked.id });
  }}
  agentService={agentService}
/>
```

**Features:**
- 📋 Grouped dropdown (System Agents / My Agents / Team Agents)
- 💳 Agent info card showing:
  - Icon, name, description
  - Required MCP tools (blue badges)
  - Required integrations (purple badges)
  - Prompt preview (first 200 chars)
- ✏️ Edit button (read-only view for system agents)
- 🔀 Fork button (system agents only)
- 📊 Auto-loads on mount

## Canvas Integration

### Opening Modals from Canvas

All modals are triggered by canvas UI elements (no routes):

```typescript
// From floating toolbar "New Agent" button
<button onClick={() => setShowCreateWizard(true)}>
  🪄 Create Agent
</button>

// From agent node context menu
<MenuItem onClick={() => {
  setEditingAgentId(node.config.agentId);
  setShowEditor(true);
}}>
  ✏️ Edit Agent Prompt
</MenuItem>

// From node config panel
<AgentSelector
  onEdit={(id, ctx) => {
    setEditingAgentId(id);
    setShowEditor(true);
  }}
/>
```

### Event-Driven Updates

When agent is created/updated, publish event to EventBridge:

```typescript
// After saving agent
await eventsHandler.publish({
  detailType: 'agent.created',
  source: 'workflow-canvas',
  detail: {
    agentId: agent.id,
    context: agent.context,
    category: agent.category
  }
});

// Subscribers can reload agent lists
dashboardServer.subscribe(['agent.*'], (event) => {
  if (event.detailType === 'agent.created') {
    reloadAgentList();
  }
});
```

## Next Steps

1. **Add "Create Agent" button to floating toolbar**
2. **Wire up CreateAgentWizard to canvas**
3. **Implement `agent_generate` MCP tool** (LLM-powered generation)
4. **Add agent node context menu items** (Edit, Fork, Duplicate)
5. **Implement server-side seeding script** for `.claude/agents/`
6. **Add agent version history support**
7. **Build agent sharing/export features**

## Related Files

- [AgentDefinitionService.ts](../src/services/AgentDefinitionService.ts) - Core service
- [ArtifactService.ts](../src/services/ArtifactService.ts) - S3 storage with tenant context
- [nodeDefinitions.ts](../src/config/nodeDefinitions.ts) - Node type definitions
- [workflowEngine.ts](../src/utils/workflowEngine.ts) - Execution engine
- [sampleDataGenerator.ts](../src/utils/sampleDataGenerator.ts) - Schema-based sample generation
- [event-architect.md](../../.claude/agents/universal/event-architect.md) - Example agent
