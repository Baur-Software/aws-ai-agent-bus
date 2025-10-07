# 📦 Artifact Storage System - Context-Aware S3 Structure

## Overview

Workflows, custom shapes, and other files are now stored in **S3 artifacts** with proper context scoping (personal vs organizational) instead of KV store.

## ✅ Implementation Complete

### Files Modified

- ✅ [dashboard-ui/src/services/ArtifactService.ts](src/services/ArtifactService.ts) - New service for context-aware S3 storage
- ✅ [dashboard-ui/src/contexts/WorkflowContext.tsx](src/contexts/WorkflowContext.tsx) - Updated to use S3 artifacts

### Storage Architecture

#### S3 Path Structure

```
s3://agent-mesh-artifacts/
├── users/{userId}/
│   ├── workflows/
│   │   ├── {workflowId}.json
│   │   └── {workflowId}-v2.json
│   ├── shapes/
│   │   ├── {shapeId}.json
│   │   └── custom-node-{id}.json
│   ├── templates/
│   │   └── {templateId}.json
│   ├── agents/
│   │   └── {agentId}.md
│   └── files/
│       └── {fileId}.{ext}
│
├── orgs/{orgId}/
│   ├── workflows/
│   │   ├── {workflowId}.json
│   │   └── shared-workflow-{id}.json
│   ├── shapes/
│   │   ├── {shapeId}.json
│   │   └── org-standard-{id}.json
│   ├── templates/
│   │   └── {templateId}.json
│   └── files/
│       └── {fileId}.{ext}
│
└── system/
    ├── templates/
    │   ├── onboarding-template.json
    │   └── data-pipeline-template.json
    └── shapes/
        ├── standard-trigger.json
        └── standard-action.json
```

## 📋 Artifact Types

### 1. Workflows

**Path**: `users/{userId}/workflows/{workflowId}.json` OR `orgs/{orgId}/workflows/{workflowId}.json`

**Structure**:

```json
{
  "metadata": {
    "id": "workflow-123",
    "name": "Customer Onboarding",
    "description": "Automated customer onboarding flow",
    "version": "1.0.0",
    "organizationId": "acme",
    "collaborators": [...],
    "permissions": {...}
  },
  "nodes": [
    {
      "id": "node-1",
      "type": "trigger",
      "x": 100,
      "y": 100,
      "config": {...}
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "from": "node-1",
      "to": "node-2",
      "fromPort": "output",
      "toPort": "input"
    }
  ],
  "storyboards": [...],
  "lastSaved": "2025-10-01T03:00:00Z"
}
```

**Metadata**:

```json
{
  "type": "workflow",
  "context": "organizational",
  "userId": "user-123",
  "organizationId": "acme",
  "workflowName": "Customer Onboarding",
  "nodeCount": 12,
  "updatedAt": "2025-10-01T03:00:00Z"
}
```

### 2. Custom Shapes

**Path**: `users/{userId}/shapes/{shapeId}.json` OR `orgs/{orgId}/shapes/{shapeId}.json`

**Structure**:

```json
{
  "id": "custom-shape-123",
  "name": "Custom Data Processor",
  "category": "processing",
  "icon": "database",
  "color": "#3B82F6",
  "inputs": ["data"],
  "outputs": ["processed", "error"],
  "config": {
    "schema": {...},
    "defaults": {...}
  },
  "tags": ["data", "processing", "custom"]
}
```

### 3. Templates

**Path**: `system/templates/{templateId}.json` (system-wide)

**Structure**:

```json
{
  "id": "template-onboarding",
  "name": "Customer Onboarding Template",
  "description": "Pre-built workflow for customer onboarding",
  "category": "customer",
  "workflow": {
    "nodes": [...],
    "connections": [...]
  },
  "tags": ["onboarding", "customer", "automation"]
}
```

## 🔧 ArtifactService API

### Save Workflow

```typescript
// Personal workflow
await artifactService.save(workflowId, workflowData, {
  type: 'workflow',
  context: 'personal',
  tags: ['automation', 'crm']
});

// Organizational workflow
await artifactService.save(workflowId, workflowData, {
  type: 'workflow',
  context: 'organizational',
  tags: ['shared', 'onboarding']
});
```

### Load Workflow

```typescript
// Load from current context (auto-detects personal/org)
const workflow = await artifactService.get(workflowId, 'workflow');

// Load from specific context
const orgWorkflow = await artifactService.get(
  workflowId,
  'workflow',
  'organizational'
);
```

### List Workflows

```typescript
// List all workflows in current context
const workflows = await artifactService.listWorkflows();

// List all custom shapes
const shapes = await artifactService.listShapes();
```

### Share Workflow (Personal → Organizational)

```typescript
// Copy workflow from personal to organizational context
const result = await artifactService.shareWorkflow(workflowId);
console.log('Shared to:', result.key);
// Output: orgs/acme/workflows/workflow-123.json
```

### Search Across Contexts

```typescript
// Search workflows across personal and organizational
const results = await artifactService.search(
  'workflow',
  'onboarding',
  ['personal', 'organizational']
);
```

## 🚀 Usage in WorkflowContext

### Save Workflow (Updated)

