import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import type { WorkflowMetadata } from '../workflow/core/WorkflowManager';
import type { WorkflowNode } from '../workflow/ui/WorkflowNodeDetails';

// Mock timers for testing auto-save functionality
vi.useFakeTimers();

// Auto-save service implementation for testing
class AutoSaveService {
  private saveCallback: ((data: any) => Promise<void>) | null = null;
  private autoSaveTimer: number | null = null;
  private conflictResolver: ((local: any, remote: any) => any) | null = null;
  private lastSaved: Date | null = null;
  private isDirty = false;
  private activeSaveCount = 0; // Track concurrent saves
  private saveDelay: number;
  private pendingData: any = null;
  private timerSequence = 0; // Track timer generations

  constructor(saveDelay = 2000) {
    this.saveDelay = saveDelay;
  }

  setSaveCallback(callback: (data: any) => Promise<void>): void {
    this.saveCallback = callback;
  }

  setConflictResolver(resolver: (local: any, remote: any) => any): void {
    this.conflictResolver = resolver;
  }

  scheduleAutoSave(data: any): void {
    // Clear any existing timer first
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.isDirty = true;
    this.pendingData = data; // Store latest data
    this.timerSequence++; // Increment timer generation

    // Capture current sequence for closure
    const currentSequence = this.timerSequence;

    // Create new timer with current data
    this.autoSaveTimer = setTimeout(async () => {
      // Only execute if this timer is still the current one
      if (currentSequence === this.timerSequence && this.isDirty && this.activeSaveCount === 0 && this.pendingData !== undefined) {
        await this.performAutoSave(this.pendingData);
      }
      // Clear timer reference only if it's still the current one
      if (currentSequence === this.timerSequence) {
        this.autoSaveTimer = null;
      }
    }, this.saveDelay);
  }

  private async performAutoSave(data: any): Promise<void> {
    if (!this.saveCallback) return;

    this.activeSaveCount++;

    try {
      await this.saveCallback(data);
      this.lastSaved = new Date();
      this.isDirty = false;
      this.pendingData = null; // Clear pending data after successful save
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Keep dirty flag set so we can retry
    } finally {
      this.activeSaveCount--;
    }
  }

  async forceSave(data: any): Promise<void> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.pendingData = null; // Clear pending data since we're forcing save

    await this.performAutoSave(data);
  }

  async handleConflict(localData: any, remoteData: any): Promise<any> {
    if (!this.conflictResolver) {
      // Default strategy: remote wins
      return remoteData;
    }

    return this.conflictResolver(localData, remoteData);
  }

  getStatus(): {
    isDirty: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
  } {
    return {
      isDirty: this.isDirty,
      isSaving: this.activeSaveCount > 0,
      lastSaved: this.lastSaved
    };
  }

  destroy(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }
}

