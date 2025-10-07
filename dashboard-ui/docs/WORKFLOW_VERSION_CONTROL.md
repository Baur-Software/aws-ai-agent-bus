# Workflow Version Control System

Git-like version control for workflows with automatic versioning, undo/redo, and rollback capabilities.

## Features

### 1. Automatic Versioning on Save

- Every workflow save creates a new immutable version
- SHA-256 checksum for data integrity verification
- Commit-like messages for each version
- Parent version tracking for complete history

### 2. Undo/Redo with Command Pattern

- In-memory command stack for immediate undo/redo
- 100-command history limit per workflow
- Support for all canvas operations:
  - Add/remove nodes
  - Update node properties
  - Move nodes
  - Add/remove connections

### 3. Version History Browser

- Git-style commit list with timestamps
- Visual diff between any two versions
- Quick rollback to any previous version
- Checksum verification for corrupted data detection

### 4. Keyboard Shortcuts

- **Ctrl+Z / Cmd+Z**: Undo last action
- **Ctrl+Y / Cmd+Y**: Redo last undone action
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo (alternative)
- **Ctrl+S / Cmd+S**: Save workflow (creates new version)

## Architecture

### Storage Structure

```
DynamoDB Keys:

# Main workflow document (latest state)
workflow-{workflowId}

# Individual versions
workflow-version-{context}-{workflowId}-v{N}

# Version index (list of all version numbers)
workflow-versions-index-{context}-{workflowId}

Context formats:
- Personal: user-{userId}
- Organizational: org-{orgId}
```

### Version Document Schema

```typescript
{
  versionId: string;           // "workflow-123-v5"
  workflowId: string;          // "workflow-123"
  version: number;             // 5
  timestamp: string;           // ISO 8601
  userId: string;              // Author
  organizationId?: string;     // Optional org context

  // Workflow state snapshot
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  storyboards: Storyboard[];

  // Metadata
  metadata: {
    name: string;
    description?: string;
    author: string;
    message?: string;          // Commit message
    tags?: string[];
  };

  // Version tracking
  parentVersion?: number;      // Previous version (for history chain)
  checksum: string;            // SHA-256 of workflow data
}
```

### Command Pattern for Undo/Redo

```typescript
{
  type: 'add_node' | 'remove_node' | 'update_node' |
        'move_node' | 'add_connection' | 'remove_connection';
  timestamp: string;
  data: any;                   // Command-specific data
  inverse?: WorkflowCommand;   // Reverse operation for undo
}
```

## Usage

### In Components

```typescript
import { useWorkflow } from '../contexts/WorkflowContext';

const MyComponent = () => {
  const workflow = useWorkflow();

  // Record a command for undo/redo
  const addNode = (node) => {
    workflow.setNodes([...workflow.currentNodes(), node]);
    workflow.recordCommand({
      type: 'add_node',
      timestamp: new Date().toISOString(),
      data: node,
      inverse: {
        type: 'remove_node',
        timestamp: new Date().toISOString(),
        data: { id: node.id }
      }
    });
  };

  // Undo/redo
  const handleUndo = () => {
    if (workflow.canUndo()) {
      workflow.undo();
    }
  };

  const handleRedo = () => {
    if (workflow.canRedo()) {
      workflow.redo();
    }
  };

  // Save with commit message
  const handleSave = async () => {
    await workflow.saveWorkflow('Added authentication flow');
  };

  // View version history
  const showHistory = async () => {
    const versions = await workflow.getVersionHistory();
    console.log('Version history:', versions);
  };

  // Rollback to version
  const rollback = async (versionNumber) => {
    await workflow.rollbackToVersion(versionNumber);
  };

  // Compare versions
  const compare = async (fromVersion, toVersion) => {
    const diff = await workflow.getVersionDiff(fromVersion, toVersion);
    console.log('Diff:', diff);
  };
};
```

### Version History UI

The `VersionHistoryPanel` component provides a git-like UI for:

1. **Browsing versions**: Click to select, see metadata
2. **Comparing versions**: Select two versions to see diff
3. **Rolling back**: Restore any previous version
4. **Visual diff**:
   - Green: Added nodes/connections
   - Red: Removed nodes/connections
   - Yellow: Modified nodes

## Implementation Details

### WorkflowVersioningService

Core service providing version control operations:

