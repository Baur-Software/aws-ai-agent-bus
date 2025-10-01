

# Dry Run / Live Run System

Zapier-style test data system for safe workflow testing without touching production data.

## Overview

The workflow engine supports two execution modes:

- **🧪 Dry Run**: Uses sample data, no real API calls
- **⚡ Live Run**: Uses real data, makes actual API calls

## How It Works

### 1. Run Button Behavior

**Left-click**: Start/stop workflow execution
**Right-click**: Toggle between Dry Run ↔ Live Run

The button shows the current mode:
- **Dry Run** (secondary/gray button)
- **Live Run** (primary/blue button)

Button is disabled when canvas has no nodes.

### 2. Sample Data Priority

When in Dry Run mode, the workflow engine uses sample data in this order:

1. **Custom Sample Output** (highest priority)
   - Configured in node settings: `node.config.sampleOutput`
   - User-defined test data specific to their use case

2. **Default Sample Output** (fallback)
   - Defined in `src/config/nodeDefinitions.ts`
   - Realistic default data for each node type

3. **Placeholder** (last resort)
   - Generic message if no sample data exists
   - Indicates user should configure sample output

### 3. Configuring Sample Data

#### Option A: In Node Settings UI (Future)

```typescript
// Click node → Properties Panel → Sample Output tab
{
  "userId": "12345",
  "email": "test@example.com",
  "name": "Test User"
}
```

#### Option B: Programmatically

```typescript
const node = {
  id: 'node-1',
  type: 'http-get',
  config: {
    url: 'https://api.example.com/users',
    sampleOutput: {
      status: 200,
      data: {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false }
        ]
      }
    }
  }
};
```

## Default Sample Outputs

All common node types have realistic default sample outputs defined:

### Storage Nodes

**kv-get**:
```json
{
  "key": "sample-key",
  "value": "sample-value",
  "ttl": 3600
}
```

**kv-set**:
```json
{
  "success": true,
  "key": "sample-key",
  "ttl": 86400
}
```

**artifacts-list**:
```json
{
  "artifacts": ["file1.json", "file2.pdf"],
  "count": 2
}
```

### HTTP Nodes

**http-get**:
```json
{
  "status": 200,
  "data": {
    "sample": true,
    "message": "Sample response"
  }
}
```

**http-post**:
```json
{
  "status": 201,
  "data": {
    "id": "sample_123",
    "created": true
  }
}
```

### Analytics Nodes

**ga-top-pages**:
```json
{
  "pages": [
    { "page": "/blog/sample-post", "views": 1234, "users": 890 },
    { "page": "/products/sample", "views": 987, "users": 654 }
  ],
  "totalViews": 2221
}
```

### Trigger Nodes

**webhook**:
```json
{
  "method": "POST",
  "body": {
    "event": "sample",
    "data": {}
  }
}
```

**schedule**:
```json
{
  "scheduledTime": "2025-09-30T10:30:00Z",
  "nextRun": "2025-10-01T10:30:00Z"
}
```

## Data Flow

In Dry Run mode, sample data flows through the workflow just like real data:

```
Trigger (sample) → HTTP GET (sample) → Filter (sample) → Output (sample)
```

Each node receives the previous node's sample output as input, allowing you to test:
- Data transformations
- Conditional branching
- Error handling
- Workflow logic

## Console Logging

The workflow engine provides clear console logging for debugging:

```
🧪 DRY RUN Executing node: http-get (node-123)
🧪 Using custom sample data for http-get: { status: 200, ... }
```

vs

```
⚡ LIVE Executing node: http-get (node-123)
🌐 Making GET request to: https://api.example.com/users
```

## Events

Workflow events include `mockMode: true/false` so you can distinguish dry runs in the Events panel:

```json
{
  "detailType": "workflow.node.state_changed",
  "detail": {
    "executionId": "123",
    "nodeId": "node-1",
    "nodeType": "http-get",
    "currentState": "executing",
    "mockMode": true,
    "timestamp": "2025-09-30T10:30:00Z"
  }
}
```

## Use Cases

### 1. Development & Testing

Test workflow logic without:
- Calling production APIs
- Consuming API rate limits
- Incurring costs (e.g., SMS, payments)
- Modifying production data

### 2. Training & Demos

Show workflow functionality with realistic sample data without needing:
- API credentials
- Connected services
- Live data sources

### 3. Debugging

