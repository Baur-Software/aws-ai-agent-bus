# Dashboard UI

SolidJS-based reactive frontend for the AWS AI Agent Bus workflow ecosystem.

## Overview

The dashboard UI provides an infinite canvas workflow designer with real-time monitoring, built on:

- **SolidJS**: Reactive UI framework with fine-grained reactivity
- **TypeScript**: Type-safe component development
- **Vite**: Lightning-fast dev server and builds
- **Tailwind CSS**: Utility-first styling
- **WebSocket**: Real-time updates from dashboard-server

## Key Features

### Infinite Canvas Workflow Designer

> "The workflow nodes on the canvas are the thing itself."

- Drag-and-drop workflow creation
- Live status updates on nodes
- Visual connections between tasks
- Real-time execution monitoring
- 41 production-ready task types

### Real-Time Monitoring

- Live KV store metrics
- S3 artifact tracking
- Workflow execution status
- System activity feed
- Event-driven updates (no polling)

### Multi-Tenant Support

- User context switching
- Organization-level workflows
- Permission-based access control
- Isolated tenant data

### Integration Management

- OAuth2 app connections
- Multiple connections per service
- Connection testing and monitoring
- Dynamic workflow node availability

## Project Structure

```
dashboard-ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Canvas/         # Workflow canvas components
│   │   ├── WorkflowNode/   # Task node components
│   │   ├── Sidebar/        # Navigation and panels
│   │   └── Settings/       # Configuration UI
│   ├── workflow/           # Workflow engine
│   │   ├── tasks/          # 41 task implementations
│   │   ├── WorkflowEngine.ts
│   │   ├── TaskRegistry.ts
│   │   └── types.ts
│   ├── services/           # API and business logic
│   │   ├── WebSocketService.ts
│   │   ├── WorkflowStorageService.ts
│   │   ├── IntegrationService.ts
│   │   └── EventsService.ts
│   ├── contexts/           # React-style contexts
│   │   ├── WebSocketContext.tsx
│   │   ├── WorkflowContext.tsx
│   │   └── AuthContext.tsx
│   ├── pages/              # Route components
│   │   ├── Dashboard.tsx
│   │   ├── Workflows.tsx
│   │   ├── Integrations.tsx
│   │   └── Settings.tsx
│   └── types/              # TypeScript definitions
```

## Core Components

### WorkflowCanvas

The infinite canvas where workflows are designed:

```tsx
import { WorkflowCanvas } from './components/Canvas/WorkflowCanvas';

<WorkflowCanvas
  workflow={currentWorkflow}
  onNodeAdd={handleNodeAdd}
  onConnectionCreate={handleConnection}
  onNodeUpdate={handleNodeUpdate}
/>
```

Features:

- Pan and zoom
- Node drag-and-drop
- Connection drawing
- Real-time status updates
- Undo/redo support

### WorkflowNode

Individual task nodes on the canvas:

```tsx
import { WorkflowNode } from './components/WorkflowNode';

<WorkflowNode
  node={node}
  status={executionStatus}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

Features:

- Live status indicators
- Configuration panel
- Input/output ports
- Validation feedback
- Type-specific rendering

### IntegrationsSettings

Manage external service connections:

```tsx
import { IntegrationsSettings } from './components/Settings/IntegrationsSettings';

<IntegrationsSettings
  onConnect={handleConnect}
  onDisconnect={handleDisconnect}
  onTest={handleTest}
/>
```

Features:

- Multiple connections per service
- OAuth2 flow handling
- Connection testing
- Credential management

## Workflow System

### Task Types (41 Total)

#### Core (3)

- **Trigger** - Start workflows
- **Output** - Display results
- **Person** - User notifications

#### HTTP/API (4)

- **HTTP GET/POST/PUT/DELETE** - REST API operations

#### Data Processing (13)

- **JSON Parse/Stringify** - JSON operations
- **Transform** - Data transformation
- **Map/Reduce/Filter** - Array operations
- **Validate** - Schema validation
- **Merge** - Data merging

#### Events (6)

- **Events Send** - Publish to EventBridge
- **Events Query** - Query history
- **Events Analytics** - Aggregations
- **Events Create Rule** - Automation
- **Events Create Alert** - Notifications
- **Events Health Check** - Monitoring

#### Storage (6)

- **KV Get/Set** - Key-value operations
- **Artifacts Get/Put/List** - S3 operations
- **Cache** - Performance caching

#### Logic (7)

- **Conditional** - If/else branching
- **Switch** - Multi-way branching
- **Loop** - Iteration
- **Parallel** - Concurrent execution
- **Retry** - Error recovery
- **Delay** - Timing control
- **Wait** - Synchronization

#### Output (3)

- **Webhook** - External notifications
- **Email** - Email sending
- **Display** - UI output

#### Agents (1)

- **Agent** - AI agent orchestration

See [workflow-implementation.md](../workflow-implementation.md) for complete task reference.

### Creating Workflows

```typescript
import { WorkflowEngine } from './workflow/WorkflowEngine';
import { TaskRegistry } from './workflow/TaskRegistry';

