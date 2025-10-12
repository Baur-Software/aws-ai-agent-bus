// Workflow Storage Service
// Manages saving, loading, and organizing multiple workflows

import { WorkflowDefinition, WorkflowResult } from '../workflow/types';
import { MCPService } from './MCPService';

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  created: string;
  modified: string;
  author?: string;
  tags: string[];
  category?: string;
  isTemplate?: boolean;
  isPublic?: boolean;
  executionCount: number;
  lastExecuted?: string;
  lastExecutionStatus?: 'completed' | 'failed' | 'cancelled';
  thumbnail?: string; // Base64 encoded workflow preview
}

export interface WorkflowListItem extends WorkflowMetadata {
  nodeCount: number;
  connectionCount: number;
  estimatedDuration?: string;
  integrations: string[]; // List of required integrations
}

export interface WorkflowSaveOptions {
  generateId?: boolean;
  updateModified?: boolean;
  incrementVersion?: boolean;
  createBackup?: boolean;
  tags?: string[];
  category?: string;
  isTemplate?: boolean;
}

export interface WorkflowSearchFilters {
  query?: string;
  tags?: string[];
  category?: string;
  author?: string;
  isTemplate?: boolean;
  integrations?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface WorkflowImportResult {
  workflows: WorkflowDefinition[];
  imported: number;
  skipped: number;
  errors: string[];
}

export class WorkflowStorageService {
  private mcpService: MCPService;
  private userId: string;
  private storagePrefix: string;
  private metadataPrefix: string;
  private listKey: string;
  private templatesKey: string;

  constructor(mcpService: MCPService, userId: string = 'demo-user-123') {
    this.mcpService = mcpService;
    this.userId = userId;
    
    // User-scoped storage keys
    this.storagePrefix = `user-${userId}-workflow-`;
    this.metadataPrefix = `user-${userId}-workflow-meta-`;
    this.listKey = `user-${userId}-workflow-list`;
    this.templatesKey = `user-${userId}-workflow-templates`;
  }

  // Core workflow operations
  async saveWorkflow(
    workflow: WorkflowDefinition,
    options: WorkflowSaveOptions = {}
  ): Promise<string> {
    const id = workflow.name ? this.slugify(workflow.name) : this.generateWorkflowId();
    const now = new Date().toISOString();
    
    // Create backup if requested
    if (options.createBackup && await this.workflowExists(id)) {
      await this.createBackup(id);
    }

    // Update workflow metadata
    const updatedWorkflow: WorkflowDefinition = {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        id,
        version: options.incrementVersion 
          ? this.incrementVersion(workflow.metadata?.version || '1.0.0')
          : workflow.metadata?.version || '1.0.0',
        created: workflow.metadata?.created || now,
        modified: options.updateModified !== false ? now : workflow.metadata?.modified || now,
        tags: options.tags || workflow.metadata?.tags || [],
        category: options.category || workflow.metadata?.category,
        isTemplate: options.isTemplate || workflow.metadata?.isTemplate || false
      }
    };

    // Save workflow definition
    const workflowKey = `${this.storagePrefix}${id}`;
    await this.mcpService.artifactsPut(
      workflowKey,
      JSON.stringify(updatedWorkflow, null, 2),
      'application/json'
    );

    // Extract and save metadata
    const metadata = this.extractMetadata(updatedWorkflow);
    await this.saveWorkflowMetadata(id, metadata);

    // Update workflow list
    await this.updateWorkflowList(id, metadata);

    console.log(`✅ Saved workflow: ${id} (${workflow.name})`);
    return id;
  }