```typescript
class WorkflowVersioningService {
  // Save new version (creates immutable snapshot)
  async saveVersion(
    workflowId: string,
    nodes: any[],
    connections: any[],
    storyboards: any[],
    metadata: any,
    message?: string
  ): Promise<WorkflowVersion>

  // Load specific version
  async loadVersion(
    workflowId: string,
    version: number
  ): Promise<WorkflowVersion | null>

  // Get version history (newest first)
  async getVersionHistory(
    workflowId: string,
    limit?: number
  ): Promise<WorkflowVersion[]>

  // Rollback (creates new version as copy of old)
  async rollbackToVersion(
    workflowId: string,
    targetVersion: number
  ): Promise<WorkflowVersion>

  // Calculate diff between versions
  async getVersionDiff(
    workflowId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<{
    nodesAdded: any[];
    nodesRemoved: any[];
    nodesModified: any[];
    connectionsAdded: any[];
    connectionsRemoved: any[];
  }>

  // Undo/redo operations
  recordCommand(workflowId: string, command: WorkflowCommand): void
  undo(workflowId: string): WorkflowCommand | null
  redo(workflowId: string): WorkflowCommand | null
  canUndo(workflowId: string): boolean
  canRedo(workflowId: string): boolean
}
```

### Checksum Verification

Data integrity is ensured via SHA-256 checksums:

```typescript
// Generate checksum
const checksum = await calculateChecksum({ nodes, connections, storyboards });

// Verify on load
const loadedChecksum = await calculateChecksum(loadedData);
if (loadedChecksum !== storedChecksum) {
  console.warn('⚠️ Data corruption detected!');
}
```

### Version Index

Quick version lookup without scanning all keys:

```typescript
// Version index stored at:
workflow-versions-index-{context}-{workflowId}

// Contains array of version numbers (newest first):
[10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

// Updated atomically on each save
```

## Multi-Tenancy

Versions are isolated by context:

- **Personal workflows**: `user-{userId}` prefix
- **Organizational workflows**: `org-{orgId}` prefix
- **System workflows**: `system` prefix

Users can only access versions for workflows they have permissions to view.

## Performance Considerations

### Storage

- Each version is ~5-50KB depending on workflow complexity
- 100 versions ≈ 0.5-5MB total
- DynamoDB read/write capacity scales automatically

### Memory

- Undo/redo stack limited to 100 commands per workflow
- ~1KB per command = ~100KB max per workflow in memory

### Network

- Version history fetched on-demand (not on page load)
- Diff calculations happen client-side (no server round-trip)
- Checksums computed during save (no extra API calls)

## Best Practices

1. **Meaningful commit messages**: Use descriptive messages when saving

   ```typescript
   await workflow.saveWorkflow('Added lead qualification logic');
   ```

2. **Save frequently**: Don't rely solely on undo/redo
   - Undo stack is in-memory only (cleared on refresh)
   - Saved versions persist forever

3. **Review before rollback**: Use diff view to understand changes

   ```typescript
   const diff = await workflow.getVersionDiff(currentVersion, targetVersion);
   // Review diff before calling rollbackToVersion()
   ```

4. **Clean up old versions**: Consider implementing version pruning for very old workflows
   - Keep last 50-100 versions
   - Archive older versions to S3 if needed

## Future Enhancements

- [ ] Branch-like functionality (parallel workflow variants)
- [ ] Visual timeline graph (like git log --graph)
- [ ] Bulk operations (cherry-pick specific nodes across versions)
- [ ] Conflict resolution for concurrent edits
- [ ] Export version history as git repository
- [ ] Version compression (delta storage for large workflows)
- [ ] Collaborative annotations on versions

## Related Files

- `dashboard-ui/src/services/WorkflowVersioning.ts` - Core versioning service
- `dashboard-ui/src/contexts/WorkflowContext.tsx` - Integration with workflow state
- `dashboard-ui/src/components/workflow/ui/VersionHistoryPanel.tsx` - UI component
- `dashboard-ui/src/pages/Canvas.tsx` - Keyboard shortcuts
- `dashboard-server/src/handlers/events.ts` - Event publishing for version changes

## Testing

```bash
# Run workflow versioning tests
cd dashboard-ui
npm test -- WorkflowVersioning.test.ts
```

## Troubleshooting

### "Checksum mismatch" warning

- Indicates data corruption or modification outside version control
- Safe to continue, but version may not match original state
- Check KV store for manual modifications

### Undo/redo not working

- Ensure commands are being recorded: `workflow.recordCommand()`
- Check browser console for errors
- Undo stack clears on page refresh (expected behavior)

### Version history empty

- Verify workflow has been saved at least once
- Check DynamoDB for version keys
- Ensure versioning service is initialized (userId must be present)

### Performance issues with large workflows

- Consider reducing version history limit
- Implement pagination for version list
- Use diff view instead of loading full versions
