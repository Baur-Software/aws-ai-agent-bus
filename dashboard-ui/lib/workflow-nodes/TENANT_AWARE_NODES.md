# Tenant-Aware Node Configuration System

## Overview

The workflow node system now supports **two complementary paths** for node customization:

1. **Registry Node Customization** - Organization-level overrides for existing registry nodes
2. **Custom Node Creation** - Build entirely new nodes from scratch

Both paths are **tenant-aware** (organization-scoped) and integrated into a unified Node Designer interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Node Designer UI                          │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │  Create New     │         │  Customize      │           │
│  │  Custom Node    │         │  Registry Node  │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │ Custom Node      │       │ Tenant Override  │          │
│  │ Versioning       │       │ Configuration    │          │
│  │ (KV Store)       │       │ (KV Store)       │          │
│  └──────────────────┘       └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              WorkflowNodeDetails Component                   │
│                                                              │
│  1. Load from NodeRegistry (54 nodes)                       │
│  2. Apply TenantNodeConfig overrides                        │
│  3. Render configuration form                               │
└─────────────────────────────────────────────────────────────┘
```

## 1. Registry Node Customization

### Purpose
Allow organizations to customize **existing registry nodes** without modifying the base definitions:

- **Override field defaults** - Change default values for specific fields
- **Hide/show fields** - Control which fields are visible
- **Change field requirements** - Make optional fields required (or vice versa)
- **Set usage policies** - Require approval, limit executions, restrict to roles
- **Enable/disable nodes** - Turn nodes on/off per organization

### Storage Pattern
```
KV Store Key: tenant-{tenantId}-node-config-{nodeType}

Example:
  tenant-acme-corp-node-config-slack-message

Value (JSON):
{
  "tenantId": "acme-corp",
  "nodeType": "slack-message",
  "updatedAt": "2025-10-07T10:30:00Z",
  "updatedBy": "admin@acme.com",
  "enabled": true,
  "fieldOverrides": {
    "channel": {
      "required": true,
      "defaultValue": "#general",
      "help": "Use #general for company announcements"
    },
    "username": {
      "hidden": true  // Hide username field for this org
    }
  },
  "policies": {
    "requireApproval": true,
    "maxExecutionsPerDay": 100,
    "allowedRoles": ["admin", "marketing"]
  }
}
```

### User Experience

**In Node Designer:**
1. Click **"Customize Registry Node"** button
2. Pick from 54 available registry nodes (chart, table, HTTP, Slack, etc.)
3. Edit fields in visual form builder
4. Click **"Save Tenant Override"** button
5. Changes are saved as organization-level overrides

**In Workflow Builder:**
- Node configuration automatically reflects tenant customizations
- Original registry definition remains unchanged
- Changes apply to all workflows in that organization

### Code Example

```typescript
// Load node with tenant overrides
const tenantConfigService = new TenantNodeConfigService(kvStore);
const definition = getNodeDefinition('slack-message');

const customized = await tenantConfigService.applyTenantConfig(
  'acme-corp',
  definition
);

// customized.fields now reflects organization-specific overrides
```

## 2. Custom Node Creation

### Purpose
Build **completely new nodes** that don't exist in the registry:

- **Define custom fields** - Any field type (text, number, select, JSON, etc.)
- **Set node metadata** - Name, description, icon, color, category
- **Choose node shape** - Visual representation in workflow builder
- **Version control** - Track changes with semantic versioning (major.minor.patch)
- **AI assistance** - Generate node schemas from natural language

### Storage Pattern
```
KV Store Key: node-version-{nodeType}

Example:
  node-version-custom-salesforce-sync

