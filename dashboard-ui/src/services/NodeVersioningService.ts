/**
 * Node Versioning Service
 *
 * Manages versioning of custom nodes with rollback capabilities
 * Stores versions in KV store with history tracking
 */

export interface NodeVersion {
  version: string; // semver: 1.0.0, 1.1.0, etc.
  schema: any; // The node schema
  createdAt: string;
  createdBy: string;
  changelog?: string;
  deprecated?: boolean;
}

export interface NodeVersionHistory {
  nodeType: string;
  currentVersion: string;
  versions: NodeVersion[];
}

export class NodeVersioningService {
  private kvStore: any;

  constructor(kvStore: any) {
    this.kvStore = kvStore;
  }

  /**
   * Save a new version of a node
   */
  async saveNodeVersion(
    nodeType: string,
    schema: any,
    userId: string,
    changelog?: string,
    versionType: 'major' | 'minor' | 'patch' = 'minor'
  ): Promise<NodeVersion> {
    const historyKey = `node-versions-${nodeType}`;

    // Get existing history
    const historyResult = await this.kvStore.get(historyKey);
    const history: NodeVersionHistory = historyResult?.value
      ? JSON.parse(historyResult.value)
      : {
          nodeType,
          currentVersion: '0.0.0',
          versions: []
        };

    // Calculate next version
    const nextVersion = this.incrementVersion(history.currentVersion, versionType);

    // Create new version
    const newVersion: NodeVersion = {
      version: nextVersion,
      schema,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      changelog
    };

    // Update history
    history.versions.push(newVersion);
    history.currentVersion = nextVersion;

    // Save to KV store
    await this.kvStore.set(historyKey, JSON.stringify(history), 8760); // 1 year TTL

    // Also save current version separately for quick access
    await this.kvStore.set(
      `node-schema-${nodeType}`,
      JSON.stringify({
        version: nextVersion,
        schema
      }),
      8760
    );

    return newVersion;
  }

  /**
   * Get version history for a node
   */
  async getVersionHistory(nodeType: string): Promise<NodeVersionHistory | null> {
    const historyKey = `node-versions-${nodeType}`;
    const result = await this.kvStore.get(historyKey);

    if (!result?.value) {
      return null;
    }

    return JSON.parse(result.value);
  }

  /**
   * Get a specific version of a node
   */
  async getVersion(nodeType: string, version: string): Promise<NodeVersion | null> {
    const history = await this.getVersionHistory(nodeType);

    if (!history) {
      return null;
    }

    return history.versions.find(v => v.version === version) || null;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(
    nodeType: string,
    targetVersion: string,
    userId: string
  ): Promise<NodeVersion> {
    const history = await this.getVersionHistory(nodeType);

    if (!history) {
      throw new Error(`No version history found for node: ${nodeType}`);
    }

    const targetVersionObj = history.versions.find(v => v.version === targetVersion);

    if (!targetVersionObj) {
      throw new Error(`Version ${targetVersion} not found for node: ${nodeType}`);
    }

    // Create a new version based on the target (rollback creates a new version)
    return this.saveNodeVersion(
      nodeType,
      targetVersionObj.schema,
      userId,
      `Rolled back to version ${targetVersion}`,
      'patch'
    );
  }

  /**
   * Deprecate a version
   */
  async deprecateVersion(nodeType: string, version: string): Promise<void> {
    const history = await this.getVersionHistory(nodeType);

    if (!history) {
      throw new Error(`No version history found for node: ${nodeType}`);
    }

    const versionObj = history.versions.find(v => v.version === version);

    if (!versionObj) {
      throw new Error(`Version ${version} not found for node: ${nodeType}`);
    }

    versionObj.deprecated = true;

    // Save updated history
    await this.kvStore.set(
      `node-versions-${nodeType}`,
      JSON.stringify(history),
      8760
    );
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    nodeType: string,
    version1: string,
    version2: string
  ): Promise<{ added: string[]; removed: string[]; modified: string[] }> {
    const v1 = await this.getVersion(nodeType, version1);
    const v2 = await this.getVersion(nodeType, version2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const fields1 = new Set(v1.schema.fields?.map((f: any) => f.name) || []);
    const fields2 = new Set(v2.schema.fields?.map((f: any) => f.name) || []);

    const added = Array.from(fields2).filter(f => !fields1.has(f));
    const removed = Array.from(fields1).filter(f => !fields2.has(f));
    const modified: string[] = [];

    // Check for modified fields
    const commonFields = Array.from(fields1).filter(f => fields2.has(f));
    for (const fieldName of commonFields) {
      const field1 = v1.schema.fields.find((f: any) => f.name === fieldName);
      const field2 = v2.schema.fields.find((f: any) => f.name === fieldName);

      if (JSON.stringify(field1) !== JSON.stringify(field2)) {
        modified.push(fieldName as string);
      }
    }

    return { added: added as string[], removed: removed as string[], modified: modified as string[] };
  }

  /**
   * Increment version number
   */
  private incrementVersion(
    current: string,
    type: 'major' | 'minor' | 'patch'
  ): string {
    const [major, minor, patch] = current.split('.').map(Number);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return current;
    }
  }

  /**
   * Export version history as JSON
   */
  async exportVersionHistory(nodeType: string): Promise<string> {
    const history = await this.getVersionHistory(nodeType);
    return JSON.stringify(history, null, 2);
  }

  /**
   * Import version history from JSON
   */
  async importVersionHistory(historyJson: string): Promise<void> {
    const history: NodeVersionHistory = JSON.parse(historyJson);
    const historyKey = `node-versions-${history.nodeType}`;

    await this.kvStore.set(historyKey, historyJson, 8760);

    // Update current version
    if (history.currentVersion && history.versions.length > 0) {
      const currentVersion = history.versions.find(
        v => v.version === history.currentVersion
      );

      if (currentVersion) {
        await this.kvStore.set(
          `node-schema-${history.nodeType}`,
          JSON.stringify({
            version: history.currentVersion,
            schema: currentVersion.schema
          }),
          8760
        );
      }
    }
  }
}
