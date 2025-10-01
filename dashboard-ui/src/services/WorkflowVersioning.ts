/**
 * Git-like Workflow Versioning System
 *
 * Features:
 * - Automatic versioning on every save
 * - Rollback to any previous version
 * - Undo/redo operations with command pattern
 * - Version diff visualization
 * - Branch-like support for organizational vs personal workflows
 */

export interface WorkflowVersion {
  versionId: string;
  workflowId: string;
  version: number;
  timestamp: string;
  userId: string;
  organizationId?: string;
  nodes: any[];
  connections: any[];
  storyboards?: any[];
  metadata: {
    name: string;
    description?: string;
    tags?: string[];
    author: string;
    message?: string; // Commit-like message
  };
  parentVersion?: number; // For tracking version history
  checksum: string; // SHA-256 hash for integrity
}

export interface WorkflowCommand {
  type: 'add_node' | 'remove_node' | 'update_node' | 'add_connection' | 'remove_connection' | 'move_node';
  timestamp: string;
  data: any;
  inverse?: WorkflowCommand; // For undo
}

export interface UndoRedoState {
  undoStack: WorkflowCommand[];
  redoStack: WorkflowCommand[];
  currentVersion: number;
}

export class WorkflowVersioningService {
  private kvStore: any;
  private userId: string;
  private organizationId?: string;

  // In-memory undo/redo stacks (per workflow)
  private undoRedoStates = new Map<string, UndoRedoState>();

  constructor(kvStore: any, userId: string, organizationId?: string) {
    this.kvStore = kvStore;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  /**
   * Save a new version of the workflow
   */
  async saveVersion(
    workflowId: string,
    nodes: any[],
    connections: any[],
    storyboards: any[],
    metadata: any,
    message?: string
  ): Promise<WorkflowVersion> {
    // Get current version number
    const versions = await this.getVersionHistory(workflowId);
    const latestVersion = versions.length > 0 ? versions[0].version : 0;
    const newVersion = latestVersion + 1;

    // Calculate checksum for integrity
    const checksum = await this.calculateChecksum({ nodes, connections, storyboards });

    const version: WorkflowVersion = {
      versionId: `${workflowId}-v${newVersion}`,
      workflowId,
      version: newVersion,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      organizationId: this.organizationId,
      nodes,
      connections,
      storyboards,
      metadata: {
        ...metadata,
        author: this.userId,
        message: message || `Version ${newVersion}`
      },
      parentVersion: latestVersion > 0 ? latestVersion : undefined,
      checksum
    };

    // Store version in KV store
    const versionKey = this.getVersionKey(workflowId, newVersion);
    await this.kvStore.set(versionKey, JSON.stringify(version));

    // Update version index
    await this.updateVersionIndex(workflowId, version);

    // Also update the main workflow document
    const workflowKey = `workflow-${workflowId}`;
    await this.kvStore.set(workflowKey, JSON.stringify({
      nodes,
      connections,
      storyboards,
      metadata,
      currentVersion: newVersion,
      lastModified: version.timestamp
    }));

    console.log(`✅ Saved workflow version ${newVersion} with checksum ${checksum.slice(0, 8)}...`);

    return version;
  }

  /**
   * Load a specific version of the workflow
   */
  async loadVersion(workflowId: string, version: number): Promise<WorkflowVersion | null> {
    const versionKey = this.getVersionKey(workflowId, version);
    const versionData = await this.kvStore.get(versionKey);

    if (!versionData) {
      return null;
    }

    let parsedVersion: WorkflowVersion;
    if (typeof versionData === 'string') {
      parsedVersion = JSON.parse(versionData);
    } else if (versionData.value) {
      parsedVersion = typeof versionData.value === 'string'
        ? JSON.parse(versionData.value)
        : versionData.value;
    } else {
      parsedVersion = versionData;
    }

    // Verify checksum
    const calculatedChecksum = await this.calculateChecksum({
      nodes: parsedVersion.nodes,
      connections: parsedVersion.connections,
      storyboards: parsedVersion.storyboards
    });

    if (calculatedChecksum !== parsedVersion.checksum) {
      console.warn(`⚠️ Checksum mismatch for version ${version}! Data may be corrupted.`);
    }

    return parsedVersion;
  }

  /**
   * Get version history for a workflow
   */
  async getVersionHistory(workflowId: string, limit: number = 50): Promise<WorkflowVersion[]> {
    const indexKey = this.getVersionIndexKey(workflowId);
    const indexData = await this.kvStore.get(indexKey);

    if (!indexData) {
      return [];
    }

    let versionIndex: number[];
    if (typeof indexData === 'string') {
      versionIndex = JSON.parse(indexData);
    } else if (indexData.value) {
      versionIndex = typeof indexData.value === 'string'
        ? JSON.parse(indexData.value)
        : indexData.value;
    } else {
      versionIndex = indexData;
    }

    // Load all versions (or up to limit)
    const versionsToLoad = versionIndex.slice(0, limit);
    const versions = await Promise.all(
      versionsToLoad.map(v => this.loadVersion(workflowId, v))
    );

    return versions.filter((v): v is WorkflowVersion => v !== null);
  }

  /**
   * Rollback to a specific version (creates a new version as a copy)
   */
  async rollbackToVersion(workflowId: string, targetVersion: number): Promise<WorkflowVersion> {
    const version = await this.loadVersion(workflowId, targetVersion);
    if (!version) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Create a new version as a copy of the target version
    return this.saveVersion(
      workflowId,
      version.nodes,
      version.connections,
      version.storyboards || [],
      version.metadata,
      `Rollback to version ${targetVersion}`
    );
  }

  /**
   * Get diff between two versions
   */
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
  }> {
    const [from, to] = await Promise.all([
      this.loadVersion(workflowId, fromVersion),
      this.loadVersion(workflowId, toVersion)
    ]);

    if (!from || !to) {
      throw new Error('Version not found');
    }

    const fromNodeIds = new Set(from.nodes.map(n => n.id));
    const toNodeIds = new Set(to.nodes.map(n => n.id));

    const nodesAdded = to.nodes.filter(n => !fromNodeIds.has(n.id));
    const nodesRemoved = from.nodes.filter(n => !toNodeIds.has(n.id));
    const nodesModified = to.nodes.filter(toNode => {
      const fromNode = from.nodes.find(n => n.id === toNode.id);
      return fromNode && JSON.stringify(fromNode) !== JSON.stringify(toNode);
    });

    const fromConnIds = new Set(from.connections.map(c => `${c.from}-${c.to}`));
    const toConnIds = new Set(to.connections.map(c => `${c.from}-${c.to}`));

    const connectionsAdded = to.connections.filter(c => !fromConnIds.has(`${c.from}-${c.to}`));
    const connectionsRemoved = from.connections.filter(c => !toConnIds.has(`${c.from}-${c.to}`));

    return {
      nodesAdded,
      nodesRemoved,
      nodesModified,
      connectionsAdded,
      connectionsRemoved
    };
  }