// Create registry and register tasks
const registry = new TaskRegistry();
registerAllTasks(registry, services);

// Create engine
const engine = new WorkflowEngine(registry);

// Define workflow
const workflow = {
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      config: { triggerType: 'manual' }
    },
    {
      id: 'http-1',
      type: 'http-get',
      config: { url: 'https://api.example.com/data' }
    },
    {
      id: 'output-1',
      type: 'output',
      config: { format: 'json' }
    }
  ],
  connections: [
    { from: 'trigger-1', to: 'http-1' },
    { from: 'http-1', to: 'output-1' }
  ]
};

// Execute
const result = await engine.execute(workflow, context);
```

### Workflow Storage

Workflows are stored in S3 via the MCP artifacts system:

```typescript
import { WorkflowStorageService } from './services/WorkflowStorageService';

const storage = new WorkflowStorageService(artifactsService);

// Save workflow
await storage.saveWorkflow(workflow);

// Load workflow
const loaded = await storage.loadWorkflow(workflowId);

// List workflows
const all = await storage.listWorkflows();

// Import/export
const json = await storage.exportWorkflow(workflowId);
await storage.importWorkflows(json);
```

## Services

### WebSocketService

Real-time communication with dashboard-server:

```typescript
import { WebSocketService } from './services/WebSocketService';

const ws = new WebSocketService('ws://localhost:3001');

// Connect
await ws.connect();

// Call MCP tool
const result = await ws.callTool('mcp__agent-mesh__kv_get', {
  key: 'user-session'
});

// Subscribe to events
ws.subscribe('metrics', (data) => {
  console.log('Metrics update:', data);
});

// Send custom message
ws.send({ type: 'context_switch', userId: 'user-123' });
```

### EventsService

Event management and analytics:

```typescript
import { EventsService } from './services/EventsService';

const events = new EventsService(wsService);

// Send event
await events.send({
  detailType: 'Workflow.Completed',
  detail: { workflowId: '123', duration: 5000 }
});

// Query events
const history = await events.query({
  startTime: '2025-10-01T00:00:00Z',
  detailType: 'Workflow.Completed',
  limit: 50
});

// Get analytics
const analytics = await events.analytics({
  timeRange: '7d',
  metrics: ['volume', 'topSources', 'priority']
});

// Create rule
await events.createRule({
  name: 'notify-on-error',
  pattern: { detailType: ['Workflow.Failed'] }
});

// Create alert
await events.createAlert({
  name: 'workflow-failures',
  ruleId: 'notify-on-error',
  notificationMethod: 'email',
  emailAddress: 'team@example.com'
});
```

### IntegrationService

Manage external service connections:

```typescript
import { IntegrationService } from './services/IntegrationService';

const integrations = new IntegrationService(wsService);

// Register integration
await integrations.register({
  service_id: 'google-analytics',
  name: 'Google Analytics',
  auth_method: { type: 'oauth2' },
  capabilities: ['read', 'analyze']
});

// Connect to service
await integrations.connect({
  service_id: 'google-analytics',
  connection_name: 'My GA Account',
  credentials: { /* OAuth2 tokens */ }
});

// List connections
const connections = await integrations.list();

// Test connection
const health = await integrations.test('google-analytics');

// Disconnect
await integrations.disconnect('google-analytics', connectionId);
```

## Development

### Running Locally

```bash
cd dashboard-ui
npm install
npm run dev
```

Vite dev server starts on `http://localhost:5173`

### Environment Variables

Create `.env`:

```bash
# Dashboard server WebSocket URL
VITE_MCP_SERVER_URL=http://localhost:3001
VITE_MCP_SERVER_PORT=3001

# Development mode
VITE_DEV_MODE=true

# Optional customization
VITE_APP_TITLE="My Workflow Dashboard"
```

### Running with Backend

```bash
# From project root
npm run dev:all
```

Starts both dashboard-server and dashboard-ui.

## Building for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

Output in `dist/` directory.

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm test:watch

# Coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

### Component Testing

```typescript
import { render, screen } from '@solidjs/testing-library';
import { WorkflowNode } from './components/WorkflowNode';

test('renders workflow node', () => {
  const node = {
    id: 'test-1',
    type: 'http-get',
    config: { url: 'https://api.example.com' }
  };

  render(() => <WorkflowNode node={node} />);

  expect(screen.getByText('HTTP GET')).toBeInTheDocument();
});
```

## Styling

### Tailwind CSS

All styling uses Tailwind utility classes:

```tsx
<div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
    Workflow Designer
  </h2>
</div>
```

### Dark Mode

Automatic dark mode support via Tailwind:

```tsx
// Automatically adapts to system preference
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content
</div>
```

### Custom Themes

Extend Tailwind config in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3B82F6',
          secondary: '#10B981'
        }
      }
    }
  }
};
```

## State Management

### SolidJS Signals

Fine-grained reactive state:

```typescript
import { createSignal, createEffect } from 'solid-js';

const [workflows, setWorkflows] = createSignal<Workflow[]>([]);
const [selectedWorkflow, setSelectedWorkflow] = createSignal<Workflow | null>(null);

createEffect(() => {
  // Automatically re-runs when workflows() changes
  console.log('Workflows updated:', workflows());
});
```

### Context API

Shared state across components:

```typescript
import { createContext, useContext } from 'solid-js';

const WorkflowContext = createContext<WorkflowContextValue>();

export function WorkflowProvider(props) {
  const [workflows, setWorkflows] = createSignal([]);

  return (
    <WorkflowContext.Provider value={{ workflows, setWorkflows }}>
      {props.children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflows() {
  return useContext(WorkflowContext);
}
```

## Performance Optimization

### Code Splitting

```typescript
import { lazy } from 'solid-js';

const Workflows = lazy(() => import('./pages/Workflows'));
const Integrations = lazy(() => import('./pages/Integrations'));
```

### Memoization

```typescript
import { createMemo } from 'solid-js';

const expensiveComputation = createMemo(() => {
  return workflows().filter(w => w.status === 'active');
});
```

### Virtual Scrolling

For large lists of workflows or nodes:

```tsx
import { For } from 'solid-js';
import { VirtualList } from './components/VirtualList';

<VirtualList
  items={workflows()}
  itemHeight={60}
  renderItem={(workflow) => <WorkflowCard workflow={workflow} />}
/>
```

## Deployment

### Docker

```bash
cd dashboard-ui
docker build -t dashboard-ui .
docker run -p 80:80 dashboard-ui
```

### Static Hosting

Deploy `dist/` to:

- AWS S3 + CloudFront
- Vercel
- Netlify
- GitHub Pages

### Environment Configuration

Production `.env`:

```bash
VITE_MCP_SERVER_URL=wss://api.example.com
VITE_MCP_SERVER_PORT=443
VITE_DEV_MODE=false
```

## Architecture Decisions

### Why SolidJS?

- **Performance**: Fine-grained reactivity without virtual DOM
- **Simple**: React-like API without complex hooks rules
- **Size**: Smaller bundle size than React
- **TypeScript**: First-class TypeScript support

### Why WebSocket-Only?

- **Real-time**: Instant workflow status updates
- **Efficient**: Single persistent connection
- **Event-driven**: Natural fit for reactive UI
- **No polling**: Server pushes updates

### Why Infinite Canvas?

- **Visual**: Intuitive workflow design
- **Flexible**: Unconstrained layout
- **Scalable**: Handle complex workflows
- **Live updates**: Status visible on nodes

## Related Documentation

- [Dashboard Server](../dashboard-server/README.md) - WebSocket API gateway
- [MCP Rust Server](../mcp-rust/README.md) - Backend MCP server
- [Workflow Implementation](../workflow-implementation.md) - Task reference
- [Workflow Examples](../workflow-examples/README.md) - Importable workflows
