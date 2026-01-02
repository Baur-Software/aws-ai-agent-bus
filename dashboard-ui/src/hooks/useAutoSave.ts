import { createEffect, createSignal, on, onCleanup } from 'solid-js';

export interface AutoSaveOptions {
  enabled: boolean;
  debounceMs?: number;
  onSave: () => Promise<void> | void;
}

export interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
}

/**
 * Auto-save hook with debounced real-time persistence
 * Watches for changes and automatically saves after debounce period
 *
 * Race condition protections:
 * - lastSavedSnapshot only updates after successful save
 * - forceSave preserves and saves pending debounced changes
 * - Concurrent save operations are serialized via saveInProgress flag
 */
export function useAutoSave<T>(
  data: () => T,
  options: AutoSaveOptions
) {
  const [isSaving, setIsSaving] = createSignal(false);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [error, setError] = createSignal<Error | null>(null);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  // Snapshot of data that was last SUCCESSFULLY saved
  let lastSavedSnapshot: string | null = null;
  // Snapshot of data that is pending save (scheduled but not yet executed)
  let pendingSnapshot: string | null = null;
  // Flag to prevent concurrent save operations
  let saveInProgress = false;

  const debounceMs = options.debounceMs ?? 2000; // Default 2 second debounce

  /**
   * Core save logic - updates snapshot only on success
   */
  const executeSave = async (snapshotToSave: string): Promise<boolean> => {
    if (saveInProgress) {
      return false;
    }

    saveInProgress = true;
    try {
      setIsSaving(true);
      setError(null);

      await options.onSave();

      // Only update lastSavedSnapshot after successful save
      lastSavedSnapshot = snapshotToSave;
      setLastSaved(new Date());
      return true;
    } catch (err) {
      console.error('Auto-save failed:', err);
      setError(err instanceof Error ? err : new Error('Auto-save failed'));
      return false;
    } finally {
      saveInProgress = false;
      setIsSaving(false);
    }
  };

  // Watch for data changes and trigger auto-save
  createEffect(
    on(
      data,
      (newData) => {
        if (!options.enabled) return;

        // Serialize data to detect actual changes
        const newSnapshot = JSON.stringify(newData);

        // Skip if data hasn't changed from last successful save
        if (newSnapshot === lastSavedSnapshot) {
          // Clear any pending save since we're back to saved state
          if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
            pendingSnapshot = null;
          }
          return;
        }

        // Track what we're about to save
        pendingSnapshot = newSnapshot;

        // Clear existing timeout
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // Set new debounced save
        saveTimeout = setTimeout(async () => {
          const snapshotToSave = pendingSnapshot;
          saveTimeout = null;
          pendingSnapshot = null;

          if (snapshotToSave) {
            await executeSave(snapshotToSave);
          }
        }, debounceMs);
      },
      { defer: true } // Don't trigger on mount
    )
  );

  // Cleanup on unmount
  onCleanup(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  });

  /**
   * Force save immediately (bypasses debounce)
   * Preserves any pending debounced changes by saving current data state
   */
  const forceSave = async () => {
    // Clear pending debounce - we'll save the current state which includes any pending changes
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    // Get current data snapshot (includes any pending changes)
    const currentSnapshot = JSON.stringify(data());
    pendingSnapshot = null;

    // Skip if nothing has changed since last successful save
    if (currentSnapshot === lastSavedSnapshot) {
      return;
    }

    // Wait for any in-progress save to complete before starting force save
    if (saveInProgress) {
      // Poll until save completes (with reasonable timeout)
      const maxWait = 10000; // 10 seconds
      const pollInterval = 50; // 50ms
      let waited = 0;
      while (saveInProgress && waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        waited += pollInterval;
      }

      // After waiting, check if data still needs saving
      const updatedSnapshot = JSON.stringify(data());
      if (updatedSnapshot === lastSavedSnapshot) {
        return; // Previous save already saved our data
      }
    }

    const success = await executeSave(currentSnapshot);
    if (!success) {
      throw error() || new Error('Save failed');
    }
  };

  /**
   * Check if there are unsaved changes
   */
  const hasUnsavedChanges = () => {
    const currentSnapshot = JSON.stringify(data());
    return currentSnapshot !== lastSavedSnapshot;
  };

  return {
    isSaving,
    lastSaved,
    error,
    forceSave,
    hasUnsavedChanges
  };
}
