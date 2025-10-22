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
 */
export function useAutoSave<T>(
  data: () => T,
  options: AutoSaveOptions
) {
  const [isSaving, setIsSaving] = createSignal(false);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  const [error, setError] = createSignal<Error | null>(null);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastDataSnapshot: string | null = null;

  const debounceMs = options.debounceMs ?? 2000; // Default 2 second debounce

  // Watch for data changes and trigger auto-save
  createEffect(
    on(
      data,
      async (newData) => {
        if (!options.enabled) return;

        // Serialize data to detect actual changes
        const newSnapshot = JSON.stringify(newData);

        // Skip if data hasn't actually changed
        if (newSnapshot === lastDataSnapshot) return;

        lastDataSnapshot = newSnapshot;

        // Clear existing timeout
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // Set new debounced save
        saveTimeout = setTimeout(async () => {
          try {
            setIsSaving(true);
            setError(null);

            await options.onSave();

            setLastSaved(new Date());
          } catch (err) {
            console.error('Auto-save failed:', err);
            setError(err instanceof Error ? err : new Error('Auto-save failed'));
          } finally {
            setIsSaving(false);
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

  // Force save immediately (bypasses debounce)
  const forceSave = async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    try {
      setIsSaving(true);
      setError(null);

      await options.onSave();

      setLastSaved(new Date());
      lastDataSnapshot = JSON.stringify(data());
    } catch (err) {
      console.error('Force save failed:', err);
      setError(err instanceof Error ? err : new Error('Save failed'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    lastSaved,
    error,
    forceSave
  };
}
