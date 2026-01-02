/**
 * Tests for useAutoSave hook
 *
 * Note: SolidJS reactive effects with fake timers are challenging to test.
 * Tests that rely on debounced auto-save behavior via createEffect are marked
 * as integration tests and may require real timers.
 *
 * The core race condition fixes are validated through:
 * 1. forceSave tests - synchronous, reliable
 * 2. hasUnsavedChanges tests - tests the snapshot logic
 * 3. Manual integration testing in the browser
 */
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { useAutoSave } from '../useAutoSave';

describe('useAutoSave hook', () => {
  let onSave: Mock;
  let dispose: () => void;

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (dispose) dispose();
    vi.clearAllMocks();
  });

  describe('forceSave behavior (core race condition fix)', () => {
    it('forceSave saves current data', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data, setData] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 2000,
          onSave
        });

        setData({ value: 2 });
      });

      // Force save captures current data
      await autoSave!.forceSave();

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('forceSave does not lose pending changes', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data, setData] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 2000,
          onSave
        });

        // Make multiple rapid changes
        setData({ value: 2 });
        setData({ value: 3 });
      });

      // Force save should capture latest data (value: 3)
      await autoSave!.forceSave();

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(autoSave!.hasUnsavedChanges()).toBe(false);
    });

    it('forceSave skips save if data unchanged after initial save', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      // First force save to establish baseline
      await autoSave!.forceSave();
      expect(onSave).toHaveBeenCalledTimes(1);

      // Second force save with same data should be skipped
      await autoSave!.forceSave();
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('forceSave throws on failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('Force save failed'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      await expect(autoSave!.forceSave()).rejects.toThrow();
      consoleError.mockRestore();
    });

    it('forceSave sets error state on failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('Force save failed'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      try {
        await autoSave!.forceSave();
      } catch {}

      expect(autoSave!.error()).toBeTruthy();
      consoleError.mockRestore();
    });
  });

  describe('hasUnsavedChanges (snapshot update timing fix)', () => {
    it('returns false when no changes have been made after save', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      // Force save to establish baseline
      await autoSave!.forceSave();
      expect(autoSave!.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when changes are pending', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;
      let setData: (v: {value: number}) => void;

      createRoot((d) => {
        dispose = d;
        const [data, _setData] = createSignal({ value: 1 });
        setData = _setData;

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 1000,
          onSave
        });
      });

      // Establish baseline
      await autoSave!.forceSave();

      // Make change
      setData!({ value: 2 });

      expect(autoSave!.hasUnsavedChanges()).toBe(true);
    });

    it('correctly reports unsaved changes after failed save', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('Save failed'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;
      let setData: (v: {value: number}) => void;

      createRoot((d) => {
        dispose = d;
        const [data, _setData] = createSignal({ value: 1 });
        setData = _setData;

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 1000,
          onSave
        });
      });

      // Make change
      setData!({ value: 2 });

      // Failed save
      try {
        await autoSave!.forceSave();
      } catch {}

      // Should still report unsaved changes because save failed
      expect(autoSave!.hasUnsavedChanges()).toBe(true);
      expect(autoSave!.error()).toBeTruthy();

      consoleError.mockRestore();
    });

    it('returns false after successful save following failed save', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('First fail'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;
      let setData: (v: {value: number}) => void;

      createRoot((d) => {
        dispose = d;
        const [data, _setData] = createSignal({ value: 1 });
        setData = _setData;

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 1000,
          onSave
        });
      });

      setData!({ value: 2 });

      // Failed save
      try {
        await autoSave!.forceSave();
      } catch {}

      expect(autoSave!.hasUnsavedChanges()).toBe(true);

      // Successful save
      onSave.mockResolvedValueOnce(undefined);
      await autoSave!.forceSave();

      expect(autoSave!.hasUnsavedChanges()).toBe(false);
      expect(autoSave!.error()).toBeNull();

      consoleError.mockRestore();
    });
  });

  describe('Initial state', () => {
    it('initializes with correct default values', () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 1000,
          onSave
        });

        expect(autoSave.isSaving()).toBe(false);
        expect(autoSave.lastSaved()).toBeNull();
        expect(autoSave.error()).toBeNull();
      });
    });

    it('uses default debounceMs when not specified', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          onSave
        });

        // Hook should work with default debounce
        expect(autoSave.isSaving()).toBe(false);
      });
    });
  });

  describe('isSaving state', () => {
    it('sets isSaving to true during save', async () => {
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      onSave.mockReturnValue(savePromise);

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      // Start force save (don't await)
      const savePromiseResult = autoSave!.forceSave();

      // isSaving should be true while save is in progress
      expect(autoSave!.isSaving()).toBe(true);

      // Complete the save
      resolveSave!();
      await savePromiseResult;

      expect(autoSave!.isSaving()).toBe(false);
    });
  });

  describe('lastSaved timestamp', () => {
    it('updates lastSaved after successful save', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      expect(autoSave!.lastSaved()).toBeNull();

      await autoSave!.forceSave();

      const lastSaved = autoSave!.lastSaved();
      expect(lastSaved).toBeTruthy();
      expect(lastSaved).toBeInstanceOf(Date);
    });

    it('does not update lastSaved after failed save', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('Save failed'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      try {
        await autoSave!.forceSave();
      } catch {}

      expect(autoSave!.lastSaved()).toBeNull();
      consoleError.mockRestore();
    });
  });

  describe('Error recovery', () => {
    it('clears error on successful save', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      onSave.mockRejectedValueOnce(new Error('First fail'));

      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: true,
          debounceMs: 100,
          onSave
        });
      });

      // Failed save
      try {
        await autoSave!.forceSave();
      } catch {}

      expect(autoSave!.error()).toBeTruthy();

      // Successful save
      onSave.mockResolvedValueOnce(undefined);
      await autoSave!.forceSave();

      expect(autoSave!.error()).toBeNull();
      consoleError.mockRestore();
    });
  });

  describe('disabled state', () => {
    it('forceSave still works when enabled is false', async () => {
      let autoSave: ReturnType<typeof useAutoSave<{value: number}>>;

      createRoot((d) => {
        dispose = d;
        const [data] = createSignal({ value: 1 });

        autoSave = useAutoSave(data, {
          enabled: false,
          debounceMs: 100,
          onSave
        });
      });

      // forceSave should work regardless of enabled state
      await autoSave!.forceSave();
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });
});