  async loadWorkflow(id: string): Promise<WorkflowDefinition | null> {
    try {
      const workflowKey = `${this.storagePrefix}${id}`;
      const artifact = await this.mcpService.artifactsGet(workflowKey);
      
      if (!artifact) {
        return null;
      }

      const workflow = JSON.parse(artifact.content) as WorkflowDefinition;
      
      // Update access metadata
      this.updateAccessMetadata(id);
      
      return workflow;
    } catch (error) {
      console.error(`Failed to load workflow ${id}:`, error);
      return null;
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      // Check if workflow exists
      const metadata = await this.getWorkflowMetadata(id);
      if (!metadata) {
        return false;
      }

      // Create backup before deletion
      await this.createBackup(id);

      // Delete workflow definition
      const workflowKey = `${this.storagePrefix}${id}`;
      // Note: MCP doesn't have delete, so we'll store a deleted marker
      await this.mcpService.artifactsPut(
        workflowKey,
        JSON.stringify({ deleted: true, deletedAt: new Date().toISOString() }),
        'application/json'
      );

      // Remove from workflow list
      await this.removeFromWorkflowList(id);

      console.log(`🗑️ Deleted workflow: ${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete workflow ${id}:`, error);
      return false;
    }
  }

  async duplicateWorkflow(id: string, newName: string): Promise<string | null> {
    try {
      const originalWorkflow = await this.loadWorkflow(id);
      if (!originalWorkflow) {
        return null;
      }

      // Create duplicate with new name and ID
      const duplicatedWorkflow: WorkflowDefinition = {
        ...originalWorkflow,
        name: newName,
        description: `Copy of ${originalWorkflow.description || originalWorkflow.name}`,
        metadata: {
          ...originalWorkflow.metadata,
          created: undefined, // Will be set by saveWorkflow
          modified: undefined, // Will be set by saveWorkflow
          version: '1.0.0',
          author: originalWorkflow.metadata?.author
        }
      };

      const newId = await this.saveWorkflow(duplicatedWorkflow, {
        generateId: true,
        updateModified: true
      });

      console.log(`📋 Duplicated workflow: ${id} → ${newId}`);
      return newId;
    } catch (error) {
      console.error(`Failed to duplicate workflow ${id}:`, error);
      return null;
    }
  }

  // Workflow listing and search
  async listWorkflows(filters?: WorkflowSearchFilters): Promise<WorkflowListItem[]> {
    try {
      const workflowList = await this.getWorkflowList();
      let results = workflowList;

      if (filters) {
        results = this.filterWorkflows(results, filters);
      }

      return results.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    } catch (error) {
      console.error('Failed to list workflows:', error);
      return [];
    }
  }

  async searchWorkflows(query: string): Promise<WorkflowListItem[]> {
    const allWorkflows = await this.listWorkflows();
    const lowercaseQuery = query.toLowerCase();

    return allWorkflows.filter(workflow =>
      workflow.name.toLowerCase().includes(lowercaseQuery) ||
      workflow.description.toLowerCase().includes(lowercaseQuery) ||
      workflow.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
      workflow.author?.toLowerCase().includes(lowercaseQuery)
    );
  }

  async getWorkflowsByCategory(category: string): Promise<WorkflowListItem[]> {
    return this.listWorkflows({ category });
  }

  async getWorkflowsByTag(tag: string): Promise<WorkflowListItem[]> {
    return this.listWorkflows({ tags: [tag] });
  }

  async getRecentWorkflows(limit: number = 10): Promise<WorkflowListItem[]> {
    const workflows = await this.listWorkflows();
    return workflows.slice(0, limit);
  }

