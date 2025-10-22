# Workflow Nodes Library

**Location:** `dashboard-ui/lib/workflow-nodes`

This library provides dedicated components for workflow node configuration, following a component-based architecture instead of array-based generic rendering. The library is separated from the main components folder to enable potential extraction as an external npm package.

## Architecture Benefits

- **Performance**: No large array iterations or re-renders
- **Type Safety**: Dedicated TypeScript interfaces for each node type
- **Rich UIs**: Custom, purpose-built interfaces for complex node types
- **Maintainability**: Easier to understand and extend individual components
- **Modularity**: Can be extracted as external dependency (e.g., `@ai-agent-bus/workflow-nodes`)

## Usage

```typescript
import {
  // Logic Nodes
  ConditionalNodeConfig,
  SwitchNodeConfig,
  DEFAULT_CONDITIONAL_CONFIG,
  DEFAULT_SWITCH_CONFIG,

  // HTTP Nodes
  HttpNodeConfig,
  DEFAULT_HTTP_CONFIG,

  // Storage Nodes
  KVStoreNodeConfig,
  DEFAULT_KV_GET_CONFIG,
  DEFAULT_KV_SET_CONFIG,

  // Trigger Nodes
  TriggerNodeConfig,
  DEFAULT_MANUAL_TRIGGER_CONFIG,
  DEFAULT_WEBHOOK_TRIGGER_CONFIG,
  DEFAULT_SCHEDULE_TRIGGER_CONFIG,

  // Utils
  hasDedicatedComponent,

  // Types
  type ConditionalConfig,
  type SwitchConfig,
  type HttpConfig,
  type KVStoreConfig,
  type TriggerConfig
} from '../../lib/workflow-nodes';

// Check if node has dedicated component
if (hasDedicatedComponent(nodeType)) {
  // Render dedicated component
} else {
  // Fall back to generic config form
}
```

## Node Components

### Logic Nodes

#### ConditionalNodeConfig

Handles if/else if/else branching logic with:

- Visual condition builder
- JavaScript expression support
- Two evaluation modes: first-match and all-matches
- Reorderable conditions with up/down arrows
- Validation and help text

**Config Interface:**

```typescript
interface ConditionalConfig {
  conditions: Condition[];
  mode: 'first-match' | 'all-matches';
}

interface Condition {
  condition: string;  // JavaScript expression
  label: string;
  output: string;
}
```

#### SwitchNodeConfig

Handles switch/case routing with:

- Case builder with add/remove/reorder
- Default case support (catch-all)
- Output port naming
- Visual feedback for default case

**Config Interface:**

```typescript
interface SwitchConfig {
  value: string;  // Expression to evaluate
  cases: SwitchCase[];
}

interface SwitchCase {
  match: string;  // Value to match
  output: string; // Output port name
}
```

### HTTP Nodes

#### HttpNodeConfig

Handles all HTTP methods (GET, POST, PUT, DELETE, PATCH) with:

- Method selector buttons
- URL input with variable interpolation
- Headers builder (add/remove/edit)
- Request body editor (for POST/PUT/PATCH)
- Advanced options (timeout, redirects, SSL validation)

**Config Interface:**

```typescript
interface HttpConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
}
```

### Storage Nodes

#### KVStoreNodeConfig

Handles both KV get and set operations with:

- Key input with variable support
- Get-specific: default value, JSON parsing
- Set-specific: value editor, TTL, scope selector
- Contextual help and output examples

**Config Interfaces:**

```typescript
interface KVGetConfig {
  operation: 'get';
  key: string;
  defaultValue?: string;
  parseJson?: boolean;
}

interface KVSetConfig {
  operation: 'set';
  key: string;
  value: string;
  ttlHours?: number;
  scope?: 'user' | 'organization' | 'global';
}
```

### Trigger Nodes

#### TriggerNodeConfig

Handles all trigger types (manual, webhook, schedule) with:

- Manual: description field
- Webhook: path, method, authentication, API key
- Schedule: cron presets, custom expressions, timezone, enable/disable

**Config Interfaces:**

```typescript
interface ManualTriggerConfig {
  type: 'manual';
  description?: string;
}

interface WebhookTriggerConfig {
  type: 'webhook';
  path?: string;
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
  authentication?: 'none' | 'api-key' | 'bearer';
  apiKey?: string;
}

interface ScheduleTriggerConfig {
  type: 'schedule';
  schedule: string; // cron expression
  timezone?: string;
  enabled?: boolean;
}
```

### Compute Nodes

#### DockerNodeConfig

Handles Docker container execution with comprehensive configuration:

- **Basic**: Image, tag, command, arguments
- **Environment**: Key-value environment variables with add/remove
- **Volumes**: Host-to-container volume mounts with read-only option
- **Ports**: Port mappings (host:container) with TCP/UDP protocol
- **Advanced**: Working directory, user, network mode, resource limits (CPU/memory), timeout, auto-remove

