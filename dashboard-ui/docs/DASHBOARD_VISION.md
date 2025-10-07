# Configurable Dashboard Vision

## Current State

Dashboard component has been removed (was drifting from original implementation).

## Future Vision

Rebuild Dashboard as a **configurable canvas-based system** that reuses workflow datavis nodes.

### Architecture

```
Dashboard = Special Workflow Canvas
  ├─ Reuses DataVis Nodes (charts, graphs, tables)
  ├─ Connects to real-time event streams
  ├─ Configurable layouts (grid, flex)
  └─ User-specific configurations saved in KV store
```

### Features

**1. Reusable DataVis Nodes**

- Bar Chart Node
- Line Chart Node
- Pie Chart Node
- Table Node
- Metric Card Node
- Event Stream Node
- Live Activity Feed Node

**2. Data Sources**

- MCP `events_analytics` for metrics
- Real-time WebSocket event streams
- KV Store metrics
- Artifacts metrics
- Workflow execution stats

**3. Configuration**

- Drag & drop node placement
- Resize nodes
- Connect nodes to data sources
- Save layouts per user/organization
- Template dashboards (Analytics, Operations, Executive)

### Implementation Path

1. **Phase 1**: Create basic DataVis node types
   - Extend WorkflowNode to support DataVisNode
   - Add chart rendering components
   - Support data input connectors

2. **Phase 2**: Build Dashboard Canvas
   - Clone Canvas.tsx as DashboardCanvas.tsx
   - Remove execution logic, keep layout only
   - Add grid snapping for dashboard layouts

3. **Phase 3**: Add Configuration UI
   - Node property panels for data source selection
   - Layout templates
   - Save/load configurations via KV Store

4. **Phase 4**: Real-time Integration
   - Subscribe to event streams
   - Auto-refresh metrics
   - Live updates without polling

### Example Dashboard Node Types

```typescript
// Metric Card Node
{
  type: 'datavis.metric',
  inputs: { value: number, label: string, trend: number },
  display: { size: 'small', color: 'blue' }
}

// Event Volume Chart Node
{
  type: 'datavis.chart.line',
  inputs: {
    data: Array<{ timestamp: string, count: number }>,
    granularity: 'hourly' | 'daily'
  },
  display: { width: 600, height: 300 }
}

// Live Events Feed Node
{
  type: 'datavis.events.feed',
  inputs: {
    eventTypes: string[],
    filters: { priority?: string, source?: string }
  },
  display: { maxEvents: 50 }
}
```

### Benefits

✅ **Reusability** - Same nodes used in workflows and dashboards
✅ **Consistency** - Unified visual language across the app
✅ **Flexibility** - Users can build custom dashboards
✅ **Real-time** - Live data via event streams
✅ **Composable** - Nodes can connect and share data
✅ **Persistent** - Configurations saved per user

---

**Status**: Awaiting implementation after workflow engine core is complete
**Related Files**:

- `dashboard-ui/src/pages/Canvas.tsx` (architecture reference)
- `dashboard-ui/src/components/workflow/nodes/` (node examples)