Value (JSON):
{
  "nodeType": "custom-salesforce-sync",
  "versions": [
    {
      "version": "1.0.0",
      "schema": {
        "type": "custom-salesforce-sync",
        "name": "Salesforce Contact Sync",
        "description": "Sync contacts to Salesforce CRM",
        "category": "integrations",
        "icon": "☁️",
        "color": "bg-blue-600",
        "fields": [
          { "name": "contactId", "label": "Contact ID", "type": "text", "required": true },
          { "name": "syncDirection", "label": "Sync Direction", "type": "select", "options": ["to-sf", "from-sf"] }
        ]
      },
      "createdAt": "2025-10-07T10:00:00Z",
      "createdBy": "dev@acme.com",
      "changelog": "Initial version"
    },
    {
      "version": "1.1.0",
      "schema": { /* updated schema */ },
      "createdAt": "2025-10-07T11:00:00Z",
      "createdBy": "dev@acme.com",
      "changelog": "Added bi-directional sync support"
    }
  ],
  "currentVersion": "1.1.0"
}
```

### User Experience

**In Node Designer:**
1. Click **"Create New Node"** button (default mode)
2. Fill in node details (name, description, category)
3. Add fields one by one using visual form builder
4. Generate node schema using AI assistant (optional)
5. Save with semantic versioning:
   - **Patch** (1.0.0 → 1.0.1) - Bug fixes
   - **Minor** (1.0.0 → 1.1.0) - New features
   - **Major** (1.0.0 → 2.0.0) - Breaking changes
6. View version history and rollback if needed

### Code Example

```typescript
// Create and save a custom node
const versioningService = new NodeVersioningService(kvStore);

await versioningService.saveNodeVersion(
  'custom-salesforce-sync',
  {
    type: 'custom-salesforce-sync',
    name: 'Salesforce Contact Sync',
    description: 'Sync contacts to Salesforce CRM',
    category: 'integrations',
    fields: [...]
  },
  'dev@acme.com',
  'Added bi-directional sync support',
  'minor' // version bump type
);

// Rollback to previous version
await versioningService.rollbackToVersion(
  'custom-salesforce-sync',
  '1.0.0',
  'dev@acme.com'
);
```

## 3. Unified Node Designer Interface

### UI Components

**Header Section:**
```typescript
<div class="flex gap-2">
  <button onClick={createCustomNode}>
    🆕 Create New Node
  </button>
  <button onClick={() => setShowRegistryPicker(true)}>
    ✏️ Customize Registry Node
  </button>
</div>
```

**Mode Indicator:**
- **Create Mode**: "Build custom workflow nodes with AI assistance"
- **Registry Edit Mode**: "Customize registry node for your organization"

**Save Buttons:**
- **Custom Node Mode**: Semantic versioning buttons (Patch/Minor/Major)
- **Registry Edit Mode**: Single "Save Tenant Override" button

### Registry Node Picker Modal

**Grid Layout:**
- 54 registry nodes displayed in cards
- Each card shows: icon, name, description, category, subcategory
- Click to load node into editor
- Auto-populates form with current field definitions

**Customization Flow:**
1. Select node from picker
2. Fields are loaded into visual editor
3. Modify field properties (required, default, help text)
4. Save as tenant override
5. Original registry node remains unchanged

## 4. WorkflowNodeDetails Integration

### Loading Configuration

**Before (Hardcoded):**
```typescript
const getNodeConfig = (nodeType: string) => {
  const configs = {
    'slack-message': { title: '...', fields: [...] },
    'http-get': { title: '...', fields: [...] },
    // ... 20+ hardcoded configs
  };
  return configs[nodeType] || fallback;
};
```

**After (Registry + Tenant Overrides):**
```typescript
const loadNodeConfig = async (nodeType: string) => {
  // 1. Get base definition from registry
  let definition = getNodeDefinition(nodeType);

  if (definition) {
    // 2. Apply tenant-specific overrides
    const customized = await tenantConfigService.applyTenantConfig(
      currentTenantId,
      definition
    );

    return customized; // Tenant-aware config
  }

  // 3. Fallback to MCP registry or default
  return mcpFallback || defaultConfig;
};
```

### Reactive Loading

**Signal-Based:**
```typescript
const [nodeConfig, setNodeConfig] = createSignal<any>(null);

createEffect(async () => {
  if (props.node) {
    const config = await loadNodeConfig(props.node.type);
    setNodeConfig(config);
  }
});
```

**Template Usage:**
```tsx
<Show when={nodeConfig()}>
  <h3>{nodeConfig()!.title}</h3>
  <For each={nodeConfig()!.fields}>
    {(field) => <FieldRenderer field={field} />}
  </For>