**Config Interface:**

```typescript
interface DockerConfig {
  image: string;
  tag?: string;
  command?: string;
  args?: string[];
  env?: EnvironmentVariable[];
  volumes?: VolumeMount[];
  ports?: PortMapping[];
  workDir?: string;
  user?: string;
  network?: string;
  removeAfter?: boolean;
  cpuLimit?: string;
  memoryLimit?: string;
  timeout?: number;
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readOnly?: boolean;
}

interface PortMapping {
  hostPort: number;
  containerPort: number;
  protocol?: 'tcp' | 'udp';
}
```

## Adding New Node Components

1. Create component file: `YourNodeConfig.tsx`
2. Export interfaces and default config
3. Add to `index.ts` exports
4. Update `NODE_COMPONENT_REGISTRY`
5. Add conditional rendering in `WorkflowNodeDetails.tsx`

Example structure:

```typescript
// YourNodeConfig.tsx
export interface YourConfig {
  // ... config properties
}

export const DEFAULT_YOUR_CONFIG: YourConfig = {
  // ... defaults
};

export function YourNodeConfig(props: {
  value: YourConfig;
  onChange: (value: YourConfig) => void;
}) {
  // ... component implementation
}
```

## External Dependency Pattern

This module is designed to be extractable as an external dependency:

```typescript
// Could be published as: @ai-agent-bus/workflow-nodes
import { ConditionalNodeConfig, SwitchNodeConfig } from '@ai-agent-bus/workflow-nodes';
```

## Current Coverage

**Static System Nodes (Dedicated Components):**

- ✅ Logic: Conditional, Switch
- ✅ HTTP: GET, POST, PUT, DELETE, PATCH
- ✅ Storage: KV Get, KV Set
- ✅ Triggers: Manual, Webhook, Schedule
- ✅ Compute: Docker Container

**Dynamic/Generic Nodes (Fallback to Generic Form):**

- 🔌 MCP-generated agents and tools (discovered at runtime)
- 🤖 Agent nodes (conductor, critic, terraform, etc.)
- 📊 Analytics nodes (Google Analytics, custom integrations)
- 🔗 Integration-specific nodes (Slack, etc.)
- 🔄 Transform nodes (JSON parse, filter, etc.)

## Credential Management

Workflow nodes can require authentication via the credential system. This automatically connects nodes to user-configured integrations.

### Adding Credentials to Node Definitions

In `nodeDefinitions.ts`, add credential fields to nodes that need authentication:

```typescript
{
  type: 'my-api-node',
  name: 'My API Node',
  description: 'Call My API',
  category: 'integrations',
  requiresIntegration: 'my-api',      // Integration ID
  requiresCredentials: true,          // Requires auth
  configFields: [
    {
      key: 'credentialPath',            // Standard credential field name
      label: 'My API Connection',
      type: 'credential',               // Special type for credentials
      integrationId: 'my-api',          // Which integration to use
      required: true
    },
    {
      key: 'endpoint',
      label: 'API Endpoint',
      type: 'text',
      required: true
    }
  ]
}
```

### How It Works

1. **User Setup**: User connects their account via Integrations Settings
2. **Storage**: Credentials stored in KV store at path `org-{orgId}-user-{userId}-integration-{serviceId}-{connectionId}`
3. **Encryption**: Credentials are encrypted at rest by the backend KV store service
4. **Multiple Connections**: Users can have multiple named connections per service (e.g., "Work", "Personal")
5. **Node Config**: Workflow nodes show credential selector dropdown with available connections
6. **Storage Path**: Node config stores the complete KV store path as `credentialPath`
7. **Runtime**: Node execution uses `credentialPath` to fetch and decrypt credentials from KV store

### Credential Selector UI

The `CredentialSelector` component provides:

- Dropdown of available connections
- "No connection" warning with setup link
- Test connection functionality
- Add new connection button
- Connection status indicators

```typescript
<CredentialSelector
  integrationId="my-api"
  value={config.credentialPath}
  onChange={(path) => updateConfig('credentialPath', path)}
  showStatus={true}
  showTest={true}
  allowCreate={true}
/>
```

### Field Types Reference

- `text` - Single-line text input
- `textarea` - Multi-line text input
- `number` - Numeric input
- `select` - Dropdown with options
- `json` - JSON editor with syntax validation
- `password` - Password input with show/hide
- **`credential`** - Credential selector (connects to IntegrationsContext)

### Integration Flow

```
User Connects Account (IntegrationsSettings)
         ↓
Credentials Stored in KV Store
         ↓
Node Shows Credential Selector
         ↓
User Selects Connection
         ↓
Node Execution Uses Credentials
```

## Future Node Candidates

Consider creating dedicated components for:

- Database Query nodes (query builder, result mapping)
- Transform nodes (data mapping, filtering, enrichment)
- Agent nodes (system prompt builder, tool selection)
- Integration nodes (service-specific configuration)
