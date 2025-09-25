import { createSignal, createEffect, onCleanup } from 'solid-js';

export interface FloatingPanelConfig {
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
  constraints?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
}

export function useFloatingPanel(config: FloatingPanelConfig = {}) {
  const [position, setPosition] = createSignal(
    config.initialPosition || { x: 100, y: 100 }
  );
  const [isPinned, setIsPinned] = createSignal(config.initialPinned ?? false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);

  // Drag state
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  const handleMouseDown = (e: MouseEvent) => {
    if (!(e.target as Element).closest('[data-drag-handle]') || isPinned()) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    const pos = position();
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      panelX: pos.x,
      panelY: pos.y
    };

    const handleMouseMove = (e: MouseEvent) => {
      const newX = dragStart.panelX + (e.clientX - dragStart.x);
      const newY = dragStart.panelY + (e.clientY - dragStart.y);

      // Apply constraints
      const constraints = config.constraints || {};
      const clampedPos = {
        x: Math.max(
          constraints.minX ?? 0,
          Math.min(constraints.maxX ?? window.innerWidth - 300, newX)
        ),
        y: Math.max(
          constraints.minY ?? 0,
          Math.min(constraints.maxY ?? window.innerHeight - 100, newY)
        )
      };

      setPosition(clampedPos);
      config.onPositionChange?.(clampedPos.x, clampedPos.y);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const togglePin = () => {
    const willBePinned = !isPinned();
    setIsPinned(willBePinned);
    config.onPinnedChange?.(willBePinned);
  };

  const hide = () => setIsVisible(false);
  const show = () => setIsVisible(true);
  const toggle = () => setIsVisible(!isVisible());

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener('mousemove', () => {});
    document.removeEventListener('mouseup', () => {});
  });

  return {
    // State
    position,
    isPinned,
    isDragging,
    isVisible,

    // Actions
    setPosition,
    togglePin,
    hide,
    show,
    toggle,

    // Event handlers
    handleMouseDown,

    // Computed
    canDrag: () => !isPinned() && isVisible(),

    // CSS classes
    dragClasses: () => isDragging() ? 'dragging shadow-2xl scale-[1.02]' : '',
    pinnedClasses: () => isPinned() ? 'pinned' : 'floating'
  };
}