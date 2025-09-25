import { createSignal, createEffect } from 'solid-js';

export interface FloatingPanelOptions {
  initialPosition?: { x: number; y: number };
  initialPinned?: boolean;
  initialVisible?: boolean;
  onPositionChange?: (x: number, y: number) => void;
  onPinnedChange?: (isPinned: boolean) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
  // Constraints
  minWidth?: number;
  maxConstraints?: {
    navigationWidth?: number;
    accountForNavigation?: boolean;
  };
}

export interface FloatingPanelState {
  position: () => { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
  isPinned: () => boolean;
  setIsPinned: (pinned: boolean) => void;
  isVisible: () => boolean;
  setIsVisible: (visible: boolean) => void;
  isDragging: () => boolean;
  setIsDragging: (dragging: boolean) => void;
}

export interface FloatingPanelHandlers {
  handleMouseDown: (e: MouseEvent) => void;
  handlePin: (e: MouseEvent) => void;
  handleHide: () => void;
  handleShow: () => void;
}

export function useFloatingPanel(options: FloatingPanelOptions = {}): [FloatingPanelState, FloatingPanelHandlers] {
  // Default position calculation
  const getDefaultPosition = () => {
    const navWidth = options.maxConstraints?.navigationWidth || 0;
    const accountForNav = options.maxConstraints?.accountForNavigation ?? false;
    const baseX = accountForNav ? navWidth + 20 : 20;

    return options.initialPosition || {
      x: baseX,
      y: 20
    };
  };

  // State signals
  const [position, setPosition] = createSignal(getDefaultPosition());
  const [isPinned, setIsPinned] = createSignal(options.initialPinned ?? false);
  const [isVisible, setIsVisible] = createSignal(options.initialVisible ?? true);
  const [isDragging, setIsDragging] = createSignal(false);

  // Drag state
  let dragStart = { x: 0, y: 0, panelX: 0, panelY: 0 };

  // Notify parent components of changes
  createEffect(() => {
    const pos = position();
    options.onPositionChange?.(pos.x, pos.y);
  });

  createEffect(() => {
    options.onPinnedChange?.(isPinned());
  });

  createEffect(() => {
    options.onVisibilityChange?.(isVisible());
  });

  // Drag handling
  const handleMouseDown = (e: MouseEvent) => {
    // Don't start drag if clicking on buttons or not on drag handle
    if (!(e.target as Element).closest('[data-drag-handle]') ||
        (e.target as Element).closest('button') ||
        isPinned()) {
      return;
    }

    e.preventDefault(); // Prevent text selection during drag
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

      // Calculate constraints
      const navWidth = options.maxConstraints?.navigationWidth || 0;
      const accountForNav = options.maxConstraints?.accountForNavigation ?? false;
      const minX = accountForNav ? navWidth : 0;
      const panelWidth = options.minWidth || 300;
      const maxX = window.innerWidth - panelWidth;
      const maxY = window.innerHeight - 100; // Leave some bottom margin

      const clampedPos = {
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      };

      setPosition(clampedPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Pin/unpin handling
  const handlePin = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const willBePinned = !isPinned();
    setIsPinned(willBePinned);

    // You can customize pinning behavior per component by passing different position logic
    if (willBePinned) {
      // Default pinning behavior - move to a standard position
      const newPosition = { x: 0, y: 0 };
      setPosition(newPosition);
    } else {
      // Default unpinning behavior - move to floating position
      const newPosition = getDefaultPosition();
      setPosition(newPosition);
    }
  };

  // Visibility handling
  const handleHide = () => {
    setIsVisible(false);
  };

  const handleShow = () => {
    setIsVisible(true);
  };

  const state: FloatingPanelState = {
    position,
    setPosition,
    isPinned,
    setIsPinned,
    isVisible,
    setIsVisible,
    isDragging,
    setIsDragging
  };

  const handlers: FloatingPanelHandlers = {
    handleMouseDown,
    handlePin,
    handleHide,
    handleShow
  };

  return [state, handlers];
}