  async getPopularWorkflows(limit: number = 10): Promise<WorkflowListItem[]> {
    const workflows = await this.listWorkflows();
    return workflows
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, limit);
  }

  // Template management
  async getWorkflowTemplates(): Promise<WorkflowListItem[]> {
    return this.listWorkflows({ isTemplate: true });
  }

  async createTemplate(workflowId: string): Promise<boolean> {
    try {
      const workflow = await this.loadWorkflow(workflowId);
      if (!workflow) return false;

      const templateWorkflow = {
        ...workflow,
        metadata: {
          ...workflow.metadata,
          isTemplate: true,
          templateCreated: new Date().toISOString()
        }
      };

      await this.saveWorkflow(templateWorkflow, { isTemplate: true });
      return true;
    } catch (error) {
      console.error(`Failed to create template from ${workflowId}:`, error);
      return false;
    }
  }

  async createWorkflowFromTemplate(templateId: string, name: string): Promise<string | null> {
    try {
      const template = await this.loadWorkflow(templateId);
      if (!template) return null;

      const newWorkflow: WorkflowDefinition = {
        ...template,
        name,
        description: `Created from template: ${template.name}`,
        metadata: {
          ...template.metadata,
          id: undefined, // Will be generated
          isTemplate: false,
          templateSource: templateId,
          created: undefined,
          modified: undefined,
          version: '1.0.0'
        }
      };

      return await this.saveWorkflow(newWorkflow);
    } catch (error) {
      console.error(`Failed to create workflow from template ${templateId}:`, error);
      return null;
    }
  }

  // Import/Export
  async exportWorkflow(id: string): Promise<string | null> {
    try {
      const workflow = await this.loadWorkflow(id);
      if (!workflow) return null;

      return JSON.stringify(workflow, null, 2);
    } catch (error) {
      console.error(`Failed to export workflow ${id}:`, error);
      return null;
    }
  }

  async exportWorkflows(ids: string[]): Promise<string | null> {
    try {
      const workflows: WorkflowDefinition[] = [];
      
      for (const id of ids) {
        const workflow = await this.loadWorkflow(id);
        if (workflow) {
          workflows.push(workflow);
        }
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        workflows
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export workflows:', error);
      return null;
    }
  }

  async importWorkflows(jsonData: string): Promise<WorkflowImportResult> {
    const result: WorkflowImportResult = {
      workflows: [],
      imported: 0,
      skipped: 0,
      errors: []
    };

    try {
      const data = JSON.parse(jsonData);
      
      // Handle single workflow or workflow collection
      const workflows = Array.isArray(data) ? data : 
                       data.workflows ? data.workflows : [data];

      for (const workflowData of workflows) {
        try {
          // Validate workflow structure
          if (!this.isValidWorkflow(workflowData)) {
            result.errors.push(`Invalid workflow structure: ${workflowData.name || 'Unknown'}`);
            result.skipped++;
            continue;
          }

          const workflow = workflowData as WorkflowDefinition;
          
          // Check if workflow already exists
          const existingId = workflow.metadata?.id || this.slugify(workflow.name);
          if (await this.workflowExists(existingId)) {
            result.errors.push(`Workflow already exists: ${workflow.name}`);
            result.skipped++;
            continue;
          }

          // Import the workflow
          const id = await this.saveWorkflow(workflow, {
            generateId: true,
            updateModified: true
          });

          result.workflows.push(workflow);
          result.imported++;
          
          console.log(`📥 Imported workflow: ${id} (${workflow.name})`);
        } catch (error) {
          result.errors.push(`Failed to import workflow: ${error.message}`);
          result.skipped++;
        }
      }

      console.log(`✅ Import completed: ${result.imported} imported, ${result.skipped} skipped`);
      return result;
    } catch (error) {
      result.errors.push(`Invalid JSON data: ${error.message}`);
      return result;
    }
  }

  // Execution history and analytics
  async recordExecution(workflowId: string, result: WorkflowResult): Promise<void> {
    try {
      const metadata = await this.getWorkflowMetadata(workflowId);
      if (!metadata) return;

      // Update execution metadata
      const updatedMetadata: WorkflowMetadata = {
        ...metadata,
        executionCount: metadata.executionCount + 1,
        lastExecuted: result.endTime || result.startTime,
        lastExecutionStatus: result.status === 'running' ? 'completed' : result.status
      };

      await this.saveWorkflowMetadata(workflowId, updatedMetadata);
      
      // Store user-scoped execution history (last 10 executions)
      const historyKey = `user-${this.userId}-workflow-executions-${workflowId}`;
      const existingHistory = await this.mcpService.kvGet(historyKey) || [];
      const newHistory = [result, ...existingHistory.slice(0, 9)];
      
      await this.mcpService.kvSet(historyKey, newHistory, 168); // 1 week TTL
    } catch (error) {
      console.error(`Failed to record execution for ${workflowId}:`, error);
    }
  }

  async getExecutionHistory(workflowId: string): Promise<WorkflowResult[]> {
    try {
      const historyKey = `user-${this.userId}-workflow-executions-${workflowId}`;
      return await this.mcpService.kvGet(historyKey) || [];
    } catch (error) {
      console.error(`Failed to get execution history for ${workflowId}:`, error);
      return [];
    }
  }

  // User management methods
  getCurrentUserId(): string {
    return this.userId;
  }

  // User preferences management
  async getWorkflowPreferences(): Promise<any> {
    try {
      const prefsKey = `user-${this.userId}-workflow-preferences`;
      return await this.mcpService.kvGet(prefsKey);
    } catch {
      return null;
    }
  }

  async saveWorkflowPreferences(preferences: any): Promise<void> {
    const prefsKey = `user-${this.userId}-workflow-preferences`;
    await this.mcpService.kvSet(prefsKey, preferences, 8760); // 1 year TTL
  }

  // Integration connection management
  async getUserIntegrationKeys(): Promise<string[]> {
    try {
      const prefix = `user-${this.userId}-integration-`;
      // In a real implementation, this would list all keys with the prefix
      // For now, we'll simulate by returning known integration types
      return [
        `${prefix}google-analytics-default`,
        `${prefix}trello-default`,
        `${prefix}slack-default`,
        `${prefix}github-default`,
        `${prefix}stripe-default`
      ];
    } catch {
      return [];
    }
  }

  async getIntegrationConnection(key: string): Promise<any> {
    try {
      return await this.mcpService.kvGet(key);
    } catch {
      return null;
    }
  }

  async saveIntegrationConnection(connectionId: string, connection: any): Promise<void> {
    const connectionKey = `user-${this.userId}-integration-${connectionId}`;
    await this.mcpService.kvSet(connectionKey, connection, 8760); // 1 year TTL
  }

  async deleteIntegrationConnection(connectionId: string): Promise<void> {
    const connectionKey = `user-${this.userId}-integration-${connectionId}`;
    // In a real KV store, we would delete the key
    // For MCP, we'll set it to null or a deletion marker
    await this.mcpService.kvSet(connectionKey, { deleted: true, deletedAt: new Date().toISOString() }, 1);
  }

  async switchUser(newUserId: string): Promise<void> {
    this.userId = newUserId;
    this.storagePrefix = `user-${newUserId}-workflow-`;
    this.metadataPrefix = `user-${newUserId}-workflow-meta-`;
    this.listKey = `user-${newUserId}-workflow-list`;
    this.templatesKey = `user-${newUserId}-workflow-templates`;
    
    console.log(`🔄 Switched to user: ${newUserId}`);
  }

  // Global template access (shared across users)
  async getGlobalTemplates(): Promise<WorkflowListItem[]> {
    try {
      const globalTemplatesKey = 'global-workflow-templates';
      const templates = await this.mcpService.kvGet(globalTemplatesKey) || [];
      return templates;
    } catch {
      return [];
    }
  }

  async shareWorkflowAsGlobalTemplate(workflowId: string): Promise<boolean> {
    try {
      const workflow = await this.loadWorkflow(workflowId);
      if (!workflow) return false;

      const templateWorkflow = {
        ...workflow,
        metadata: {
          ...workflow.metadata,
          isTemplate: true,
          isPublic: true,
          sharedBy: this.userId,
          sharedAt: new Date().toISOString()
        }
      };

      const globalTemplatesKey = 'global-workflow-templates';
      const existingTemplates = await this.mcpService.kvGet(globalTemplatesKey) || [];
      
      const templateMetadata = this.extractMetadata(templateWorkflow);
      const listItem: WorkflowListItem = {
        ...templateMetadata,
        nodeCount: workflow.nodes.length,
        connectionCount: workflow.connections?.length || 0,
        integrations: this.extractRequiredIntegrations(workflow)
      };

      const updatedTemplates = [...existingTemplates, listItem];
      await this.mcpService.kvSet(globalTemplatesKey, updatedTemplates, 8760);

      // Also store the workflow data globally
      const globalWorkflowKey = `global-template-${workflowId}`;
      await this.mcpService.artifactsPut(
        globalWorkflowKey,
        JSON.stringify(templateWorkflow, null, 2),
        'application/json'
      );

      console.log(`🌍 Shared workflow as global template: ${workflowId}`);
      return true;
    } catch (error) {
      console.error(`Failed to share workflow as global template:`, error);
      return false;
    }
  }

  // Utility methods
  async workflowExists(id: string): Promise<boolean> {
    const workflowKey = `${this.storagePrefix}${id}`;
    const artifact = await this.mcpService.artifactsGet(workflowKey);
    
    if (!artifact) return false;
    
    // Check if it's a deletion marker
    try {
      const content = JSON.parse(artifact.content);
      return !content.deleted;
    } catch {
      return true; // Valid JSON workflow
    }
  }

  async getWorkflowMetadata(id: string): Promise<WorkflowMetadata | null> {
    try {
      const metadataKey = `${this.metadataPrefix}${id}`;
      const metadata = await this.mcpService.kvGet(metadataKey);
      return metadata || null;
    } catch {
      return null;
    }
  }

  private async saveWorkflowMetadata(id: string, metadata: WorkflowMetadata): Promise<void> {
    const metadataKey = `${this.metadataPrefix}${id}`;
    await this.mcpService.kvSet(metadataKey, metadata, 8760); // 1 year TTL
  }

  private extractMetadata(workflow: WorkflowDefinition): WorkflowMetadata {
    const requiredIntegrations = this.extractRequiredIntegrations(workflow);
    
    return {
      id: workflow.metadata?.id || this.slugify(workflow.name),
      name: workflow.name,
      description: workflow.description,
      version: workflow.metadata?.version || '1.0.0',
      created: workflow.metadata?.created || new Date().toISOString(),
      modified: workflow.metadata?.modified || new Date().toISOString(),
      author: workflow.metadata?.author,
      tags: workflow.metadata?.tags || [],
      category: workflow.metadata?.category,
      isTemplate: workflow.metadata?.isTemplate || false,
      isPublic: workflow.metadata?.isPublic || false,
      executionCount: workflow.metadata?.executionCount || 0,
      lastExecuted: workflow.metadata?.lastExecuted,
      lastExecutionStatus: workflow.metadata?.lastExecutionStatus,
      thumbnail: workflow.metadata?.thumbnail
    };
  }

  private extractRequiredIntegrations(workflow: WorkflowDefinition): string[] {
    const integrations = new Set<string>();
    
    // Map node types to integration requirements
    const nodeIntegrationMap: Record<string, string> = {
      'trello-create-card': 'trello',
      'trello-create-board': 'trello',
      'trello-get-boards': 'trello',
      'trello-add-to-list': 'trello',
      'slack-message': 'slack',
      'github-webhook': 'github',
      'stripe-payment': 'stripe'
    };

    workflow.nodes.forEach(node => {
      const integration = nodeIntegrationMap[node.type];
      if (integration) {
        integrations.add(integration);
      }
    });

    return Array.from(integrations);
  }

  private async getWorkflowList(): Promise<WorkflowListItem[]> {
    try {
      const list = await this.mcpService.kvGet(this.listKey) || [];
      return list;
    } catch {
      return [];
    }
  }

  private async updateWorkflowList(id: string, metadata: WorkflowMetadata): Promise<void> {
    try {
      const list = await this.getWorkflowList();
      const existingIndex = list.findIndex(item => item.id === id);
      
      const workflow = await this.loadWorkflow(id);
      const listItem: WorkflowListItem = {
        ...metadata,
        nodeCount: workflow?.nodes.length || 0,
        connectionCount: workflow?.connections?.length || 0,
        integrations: workflow ? this.extractRequiredIntegrations(workflow) : []
      };

      if (existingIndex >= 0) {
        list[existingIndex] = listItem;
      } else {
        list.push(listItem);
      }

      await this.mcpService.kvSet(this.listKey, list, 8760); // 1 year TTL
    } catch (error) {
      console.error(`Failed to update workflow list for ${id}:`, error);
    }
  }

  private async removeFromWorkflowList(id: string): Promise<void> {
    try {
      const list = await this.getWorkflowList();
      const filteredList = list.filter(item => item.id !== id);
      await this.mcpService.kvSet(this.listKey, filteredList, 8760);
    } catch (error) {
      console.error(`Failed to remove ${id} from workflow list:`, error);
    }
  }

  private filterWorkflows(workflows: WorkflowListItem[], filters: WorkflowSearchFilters): WorkflowListItem[] {
    return workflows.filter(workflow => {
      // Query filter
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const matchesQuery = workflow.name.toLowerCase().includes(query) ||
                            workflow.description.toLowerCase().includes(query) ||
                            workflow.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const hasRequiredTag = filters.tags.some(tag => workflow.tags.includes(tag));
        if (!hasRequiredTag) return false;
      }

      // Category filter
      if (filters.category && workflow.category !== filters.category) {
        return false;
      }

      // Author filter
      if (filters.author && workflow.author !== filters.author) {
        return false;
      }

      // Template filter
      if (filters.isTemplate !== undefined && workflow.isTemplate !== filters.isTemplate) {
        return false;
      }

      // Integrations filter
      if (filters.integrations && filters.integrations.length > 0) {
        const hasRequiredIntegration = filters.integrations.some(integration => 
          workflow.integrations.includes(integration)
        );
        if (!hasRequiredIntegration) return false;
      }

      // Date filters
      if (filters.createdAfter) {
        if (new Date(workflow.created) < new Date(filters.createdAfter)) return false;
      }

      if (filters.createdBefore) {
        if (new Date(workflow.created) > new Date(filters.createdBefore)) return false;
      }

      return true;
    });
  }

  private async updateAccessMetadata(id: string): Promise<void> {
    // Update last accessed timestamp asynchronously
    setTimeout(async () => {
      try {
        const metadata = await this.getWorkflowMetadata(id);
        if (metadata) {
          metadata.lastExecuted = new Date().toISOString();
          await this.saveWorkflowMetadata(id, metadata);
        }
      } catch {
        // Ignore errors for access tracking
      }
    }, 0);
  }

  private async createBackup(id: string): Promise<void> {
    try {
      const workflow = await this.loadWorkflow(id);
      if (workflow) {
        const backupKey = `${this.storagePrefix}${id}-backup-${Date.now()}`;
        await this.mcpService.artifactsPut(
          backupKey,
          JSON.stringify(workflow, null, 2),
          'application/json'
        );
      }
    } catch (error) {
      console.warn(`Failed to create backup for ${id}:`, error);
    }
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
  }

  private isValidWorkflow(data: any): boolean {
    return data && 
           typeof data.name === 'string' && 
           Array.isArray(data.nodes) && 
           data.nodes.length > 0;
  }
}

// Factory function
export function createWorkflowStorageService(mcpService: MCPService, userId?: string): WorkflowStorageService {
  return new WorkflowStorageService(mcpService, userId);
}