Isolate workflow logic issues by:
- Using known sample inputs
- Comparing expected vs actual outputs
- Testing edge cases with custom sample data

### 4. Iterative Development

Rapidly iterate on workflow design:
- Test node configurations quickly
- Verify data transformations
- Check conditional logic
- No API setup required

## Best Practices

### 1. Configure Realistic Sample Data

Bad:
```json
{
  "data": "test"
}
```

Good:
```json
{
  "users": [
    { "id": 1, "email": "alice@example.com", "plan": "pro", "mrr": 99 },
    { "id": 2, "email": "bob@example.com", "plan": "free", "mrr": 0 }
  ],
  "totalUsers": 2,
  "page": 1,
  "hasMore": true
}
```

### 2. Match Production Data Structure

Sample data should match your actual API responses exactly:
- Same field names
- Same data types
- Same nesting structure
- Realistic values

### 3. Test Edge Cases

Configure multiple sample outputs for testing:
- Empty arrays: `{ users: [] }`
- Error states: `{ status: 404, error: "Not found" }`
- Large datasets: `{ items: [...1000 items] }`
- Boundary values: `{ count: 0 }`, `{ count: 9999 }`

### 4. Document Sample Data Source

Add comments in custom sample outputs:
```json
{
  "_note": "Sample from production 2025-09-30, anonymized",
  "userId": "sample_123",
  "email": "user@example.com"
}
```

### 5. Test Before Going Live

Always run in Dry Run mode first:
1. Configure sample data
2. Run workflow in Dry Run mode
3. Verify data flows correctly
4. Check Events panel for issues
5. Switch to Live Run mode

## Switching Modes

### Via UI
- Right-click the Run button
- Tooltip shows current mode
- Button color changes

### Programmatically
```typescript
setUseMockData(true);  // Enable dry run
setUseMockData(false); // Enable live run
```

## Implementation Details

### WorkflowEngine

```typescript
class WorkflowEngine {
  constructor(mcpClient, eventEmitter, useMockData = false) {
    this.useMockData = useMockData;
  }

  async executeNode(node, allNodes, context) {
    if (this.useMockData && node.type !== 'trigger') {
      // Use sample data
      result = this.useSampleData(node);
    } else {
      // Real execution
      result = await this.callRealAPI(node);
    }
  }

  useSampleData(node) {
    // 1. Custom sample output
    if (node.config?.sampleOutput) return node.config.sampleOutput;

    // 2. Default sample output
    const defaultSample = this.getDefaultSampleOutput(node.type);
    if (defaultSample) return defaultSample;

    // 3. Placeholder
    return { _sample: true, message: 'Configure sample output' };
  }
}
```

### Node Definitions

See `src/config/nodeDefinitions.ts` for full list of default sample outputs.

To add a new node type with default sample output:

```typescript
{
  type: 'custom-api',
  name: 'Custom API',
  description: 'Call custom API endpoint',
  category: 'api',
  defaultSampleOutput: {
    status: 200,
    data: {
      // Your realistic sample data
    }
  }
}
```

## Future Enhancements

- [ ] Sample Output editor in node properties panel
- [ ] Import/export sample data sets
- [ ] Record real API responses as sample data
- [ ] Version control for sample data
- [ ] Share sample data templates
- [ ] Validate sample data against JSON schema
- [ ] Generate sample data from OpenAPI specs
- [ ] Auto-detect sample vs real data in Events panel

## Related Files

- `dashboard-ui/src/utils/workflowEngine.ts` - Core execution engine
- `dashboard-ui/src/config/nodeDefinitions.ts` - Default sample outputs
- `dashboard-ui/src/components/workflow/ui/FloatingToolbar.tsx` - Run button UI
- `dashboard-ui/src/components/workflow/core/WorkflowCanvasContainer.tsx` - Mode toggle

## Comparison with Zapier

| Feature | Our System | Zapier |
|---------|------------|--------|
| Dry run mode | ✅ | ✅ |
| Custom sample data | ✅ | ✅ |
| Default sample data | ✅ | ✅ |
| Right-click mode toggle | ✅ | ❌ |
| Visual mode indicator | ✅ | ✅ |
| Data flow visualization | 🚧 | ✅ |
| Record real responses | 🚧 | ✅ |

## Support

For questions or issues with the Dry Run system:
- Check workflow execution logs in console
- Verify sample data structure matches node expectations
- Check Events panel for execution details
- Ensure node type has default sample output defined