```typescript
const saveWorkflow = async () => {
  const workflow = currentWorkflow();
  const context = currentOrganization() ? 'organizational' : 'personal';

  // Build S3 key based on context
  const key = context === 'organizational'
    ? `orgs/${currentOrganization()!.id}/workflows/${workflow.id}.json`
    : `users/${user()?.userId}/workflows/${workflow.id}.json`;

  // Save to S3 via MCP artifacts_put
  const content = JSON.stringify(workflowData, null, 2);
  const base64Content = btoa(content);

  await dashboardServer.callMCPTool('artifacts_put', {
    key,
    content: base64Content,
    content_type: 'application/json',
    metadata: {
      type: 'workflow',
      context,
      userId: user()?.userId,
      organizationId: currentOrganization()?.id,
      workflowName: workflow.name,
      nodeCount: currentNodes().length,
      updatedAt: new Date().toISOString()
    }
  });

  console.log(`✅ Workflow saved to: ${key}`);
};
```

### Load Workflow (Updated)

```typescript
const loadWorkflow = async (workflowId: string) => {
  const context = currentOrganization() ? 'organizational' : 'personal';

  const artifactKey = context === 'organizational'
    ? `orgs/${currentOrganization()!.id}/workflows/${workflowId}.json`
    : `users/${user()?.userId}/workflows/${workflowId}.json`;

  const artifactResult = await dashboardServer.callMCPTool('artifacts_get', {
    key: artifactKey
  });

  if (artifactResult?.content) {
    // Decode base64 content
    const content = atob(artifactResult.content);
    const workflowData = JSON.parse(content);

    // Load nodes and connections
    setCurrentNodes(workflowData.nodes || []);
    setCurrentConnections(workflowData.connections || []);
    setCurrentStoryboards(workflowData.storyboards || []);

    console.log(`✅ Loaded workflow from S3: ${workflowData.nodes?.length} nodes`);
  }
};
```

## 🔄 Context Switching Behavior

### Personal Context

```
User: user-123
Context: Personal
Storage: users/user-123/workflows/
```

**When user saves a workflow**:

- Saves to: `users/user-123/workflows/{workflowId}.json`
- Only visible to user-123
- Not accessible to organization

### Organizational Context

```
User: user-123
Organization: acme
Context: Organizational
Storage: orgs/acme/workflows/
```

**When user saves a workflow**:

- Saves to: `orgs/acme/workflows/{workflowId}.json`
- Visible to all org members (with permissions)
- Separate from personal workflows

### Switching Contexts

```typescript
// User switches from Personal → Acme Corp
switchOrganization('acme');

// WorkflowContext automatically:
// 1. Detects context change (createEffect)
// 2. Reloads workflows from: orgs/acme/workflows/
// 3. Lists only organizational workflows
// 4. Saves new workflows to org context
```

## 📊 Benefits Over KV Store

### Before (KV Store)

❌ All workflows in single flat namespace
❌ Manual key prefixing (`workflow-{id}`)
❌ No automatic context detection
❌ Limited to small JSON blobs
❌ No version history
❌ Difficult to list/search

### After (S3 Artifacts)

✅ Hierarchical structure (users/orgs/system)
✅ Automatic context-aware paths
✅ Built-in personal vs org isolation
✅ No size limits (workflows can be large)
✅ S3 versioning enabled
✅ Easy to list by prefix (context)
✅ Metadata in S3 object tags
✅ Direct file download URLs

## 🎯 Migration Path

### Existing KV-stored Workflows

```typescript
// Old KV pattern
const kvKey = `workflow-${workflowId}`;
await kvStore.set(kvKey, JSON.stringify(workflowData));

// New artifact pattern
const key = `users/${userId}/workflows/${workflowId}.json`;
await callMCPTool('artifacts_put', {
  key,
  content: btoa(JSON.stringify(workflowData)),
  content_type: 'application/json'
});
```

### Automatic Migration (TODO)

```typescript
// Scan all workflow-* keys in KV
const kvWorkflows = await kvStore.list('workflow-');

// Migrate each to S3 artifacts
for (const kvWorkflow of kvWorkflows) {
  const workflowData = await kvStore.get(kvWorkflow.key);
  const workflowId = kvWorkflow.key.replace('workflow-', '');

  await artifactService.save(workflowId, workflowData, {
    type: 'workflow',
    context: 'personal' // Default to personal
  });

  console.log(`Migrated: ${kvWorkflow.key} → users/${userId}/workflows/${workflowId}.json`);
}
```

## 🔗 Related Files

- ✅ [dashboard-ui/src/services/ArtifactService.ts](src/services/ArtifactService.ts) - Artifact service implementation
- ✅ [dashboard-ui/src/contexts/WorkflowContext.tsx](src/contexts/WorkflowContext.tsx) - Workflow storage logic
- 📚 [mcp-rust/src/rest/artifacts_put.rs](../../mcp-rust/src/rest/artifacts_put.rs) - S3 upload handler
- 📚 [mcp-rust/src/rest/artifacts_get.rs](../../mcp-rust/src/rest/artifacts_get.rs) - S3 download handler
- 📚 [mcp-rust/src/rest/artifacts_list.rs](../../mcp-rust/src/rest/artifacts_list.rs) - S3 list handler

## 📝 Next Steps

### Custom Shapes Integration

- [ ] Update FloatingNodePanel to load shapes from artifacts
- [ ] Add shape editor UI
- [ ] Support drag-and-drop shape upload
- [ ] Shape marketplace (browse community shapes)

### Template System

- [ ] Seed system templates to S3
- [ ] Template browser UI
- [ ] One-click template instantiation
- [ ] Template versioning

### File Management

- [ ] General file upload (images, docs, etc.)
- [ ] File browser UI
- [ ] Direct S3 download links
- [ ] File sharing (personal → org)

### Advanced Features

- [ ] Workflow versioning (S3 versioning API)
- [ ] Workflow comparison (diff tool)
- [ ] Bulk operations (export all, backup)
- [ ] Cross-organization sharing