</Show>
```

## 5. Benefits

### For Organizations
- **Control over nodes** - Enable/disable nodes per organization
- **Customize defaults** - Set organization-specific default values
- **Enforce policies** - Require approval, limit usage, restrict access
- **No code changes** - Customize without modifying codebase

### For Developers
- **Single source of truth** - All node definitions in NodeRegistry
- **Type safety** - Full TypeScript interfaces
- **Easy to extend** - Add new nodes in category files
- **Maintainable** - No scattered configurations

### For Power Users
- **Create custom nodes** - Build integrations for internal tools
- **Version control** - Track changes, rollback if needed
- **AI assistance** - Generate node schemas from descriptions
- **Visual design** - No code required

## 6. Migration Path

### Phase 1: ✅ Complete
- Created NodeRegistry with 54 nodes
- Created TenantNodeConfigService
- Updated Node Designer UI
- Integrated WorkflowNodeDetails

### Phase 2: 🚧 In Progress
- Create unified node management page
- Add tenant admin UI for node policies
- Build node marketplace (share custom nodes)

### Phase 3: 📋 Planned
- AI-powered node recommendations
- Node performance analytics
- Automated testing for custom nodes
- Multi-tenant node sharing

## 7. API Reference

### TenantNodeConfigService

```typescript
class TenantNodeConfigService {
  // Get tenant override for a node
  async getTenantNodeConfig(
    tenantId: string,
    nodeType: string
  ): Promise<TenantNodeConfig | null>

  // Save tenant override
  async saveTenantNodeConfig(
    config: TenantNodeConfig
  ): Promise<void>

  // Delete tenant override
  async deleteTenantNodeConfig(
    tenantId: string,
    nodeType: string
  ): Promise<void>

  // Apply tenant config to base definition
  async applyTenantConfig(
    tenantId: string,
    baseDefinition: NodeDefinition
  ): Promise<NodeDefinition & { isAvailable: boolean }>

  // Check if user can use node
  async canUserUseNode(
    tenantId: string,
    nodeType: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ allowed: boolean; reason?: string }>
}
```

### NodeVersioningService

```typescript
class NodeVersioningService {
  // Save new version of custom node
  async saveNodeVersion(
    nodeType: string,
    schema: NodeSchema,
    userId: string,
    changelog: string,
    versionType: 'major' | 'minor' | 'patch'
  ): Promise<NodeVersion>

  // Get version history
  async getVersionHistory(
    nodeType: string
  ): Promise<NodeVersionHistory | null>

  // Rollback to previous version
  async rollbackToVersion(
    nodeType: string,
    targetVersion: string,
    userId: string
  ): Promise<NodeVersion>

  // Get specific version
  async getVersion(
    nodeType: string,
    version: string
  ): Promise<NodeVersion | null>
}
```

## 8. Examples

### Example 1: Customize Slack Node for Organization

```typescript
// As organization admin
const tenantConfigService = new TenantNodeConfigService(kvStore);

await tenantConfigService.saveTenantNodeConfig({
  tenantId: 'acme-corp',
  nodeType: 'slack-message',
  updatedAt: new Date().toISOString(),
  updatedBy: 'admin@acme.com',
  enabled: true,
  fieldOverrides: {
    'channel': {
      required: true,
      defaultValue: '#general',
      help: 'All messages go to #general by default'
    }
  },
  policies: {
    requireApproval: true, // Manager approval required
    maxExecutionsPerDay: 100
  }
});
```

### Example 2: Create Custom Salesforce Node

```typescript
// As power user
const versioningService = new NodeVersioningService(kvStore);

await versioningService.saveNodeVersion(
  'custom-salesforce-sync',
  {
    type: 'custom-salesforce-sync',
    name: 'Salesforce Contact Sync',
    description: 'Bi-directional contact synchronization',
    category: 'integrations',
    subcategory: 'crm',
    icon: '☁️',
    color: 'bg-blue-600',
    fields: [
      {
        id: 'field-1',
        name: 'contactId',
        label: 'Contact ID',
        type: 'text',
        required: true,
        placeholder: 'SF-12345'
      },
      {
        id: 'field-2',
        name: 'syncDirection',
        label: 'Sync Direction',
        type: 'select',
        required: true,
        options: ['To Salesforce', 'From Salesforce', 'Bi-directional']
      }
    ]
  },
  'dev@acme.com',
  'Initial version with bi-directional sync',
  'minor'
);
```

## Summary

The tenant-aware node system provides **maximum flexibility** while maintaining **central control**:

- ✅ **54 registry nodes** out of the box
- ✅ **Organization-level customization** without code changes
- ✅ **Custom node creation** for power users
- ✅ **Version control** for all changes
- ✅ **Unified UI** in Node Designer
- ✅ **Automatic application** in Workflow Builder

This creates a **composable, extensible, and maintainable** system that scales from simple use cases to complex multi-tenant deployments.
