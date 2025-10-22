import { createSignal, onMount, onCleanup, Accessor } from 'solid-js';

export interface FloatingPanelResizeOptions {
  isPinned: Accessor<boolean>;
  panelWidth: Accessor<number>;
  onPositionChange?: (x: number, y: number) => void;
  pinSide?: 'left' | 'right'; // Which side the panel pins to (default: 'right')
}

export function useFloatingPanelResize(options: FloatingPanelResizeOptions) {
  const { isPinned, panelWidth, onPositionChange, pinSide = 'right' } = options;

  // Handle window resize to keep pinned panel at the correct edge
  const handleResize = () => {
    if (isPinned()) {
      const newPosition = pinSide === 'right'
        ? { x: window.innerWidth - panelWidth(), y: 0 }
        : { x: 0, y: 0 }; // Left side stays at 0

      onPositionChange?.(newPosition.x, newPosition.y);
      return newPosition;
    }
    return null;
  };

  // Setup resize listener on mount
  onMount(() => {
    window.addEventListener('resize', handleResize);
  });

  // Cleanup on unmount
  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
  });

  return { handleResize };
}
