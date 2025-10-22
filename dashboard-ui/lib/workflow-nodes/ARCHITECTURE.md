# Workflow Nodes Architecture

## Overview

The workflow nodes package (`@ai-agent-bus/workflow-nodes`) provides a centralized, tenant-scoped system for managing workflow node definitions and configurations.

## Architecture Principles

### 1. Single Source of Truth
All node definitions are stored in the **NodeRegistry**, eliminating scattered configurations across:
- ❌ `nodeDefinitions.ts` (old - 116 nodes missing config fields)
- ❌ `WorkflowNodeDetails.tsx getNodeConfig()` (old - hardcoded configs)
- ✅ `@ai-agent-bus/workflow-nodes` (new - centralized registry)

### 2. Tenant-Scoped Configuration
Organizations can customize nodes per tenant:
- Enable/disable specific node types
- Override default values
- Customize field options
- Set usage policies and permissions

### 3. Type-Safe Interfaces
All nodes use standardized TypeScript interfaces:
```typescript
interface NodeDefinition {
  type: string;
  name: string;
  category: 'triggers' | 'actions' | 'logic' | ...;
  subcategory?: string;
  fields?: NodeField[];
  defaultConfig?: Record<string, any>;
  hasDedicatedComponent?: boolean;
  // ... more properties
}
```

## File Structure

```
lib/workflow-nodes/
├── index.ts                    # Main exports + auto-registration
├── NodeRegistry.ts             # Registry system + interfaces
├── TenantNodeConfig.ts         # Tenant-scoped customization
├── nodes/                      # Node definitions by category
│   ├── TriggerNodes.ts        # Manual, webhook, schedule, event triggers
│   ├── HttpNodes.ts           # HTTP, GraphQL, REST API nodes
│   ├── LogicNodes.ts          # Conditional, switch, loop, filter
│   ├── DataNodes.ts           # KV, S3, database operations (TODO)
│   ├── IntegrationNodes.ts    # Slack, Google, Stripe, etc. (TODO)
│   ├── AINodes.ts             # AI agents and models (TODO)
│   └── NotificationNodes.ts   # Email, SMS, push notifications (TODO)
├── ConditionalNodeConfig.tsx   # Dedicated component
├── HttpNodeConfig.tsx          # Dedicated component
└── ... (other dedicated components)
```

## Node Definition Patterns

### Pattern 1: Field-Based Configuration (Generic)
Most nodes use a simple field-based configuration:

```typescript
{
  type: 'http-request',
  name: 'HTTP Request',
  category: 'actions',
  subcategory: 'http',
  fields: [
    { key: 'url', label: 'URL', type: 'text', required: true },
    { key: 'method', label: 'Method', type: 'select', options: [...] }
  ],
  defaultConfig: {
    method: 'GET',
    timeout: 30000
  }
}
```

This pattern:
- ✅ Works for 90% of nodes
- ✅ Renders automatically via generic form builder
- ✅ Easy to add new nodes
- ✅ Supports tenant customization

### Pattern 2: Dedicated Component (Complex)
Complex nodes with rich UIs use dedicated components:

```typescript
{
  type: 'conditional',
  name: 'Conditional (If/Else)',
  hasDedicatedComponent: true,
  componentName: 'ConditionalNodeConfig',
  defaultConfig: {
    conditions: [...]
  }
}
```

This pattern:
- ✅ Rich, interactive UIs (drag-drop, visual builders)
- ✅ Complex validation logic
- ✅ Custom state management
- ❌ More code to maintain

Examples: `ConditionalNodeConfig`, `HttpNodeConfig`, `TriggerNodeConfig`, `DockerNodeConfig`

## Tenant-Scoped Configuration

### Storage Pattern

Tenant configurations are stored in KV with tenant isolation:
```
Key: tenant-{tenantId}-node-config-{nodeType}
Value: TenantNodeConfig (JSON)
```

### Example: Restrict HTTP Methods

```typescript
const config: TenantNodeConfig = {
  tenantId: 'org-acme',
  nodeType: 'http-request',
  enabled: true,

  fieldOverrides: {
    method: {
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' }
        // PUT, DELETE removed for this tenant
      ]
    }
  },

  policies: {
    allowedRoles: ['developer', 'admin']
  }
};
```

### Example: Set Organization Defaults

```typescript
const config: TenantNodeConfig = {
  tenantId: 'org-acme',
  nodeType: 'http-request',

  defaultConfig: {
    baseUrl: 'https://api.acme.internal',
    timeout: 30000,
    headers: {
      'X-API-Key': '${env.ACME_API_KEY}'
    }
  }
};
```

## Usage Examples

### 1. Get Node Definition

