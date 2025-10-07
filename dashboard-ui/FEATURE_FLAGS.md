# Feature Flag System

Pure feature flag system with no tier coupling in frontend code. Backend sets flags based on subscription tier.

## Usage Pattern

```typescript
// Check node availability
const canUseDocker = useFeatureFlag('nodes.docker-run');

// Check module availability
const hasECS = useFeatureFlag('modules.ecs-agents');

// Check infrastructure state with wildcard
const hasInfra = useFeatureFlag('org-123.infra-small.*');

// Custom value check function
const betaEnabled = useFeatureFlag('beta-ui', (org) => org.settings?.betaEnabled);

// Get value (not just boolean)
const maxWorkflows = useFeatureFlagValue('limits.maxWorkflows');
```

## Helper Functions

```typescript
// Node availability (shorthand for nodes.*)
const isAvailable = useNodeAvailable('docker-run');

// Module availability (shorthand for modules.*)
const hasModule = useModuleAvailable('ecs-agents');

// Infrastructure state
const infraState = useInfraState(); // 'deploying' | 'deployed' | 'failed'

// Infrastructure deployed check with wildcard
const deployed = useInfraDeployed('org-123', 'infra-small');

// Resource limits
const maxWorkflows = useFeatureLimit('maxWorkflows');
```

## Organization Structure

Backend sets `Organization.features` based on subscription:

```json
{
  "id": "org-123",
  "name": "Example Org",
  "workspaceTier": "small",
  "infraState": "deployed",
  "features": {
    "nodes": {
      "trigger": true,
      "http-get": true,
      "kv-get": true,
      "kv-set": true,
      "docker-run": false,
      "vector-search": false
    },
    "modules": {
      "ecs-agents": false,
      "step-functions": false,
      "vector-pg": false,
      "observability": true
    },
    "limits": {
      "maxWorkflows": 10,
      "maxNodesPerWorkflow": 20,
      "maxConcurrentExecutions": 5
    }
  }
}
```

## Wildcard Pattern Matching

The system supports wildcard `*` for checking if any keys exist:

```typescript
// Check if org has any infrastructure deployed
useFeatureFlag('org-123.infra-small.*')

// Backend would store infrastructure state like:
{
  "features": {
    "org-123": {
      "infra-small": {
        "kv-store": "deployed",
        "events": "deployed"
      }
    }
  }
}
```

## Workflow Node Integration

Nodes automatically check availability and show upgrade prompt when locked:

```typescript
// WorkflowNodeDetails.tsx
const isNodeAvailable = createMemo(() => {
  const node = localNode();
  if (!node) return true;
  return useNodeAvailable(node.type);
});

// Show upgrade prompt if locked
<Show when={!isNodeAvailable()}>
  <UpgradePrompt
    nodeType={localNode()!.type}
    nodeDisplayName={getNodeConfig(localNode()!.type).title}
    nodeDescription={getNodeConfig(localNode()!.type).description}
  />
</Show>
```

## Backend Responsibilities

1. **Set feature flags based on subscription tier**
   - Small tier → basic nodes only
   - Medium tier → + Docker, ECS, Step Functions
   - Large tier → + Vector DB, advanced analytics

2. **Update infrastructure state**
   - Set `infraState: 'deploying'` during provisioning
   - Set `infraState: 'deployed'` when ready
   - Set `infraState: 'failed'` on errors

3. **Store infrastructure deployment info**

   ```json
   {
     "features": {
       "org-123.infra-small": {
         "kv-store": "deployed",
         "events-monitoring": "deployed"
       }
     }
   }
   ```

## Example: Adding a New Node

1. **Add node definition** to `nodeDefinitions.ts`
2. **Backend sets flag** in `Organization.features.nodes['new-node']`
3. **Frontend automatically handles** via `useNodeAvailable('new-node')`
4. **UpgradePrompt shows** if flag is false

No tier logic needed in frontend code!
