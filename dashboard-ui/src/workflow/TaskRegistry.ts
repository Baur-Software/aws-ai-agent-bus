// Task Registry Implementation
// Manages registration and retrieval of workflow tasks with dependency injection support

import {
  WorkflowTask,
  TaskRegistry as ITaskRegistry,
  TaskDisplayInfo,
  WorkflowEngineError,
  NODE_CATEGORIES
} from './types';

export class TaskRegistry implements ITaskRegistry {
  private tasks = new Map<string, WorkflowTask>();
  private tasksByCategory = new Map<string, Set<string>>();
  private tasksByIntegration = new Map<string, Set<string>>();

  registerTask(task: WorkflowTask): void {
    if (this.tasks.has(task.type)) {
      throw new WorkflowEngineError(`Task type '${task.type}' is already registered`);
    }

    this.tasks.set(task.type, task);

    // Index by category
    const displayInfo = task.getDisplayInfo?.();
    if (displayInfo?.category) {
      if (!this.tasksByCategory.has(displayInfo.category)) {
        this.tasksByCategory.set(displayInfo.category, new Set());
      }
      this.tasksByCategory.get(displayInfo.category)!.add(task.type);
    }

    // Index by integration requirement
    if (displayInfo?.integrationRequired) {
      if (!this.tasksByIntegration.has(displayInfo.integrationRequired)) {
        this.tasksByIntegration.set(displayInfo.integrationRequired, new Set());
      }
      this.tasksByIntegration.get(displayInfo.integrationRequired)!.add(task.type);
    }

    console.log(`Registered task: ${task.type} (${displayInfo?.category || 'Unknown'})`);
  }

  getTask(type: string): WorkflowTask | undefined {
    return this.tasks.get(type);
  }

  getAllTaskTypes(): string[] {
    return Array.from(this.tasks.keys()).sort();
  }

  hasTask(type: string): boolean {
    return this.tasks.has(type);
  }

  getTasksByCategory(category: string): WorkflowTask[] {
    const taskTypes = this.tasksByCategory.get(category) || new Set();
    return Array.from(taskTypes)
      .map(type => this.tasks.get(type))
      .filter((task): task is WorkflowTask => task !== undefined)
      .sort((a, b) => {
        const aInfo = a.getDisplayInfo?.();
        const bInfo = b.getDisplayInfo?.();
        return (aInfo?.label || a.type).localeCompare(bInfo?.label || b.type);
      });
  }

  getTasksRequiringIntegration(integration: string): WorkflowTask[] {
    const taskTypes = this.tasksByIntegration.get(integration) || new Set();
    return Array.from(taskTypes)
      .map(type => this.tasks.get(type))
      .filter((task): task is WorkflowTask => task !== undefined)
      .sort((a, b) => {
        const aInfo = a.getDisplayInfo?.();
        const bInfo = b.getDisplayInfo?.();
        return (aInfo?.label || a.type).localeCompare(bInfo?.label || b.type);
      });
  }

  // Utility methods
  getAllCategories(): string[] {
    return Array.from(this.tasksByCategory.keys()).sort();
  }

  getAllIntegrations(): string[] {
    return Array.from(this.tasksByIntegration.keys()).sort();
  }

  getTaskCount(): number {
    return this.tasks.size;
  }

  getTaskCountByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.tasksByCategory.forEach((tasks, category) => {
      counts[category] = tasks.size;
    });
    return counts;
  }

  getTaskInfo(type: string): TaskDisplayInfo | null {
    const task = this.tasks.get(type);
    return task?.getDisplayInfo?.() || null;
  }

  // Search and filtering
  searchTasks(query: string): WorkflowTask[] {
    const lowercaseQuery = query.toLowerCase();
    
    return Array.from(this.tasks.values()).filter(task => {
      const displayInfo = task.getDisplayInfo?.();
      const label = displayInfo?.label || task.type;
      const description = displayInfo?.description || '';
      const tags = displayInfo?.tags || [];
      
      return (
        task.type.toLowerCase().includes(lowercaseQuery) ||
        label.toLowerCase().includes(lowercaseQuery) ||
        description.toLowerCase().includes(lowercaseQuery) ||
        tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
      );
    }).sort((a, b) => {
      const aInfo = a.getDisplayInfo?.();
      const bInfo = b.getDisplayInfo?.();
      return (aInfo?.label || a.type).localeCompare(bInfo?.label || b.type);
    });
  }

  filterTasks(filters: {
    category?: string;
    integration?: string;
    tags?: string[];
  }): WorkflowTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filters.category) {
      const categoryTasks = this.getTasksByCategory(filters.category);
      tasks = tasks.filter(task => categoryTasks.includes(task));
    }

    if (filters.integration) {
      const integrationTasks = this.getTasksRequiringIntegration(filters.integration);
      tasks = tasks.filter(task => integrationTasks.includes(task));
    }

    if (filters.tags && filters.tags.length > 0) {
      tasks = tasks.filter(task => {
        const displayInfo = task.getDisplayInfo?.();
        const taskTags = displayInfo?.tags || [];
        return filters.tags!.some(tag => taskTags.includes(tag));
      });
    }

    return tasks.sort((a, b) => {
      const aInfo = a.getDisplayInfo?.();
      const bInfo = b.getDisplayInfo?.();
      return (aInfo?.label || a.type).localeCompare(bInfo?.label || b.type);
    });
  }

  // Bulk operations
  registerTasks(tasks: WorkflowTask[]): void {
    const errors: string[] = [];
    
    for (const task of tasks) {
      try {
        this.registerTask(task);
      } catch (error) {
        errors.push(`Failed to register task ${task.type}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new WorkflowEngineError(`Failed to register some tasks: ${errors.join(', ')}`);
    }

    console.log(`Successfully registered ${tasks.length} tasks`);
  }

  unregisterTask(type: string): boolean {
    if (!this.tasks.has(type)) {
      return false;
    }

    const task = this.tasks.get(type)!;
    const displayInfo = task.getDisplayInfo?.();

    // Remove from main registry
    this.tasks.delete(type);

    // Remove from category index
    if (displayInfo?.category) {
      const categoryTasks = this.tasksByCategory.get(displayInfo.category);
      categoryTasks?.delete(type);
      if (categoryTasks?.size === 0) {
        this.tasksByCategory.delete(displayInfo.category);
      }
    }

    // Remove from integration index
    if (displayInfo?.integrationRequired) {
      const integrationTasks = this.tasksByIntegration.get(displayInfo.integrationRequired);
      integrationTasks?.delete(type);
      if (integrationTasks?.size === 0) {
        this.tasksByIntegration.delete(displayInfo.integrationRequired);
      }
    }

    console.log(`Unregistered task: ${type}`);
    return true;
  }

  clear(): void {
    this.tasks.clear();
    this.tasksByCategory.clear();
    this.tasksByIntegration.clear();
    console.log('Cleared all registered tasks');
  }

  // Validation and health checks
  validateRegistry(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    let totalTasks = 0;

    for (const [type, task] of this.tasks) {
      totalTasks++;
      
      // Check if task type matches
      if (task.type !== type) {
        errors.push(`Task type mismatch: registered as '${type}' but task.type is '${task.type}'`);
      }

      // Check if required methods exist
      if (typeof task.execute !== 'function') {
        errors.push(`Task '${type}' missing execute method`);
      }

      // Validate display info if present
      const displayInfo = task.getDisplayInfo?.();
      if (displayInfo) {
        if (!displayInfo.category || !displayInfo.label) {
          errors.push(`Task '${type}' has incomplete display info`);
        }
      }

      // Validate schema if present
      try {
        const schema = task.getSchema?.();
        if (schema && (!schema.properties || typeof schema.properties !== 'object')) {
          errors.push(`Task '${type}' has invalid schema structure`);
        }
      } catch (error) {
        errors.push(`Task '${type}' schema validation failed: ${error.message}`);
      }
    }

    // Check index consistency
    let indexedTasks = 0;
    this.tasksByCategory.forEach(tasks => {
      indexedTasks += tasks.size;
    });

    if (indexedTasks !== totalTasks) {
      errors.push(`Category index inconsistency: ${totalTasks} tasks registered but ${indexedTasks} indexed`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Debug and inspection methods
  getRegistryStats(): {
    totalTasks: number;
    categories: Record<string, number>;
    integrations: Record<string, number>;
    tasksWithoutCategory: number;
    tasksWithoutDisplayInfo: number;
  } {
    let tasksWithoutCategory = 0;
    let tasksWithoutDisplayInfo = 0;

    for (const task of this.tasks.values()) {
      const displayInfo = task.getDisplayInfo?.();
      if (!displayInfo) {
        tasksWithoutDisplayInfo++;
      } else if (!displayInfo.category) {
        tasksWithoutCategory++;
      }
    }

    return {
      totalTasks: this.tasks.size,
      categories: this.getTaskCountByCategory(),
      integrations: Object.fromEntries(
        Array.from(this.tasksByIntegration.entries()).map(([key, tasks]) => [key, tasks.size])
      ),
      tasksWithoutCategory,
      tasksWithoutDisplayInfo
    };
  }

  exportTaskDefinitions(): Array<{
    type: string;
    displayInfo?: TaskDisplayInfo;
    schema?: any;
  }> {
    return Array.from(this.tasks.values()).map(task => ({
      type: task.type,
      displayInfo: task.getDisplayInfo?.(),
      schema: task.getSchema?.()
    }));
  }
}

// Factory function
export function createTaskRegistry(): TaskRegistry {
  return new TaskRegistry();
}