```typescript
import { getNodeDefinition } from '@ai-agent-bus/workflow-nodes';

const nodeDef = getNodeDefinition('http-request');
console.log(nodeDef.fields); // Array of NodeField
```

### 2. Get Default Configuration

```typescript
import { getRegistryDefaultConfig } from '@ai-agent-bus/workflow-nodes';

const defaults = getRegistryDefaultConfig('http-request');
// { method: 'GET', timeout: 30000, ... }
```

### 3. Apply Tenant Customization

```typescript
import { TenantNodeConfigService, getNodeDefinition } from '@ai-agent-bus/workflow-nodes';

const service = new TenantNodeConfigService(kvStore);
const baseDef = getNodeDefinition('http-request');
const customized = await service.applyTenantConfig('org-acme', baseDef);

// customized.defaultConfig has tenant overrides applied
// customized.fields may have modified options
// customized.isAvailable indicates if tenant can use this node
```

### 4. Check User Permissions

```typescript
const service = new TenantNodeConfigService(kvStore);
const result = await service.canUserUseNode(
  'org-acme',
  'http-request',
  'user-123',
  ['developer']
);

if (!result.allowed) {
  console.error(result.reason);
}
```

## Migration Path

### Phase 1: ✅ Foundation (Current)
- [x] Create `NodeRegistry.ts` with standardized interfaces
- [x] Create `TenantNodeConfig.ts` for tenant customization
- [x] Define example nodes (Triggers, HTTP, Logic)
- [x] Auto-register nodes on module load

### Phase 2: Add Remaining Nodes
- [ ] Create `DataNodes.ts` (KV, S3, database)
- [ ] Create `IntegrationNodes.ts` (Slack, Google, Stripe, etc.)
- [ ] Create `AINodes.ts` (agent-conductor, agent-critic, etc.)
- [ ] Create `NotificationNodes.ts` (email, SMS, push)

### Phase 3: Update Consumers
- [ ] Update `WorkflowNodeDetails.tsx` to use `getNodeDefinition()`
- [ ] Update `FloatingNodePanel` to filter based on tenant config
- [ ] Remove hardcoded configs from `getNodeConfig()`
- [ ] Deprecate old `nodeDefinitions.ts`

### Phase 4: Tenant UI
- [ ] Add node management page to Settings
- [ ] Allow admins to enable/disable nodes
- [ ] Allow admins to set default values
- [ ] Allow admins to configure policies

## Benefits

### For Developers
- ✅ Single place to add new nodes
- ✅ Type-safe interfaces
- ✅ Auto-completion in IDE
- ✅ Consistent patterns

### For Organizations
- ✅ Control which nodes users can access
- ✅ Set organization-wide defaults
- ✅ Enforce security policies
- ✅ Customize for their workflow

### For Users
- ✅ Pre-configured nodes with smart defaults
- ✅ Nodes relevant to their role
- ✅ Consistent UI experience

## Example: Adding a New Node

```typescript
// 1. Add to appropriate category file (e.g., nodes/IntegrationNodes.ts)
export const INTEGRATION_NODES: NodeDefinition[] = [
  // ... existing nodes
  {
    type: 'slack-message',
    name: 'Send Slack Message',
    description: 'Post message to Slack channel',
    category: 'integrations',
    subcategory: 'communication',
    icon: '💬',
    color: 'bg-purple-500',
    requiresIntegration: 'slack',
    fields: [
      {
        key: 'channel',
        label: 'Channel',
        type: 'text',
        required: true,
        placeholder: '#general'
      },
      {
        key: 'message',
        label: 'Message',
        type: 'textarea',
        required: true
      }
    ],
    defaultConfig: {
      channel: '#general'
    }
  }
];

// 2. Export from category file
export { INTEGRATION_NODES } from './nodes/IntegrationNodes';

// 3. Register in index.ts
import { INTEGRATION_NODES } from './nodes/IntegrationNodes';
registerNodes([
  ...TRIGGER_NODES,
  ...HTTP_NODES,
  ...LOGIC_NODES,
  ...INTEGRATION_NODES // Add this
]);

// That's it! Node is now available everywhere.
```

## Future Enhancements

1. **Node Marketplace**
   - Allow users to publish/share custom nodes
   - Community-contributed nodes
   - Version management

2. **Dynamic Node Loading**
   - Load nodes from external packages
   - Plugin system for third-party nodes

3. **Visual Node Builder**
   - Use the Node Designer to create custom nodes
   - Generate node definitions from UI
   - Save to tenant config

4. **Analytics**
   - Track which nodes are used most
   - Identify unused nodes for cleanup
   - Usage patterns per tenant