describe('Auto-Save Functionality', () => {
  let autoSaveService: AutoSaveService;
  let saveCallback: vi.Mock;
  let sampleWorkflowData: any;

  beforeEach(() => {
    vi.clearAllTimers();
    autoSaveService = new AutoSaveService(2000);
    saveCallback = vi.fn();
    autoSaveService.setSaveCallback(saveCallback);

    sampleWorkflowData = {
      workflow: {
        id: 'wf-test',
        name: 'Test Workflow',
        currentVersion: 1
      },
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          x: 100,
          y: 100,
          config: { event: 'webhook' }
        }
      ],
      connections: []
    };
  });

  afterEach(() => {
    autoSaveService.destroy();
    vi.clearAllMocks();
  });

  describe('Basic Auto-Save', () => {
    it('triggers auto-save after specified delay', async () => {
      saveCallback.mockResolvedValue(undefined);

      autoSaveService.scheduleAutoSave(sampleWorkflowData);

      expect(saveCallback).not.toHaveBeenCalled();
      expect(autoSaveService.getStatus().isDirty).toBe(true);

      // Fast-forward timers
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledWith(sampleWorkflowData);
      expect(autoSaveService.getStatus().isDirty).toBe(false);
      expect(autoSaveService.getStatus().lastSaved).toBeTruthy();
    });

    it('saves only the latest data when multiple changes occur rapidly', async () => {
      saveCallback.mockResolvedValue(undefined);

      // Simulate rapid changes - each should reset the timer
      const change1 = { ...sampleWorkflowData, version: 1 };
      const change2 = { ...sampleWorkflowData, version: 2 };
      const change3 = { ...sampleWorkflowData, version: 3 };

      // Make rapid changes without advancing time
      autoSaveService.scheduleAutoSave(change1);
      autoSaveService.scheduleAutoSave(change2);
      autoSaveService.scheduleAutoSave(change3);

      // Now advance full delay - should only save the latest change
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledTimes(1);
      expect(saveCallback).toHaveBeenCalledWith(change3); // Only the last change
      expect(autoSaveService.getStatus().isDirty).toBe(false);
    });

    it('does not auto-save if already saving', async () => {
      let resolvePromise: () => void;
      const savePromise = new Promise<void>(resolve => {
        resolvePromise = resolve;
      });

      saveCallback.mockReturnValue(savePromise);

      // Start first auto-save
      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(true);

      // Schedule another auto-save while first is in progress
      const modifiedData = { ...sampleWorkflowData, modified: true };
      autoSaveService.scheduleAutoSave(modifiedData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      // Should still only have one save call
      expect(saveCallback).toHaveBeenCalledTimes(1);

      // Complete first save
      resolvePromise();
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(false);
    });

    it('handles save errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      saveCallback.mockRejectedValue(new Error('Save failed'));

      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(consoleError).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error));
      expect(autoSaveService.getStatus().isDirty).toBe(true); // Should remain dirty for retry
      expect(autoSaveService.getStatus().isSaving).toBe(false);

      consoleError.mockRestore();
    });
  });

  describe('Force Save', () => {
    it('immediately saves without waiting for timer', async () => {
      saveCallback.mockResolvedValue(undefined);

      autoSaveService.scheduleAutoSave(sampleWorkflowData);

      // Force save before timer expires
      await autoSaveService.forceSave(sampleWorkflowData);

      expect(saveCallback).toHaveBeenCalledWith(sampleWorkflowData);
      expect(autoSaveService.getStatus().isDirty).toBe(false);

      // Timer should not trigger additional save
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledTimes(1);
    });

    it('cancels pending auto-save timer', async () => {
      saveCallback.mockResolvedValue(undefined);

      autoSaveService.scheduleAutoSave(sampleWorkflowData);

      // Force save cancels timer
      await autoSaveService.forceSave({ ...sampleWorkflowData, forced: true });

      expect(saveCallback).toHaveBeenCalledWith({ ...sampleWorkflowData, forced: true });

      // Original timer should not fire
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Conflict Resolution', () => {
    it('uses default conflict resolution strategy', async () => {
      const localData = { version: 1, local: true };
      const remoteData = { version: 2, remote: true };

      const result = await autoSaveService.handleConflict(localData, remoteData);

      // Default strategy: remote wins
      expect(result).toEqual(remoteData);
    });

    it('uses custom conflict resolution strategy', async () => {
      const localData = { version: 1, nodes: ['local-node'] };
      const remoteData = { version: 2, nodes: ['remote-node'] };

      // Custom resolver that merges data
      autoSaveService.setConflictResolver((local, remote) => ({
        version: Math.max(local.version, remote.version),
        nodes: [...local.nodes, ...remote.nodes]
      }));

      const result = await autoSaveService.handleConflict(localData, remoteData);

      expect(result).toEqual({
        version: 2,
        nodes: ['local-node', 'remote-node']
      });
    });

    it('handles timestamp-based conflict resolution', async () => {
      const now = Date.now();
      const localData = {
        version: 1,
        updatedAt: new Date(now).toISOString(),
        content: 'local'
      };
      const remoteData = {
        version: 1,
        updatedAt: new Date(now - 1000).toISOString(),
        content: 'remote'
      };

      // Timestamp-based resolver: newer wins
      autoSaveService.setConflictResolver((local, remote) => {
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();
        return localTime > remoteTime ? local : remote;
      });

      const result = await autoSaveService.handleConflict(localData, remoteData);

      expect(result.content).toBe('local');
    });
  });

  describe('Status Tracking', () => {
    it('correctly tracks dirty state', async () => {
      expect(autoSaveService.getStatus().isDirty).toBe(false);

      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      expect(autoSaveService.getStatus().isDirty).toBe(true);

      saveCallback.mockResolvedValue(undefined);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isDirty).toBe(false);
    });

    it('correctly tracks saving state', async () => {
      let resolvePromise: () => void;
      const savePromise = new Promise<void>(resolve => {
        resolvePromise = resolve;
      });

      saveCallback.mockReturnValue(savePromise);

      expect(autoSaveService.getStatus().isSaving).toBe(false);

      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(true);

      resolvePromise();
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(false);
    });

    it('correctly tracks last saved timestamp', async () => {
      saveCallback.mockResolvedValue(undefined);

      expect(autoSaveService.getStatus().lastSaved).toBeNull();

      const beforeSave = new Date();
      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
      const afterSave = new Date();

      const lastSaved = autoSaveService.getStatus().lastSaved!;
      expect(lastSaved).toBeTruthy();
      expect(lastSaved.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(lastSaved.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });
  });

  describe('Performance and Memory', () => {
    it('handles rapid successive changes efficiently', async () => {
      saveCallback.mockResolvedValue(undefined);

      // Schedule 100 rapid changes
      for (let i = 0; i < 100; i++) {
        autoSaveService.scheduleAutoSave({ ...sampleWorkflowData, change: i });
      }

      // Only one timer should be active
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      // Should only save once with the final data
      expect(saveCallback).toHaveBeenCalledTimes(1);
      expect(saveCallback).toHaveBeenCalledWith({ ...sampleWorkflowData, change: 99 });
    });

    it('properly cleans up timers on destroy', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      autoSaveService.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('handles large data payloads', async () => {
      saveCallback.mockResolvedValue(undefined);

      // Create large workflow data
      const largeData = {
        workflow: sampleWorkflowData.workflow,
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `node-${i}`,
          type: 'agent-conductor',
          x: i * 50,
          y: i * 50,
          config: { goal: `Task ${i}` }
        })),
        connections: []
      };

      autoSaveService.scheduleAutoSave(largeData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledWith(largeData);
      // Test should process without errors or hanging
      expect(autoSaveService.getStatus().isDirty).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined/null data gracefully', async () => {
      saveCallback.mockResolvedValue(undefined);

      autoSaveService.scheduleAutoSave(null);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(saveCallback).toHaveBeenCalledWith(null);
      expect(autoSaveService.getStatus().isDirty).toBe(false);
    });

    it('handles save callback throwing synchronous errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      saveCallback.mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(consoleError).toHaveBeenCalled();
      expect(autoSaveService.getStatus().isDirty).toBe(true);
      expect(autoSaveService.getStatus().isSaving).toBe(false);

      consoleError.mockRestore();
    });

    it('handles multiple force saves in succession', async () => {
      saveCallback.mockResolvedValue(undefined);

      // Multiple force saves
      const promises = [
        autoSaveService.forceSave({ ...sampleWorkflowData, save: 1 }),
        autoSaveService.forceSave({ ...sampleWorkflowData, save: 2 }),
        autoSaveService.forceSave({ ...sampleWorkflowData, save: 3 })
      ];

      await Promise.all(promises);

      // All should complete successfully
      expect(saveCallback).toHaveBeenCalledTimes(3);
    });

    it('maintains correct state during concurrent operations', async () => {
      let resolveFirst: () => void;
      let resolveSecond: () => void;

      const firstPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
      const secondPromise = new Promise<void>(resolve => { resolveSecond = resolve; });

      saveCallback
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      // Start auto-save
      autoSaveService.scheduleAutoSave(sampleWorkflowData);
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(true);

      // Start force save concurrently
      const forceSavePromise = autoSaveService.forceSave({ ...sampleWorkflowData, forced: true });

      // Resolve first save
      resolveFirst();
      await vi.runAllTimersAsync();

      expect(autoSaveService.getStatus().isSaving).toBe(true); // Still saving due to force save

      // Resolve second save
      resolveSecond();
      await forceSavePromise;

      expect(autoSaveService.getStatus().isSaving).toBe(false);
      expect(saveCallback).toHaveBeenCalledTimes(2);
    });
  });
});