  /**
   * Record a command for undo/redo
   */
  recordCommand(workflowId: string, command: WorkflowCommand): void {
    let state = this.undoRedoStates.get(workflowId);
    if (!state) {
      state = {
        undoStack: [],
        redoStack: [],
        currentVersion: 0
      };
      this.undoRedoStates.set(workflowId, state);
    }

    state.undoStack.push(command);
    state.redoStack = []; // Clear redo stack on new action

    // Limit undo stack to 100 items
    if (state.undoStack.length > 100) {
      state.undoStack.shift();
    }
  }

  /**
   * Undo last command
   */
  undo(workflowId: string): WorkflowCommand | null {
    const state = this.undoRedoStates.get(workflowId);
    if (!state || state.undoStack.length === 0) {
      return null;
    }

    const command = state.undoStack.pop()!;
    state.redoStack.push(command);

    return command.inverse || null;
  }

  /**
   * Redo last undone command
   */
  redo(workflowId: string): WorkflowCommand | null {
    const state = this.undoRedoStates.get(workflowId);
    if (!state || state.redoStack.length === 0) {
      return null;
    }

    const command = state.redoStack.pop()!;
    state.undoStack.push(command);

    return command;
  }

  /**
   * Check if undo is available
   */
  canUndo(workflowId: string): boolean {
    const state = this.undoRedoStates.get(workflowId);
    return state ? state.undoStack.length > 0 : false;
  }

  /**
   * Check if redo is available
   */
  canRedo(workflowId: string): boolean {
    const state = this.undoRedoStates.get(workflowId);
    return state ? state.redoStack.length > 0 : false;
  }

  /**
   * Clear undo/redo history
   */
  clearHistory(workflowId: string): void {
    this.undoRedoStates.delete(workflowId);
  }

  // Private helper methods

  private getVersionKey(workflowId: string, version: number): string {
    const context = this.organizationId ? `org-${this.organizationId}` : `user-${this.userId}`;
    return `workflow-version-${context}-${workflowId}-v${version}`;
  }

  private getVersionIndexKey(workflowId: string): string {
    const context = this.organizationId ? `org-${this.organizationId}` : `user-${this.userId}`;
    return `workflow-versions-index-${context}-${workflowId}`;
  }

  private async updateVersionIndex(workflowId: string, version: WorkflowVersion): Promise<void> {
    const indexKey = this.getVersionIndexKey(workflowId);
    const indexData = await this.kvStore.get(indexKey);

    let versionIndex: number[] = [];
    if (indexData) {
      if (typeof indexData === 'string') {
        versionIndex = JSON.parse(indexData);
      } else if (indexData.value) {
        versionIndex = typeof indexData.value === 'string'
          ? JSON.parse(indexData.value)
          : indexData.value;
      } else {
        versionIndex = indexData;
      }
    }

    // Add new version at the beginning (newest first)
    versionIndex.unshift(version.version);

    await this.kvStore.set(indexKey, JSON.stringify(versionIndex));
  }

  private async calculateChecksum(data: any): Promise<string> {
    // Simple checksum using crypto API
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
