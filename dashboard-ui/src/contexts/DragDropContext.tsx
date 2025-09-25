import { createContext, useContext, createSignal, createEffect, onCleanup, JSX } from 'solid-js';
import { createStore } from 'solid-js/store';

// Enhanced drag state interface for SolidJS
interface DragState {
  isDragging: boolean;
  dragType: 'node-create' | 'node-move' | 'connection' | 'canvas' | null;
  dragData: any;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  sourceElement: HTMLElement | null;
  targetElement: HTMLElement | null;
  preview?: HTMLElement;
}

interface DragDropContextValue {
  // Drag state
  dragState: DragState;

  // Actions
  startDrag: (type: DragState['dragType'], data: any, sourceElement: HTMLElement, e: MouseEvent | DragEvent) => void;
  updateDrag: (position: { x: number; y: number }, targetElement?: HTMLElement) => void;
  endDrag: (targetElement?: HTMLElement) => boolean; // Returns success
  cancelDrag: () => void;

  // Registration methods for components
  registerDropZone: (element: HTMLElement, onDrop: (data: any, position: { x: number; y: number }) => boolean) => () => void;
  registerDragSource: (element: HTMLElement, dragData: any) => () => void;

  // Canvas-specific methods
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
  setCanvasTransform: (offset: { x: number; y: number }, zoom: number) => void;
}

const DragDropContext = createContext<DragDropContextValue>();

interface Props {
  children: JSX.Element;
}

export function DragDropProvider(props: Props) {
  // Core drag state using createStore for fine-grained reactivity
  const [dragState, setDragState] = createStore<DragState>({
    isDragging: false,
    dragType: null,
    dragData: null,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    sourceElement: null,
    targetElement: null,
    preview: undefined
  });

  // Canvas transform state for coordinate conversion
  const [canvasOffset, setCanvasOffset] = createSignal({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = createSignal(1);
  const [canvasElement, setCanvasElement] = createSignal<HTMLElement | null>(null);

  // Drop zone registry
  const dropZones = new Map<HTMLElement, (data: any, position: { x: number; y: number }) => boolean>();
  const dragSources = new Map<HTMLElement, any>();

  // Coordinate conversion utilities
  const screenToCanvas = (screenX: number, screenY: number) => {
    const canvas = canvasElement();
    if (!canvas) return { x: screenX, y: screenY };

    const rect = canvas.getBoundingClientRect();
    const offset = canvasOffset();
    const zoom = canvasZoom();

    return {
      x: (screenX - rect.left - offset.x) / zoom,
      y: (screenY - rect.top - offset.y) / zoom
    };
  };

  const canvasToScreen = (canvasX: number, canvasY: number) => {
    const canvas = canvasElement();
    if (!canvas) return { x: canvasX, y: canvasY };

    const rect = canvas.getBoundingClientRect();
    const offset = canvasOffset();
    const zoom = canvasZoom();

    return {
      x: canvasX * zoom + offset.x + rect.left,
      y: canvasY * zoom + offset.y + rect.top
    };
  };

  const setCanvasTransform = (offset: { x: number; y: number }, zoom: number) => {
    setCanvasOffset(offset);
    setCanvasZoom(zoom);
  };

  // Drag operations
  const startDrag = (
    type: DragState['dragType'],
    data: any,
    sourceElement: HTMLElement,
    e: MouseEvent | DragEvent
  ) => {
    console.log('🚀 Starting drag:', { type, data, element: sourceElement });

    const position = { x: e.clientX, y: e.clientY };

    setDragState({
      isDragging: true,
      dragType: type,
      dragData: data,
      startPosition: position,
      currentPosition: position,
      sourceElement,
      targetElement: null,
      preview: undefined
    });

    // Create visual preview for node creation
    if (type === 'node-create') {
      createDragPreview(data, position);
    }

    // Prevent default for all drag events
    e.preventDefault?.();
    e.stopPropagation?.();
  };

  const updateDrag = (position: { x: number; y: number }, targetElement?: HTMLElement) => {
    if (!dragState.isDragging) return;

    setDragState('currentPosition', position);

    // Update preview position
    if (dragState.preview) {
      dragState.preview.style.left = `${position.x - 60}px`;
      dragState.preview.style.top = `${position.y - 30}px`;
    }

    // Only store the targetElement if provided, don't do expensive drop zone detection on every mouse move
    if (targetElement) {
      setDragState('targetElement', targetElement);
    }
  };

  const endDrag = (targetElement?: HTMLElement): boolean => {
    if (!dragState.isDragging) return false;

    // Use provided target or find drop zone at current mouse position
    let finalTarget = targetElement;
    if (!finalTarget) {
      finalTarget = findValidDropZone(dragState.currentPosition);
    }

    let success = false;

    console.log('🎯 Ending drag:', {
      type: dragState.dragType,
      data: dragState.dragData,
      target: finalTarget,
      position: dragState.currentPosition
    });

    // Handle drop based on type
    if (finalTarget && dropZones.has(finalTarget)) {
      const onDrop = dropZones.get(finalTarget)!;
      const canvasPos = screenToCanvas(dragState.currentPosition.x, dragState.currentPosition.y);
      console.log('📍 Dropping at canvas position:', canvasPos);
      success = onDrop(dragState.dragData, canvasPos);
    } else {
      console.log('❌ No valid drop zone for final position');
    }

    // Cleanup
    cleanupDrag();

    return success;
  };

  const cancelDrag = () => {
    console.log('❌ Canceling drag');
    cleanupDrag();
  };

  const cleanupDrag = () => {
    // Remove preview
    if (dragState.preview && dragState.preview.parentNode) {
      dragState.preview.parentNode.removeChild(dragState.preview);
    }

    // Reset state
    setDragState({
      isDragging: false,
      dragType: null,
      dragData: null,
      startPosition: { x: 0, y: 0 },
      currentPosition: { x: 0, y: 0 },
      sourceElement: null,
      targetElement: null,
      preview: undefined
    });
  };

  const createDragPreview = (nodeData: any, position: { x: number; y: number }) => {
    const preview = document.createElement('div');
    preview.className = `
      fixed pointer-events-none z-[9999]
      bg-blue-500 text-white text-sm font-medium
      rounded-lg shadow-2xl border-2 border-blue-300
      px-3 py-2 opacity-80 transform -translate-x-1/2 -translate-y-1/2
      transition-transform duration-100
    `;
    preview.textContent = nodeData.name || nodeData;
    preview.style.left = `${position.x - 60}px`;
    preview.style.top = `${position.y - 30}px`;

    document.body.appendChild(preview);
    setDragState('preview', preview);
  };

  const findValidDropZone = (position: { x: number; y: number }): HTMLElement | null => {
    // Temporarily hide the drag preview to get accurate element detection
    const preview = dragState.preview;
    let originalDisplay = '';
    if (preview) {
      originalDisplay = preview.style.display;
      preview.style.display = 'none';
    }

    try {
      // First, try to find any registered drop zone at this position by checking all registered zones
      for (const [registeredElement] of dropZones) {
        if (registeredElement.hasAttribute('data-canvas')) {
          const rect = registeredElement.getBoundingClientRect();
          if (position.x >= rect.left && position.x <= rect.right &&
              position.y >= rect.top && position.y <= rect.bottom) {
            console.log('✅ Found canvas drop zone by position check:', registeredElement);
            return registeredElement;
          }
        }
      }

      // Fallback to element detection at point
      const element = document.elementFromPoint(position.x, position.y) as HTMLElement;

      console.log('🔍 Element at position (fallback):', {
        position,
        element,
        className: element?.className,
        tagName: element?.tagName,
        hasDataCanvas: element?.hasAttribute?.('data-canvas'),
        dropZonesSize: dropZones.size
      });

      if (!element) return null;

      // Check if element or any parent is a registered drop zone
      let current: HTMLElement | null = element;
      let depth = 0;
      while (current && depth < 15) {
        const hasDataCanvas = current.hasAttribute?.('data-canvas');
        const isRegistered = dropZones.has(current);

        if (depth < 5 || hasDataCanvas || isRegistered) {
          console.log(`  Checking parent ${depth}:`, {
            element: current,
            className: current.className,
            tagName: current.tagName,
            hasDataCanvas,
            isRegistered
          });
        }

        if (isRegistered) {
          console.log('✅ Found valid drop zone:', current);
          return current;
        }
        current = current.parentElement;
        depth++;
      }

      console.log('❌ No valid drop zone found after checking', depth, 'parents');
      return null;
    } finally {
      // Restore the drag preview
      if (preview) {
        preview.style.display = originalDisplay;
      }
    }
  };

  // Registration methods
  const registerDropZone = (
    element: HTMLElement,
    onDrop: (data: any, position: { x: number; y: number }) => boolean
  ) => {
    console.log('📍 Registering drop zone:', element);
    dropZones.set(element, onDrop);

    // Auto-detect canvas element
    if (element.hasAttribute('data-canvas')) {
      setCanvasElement(element);
      console.log('🎯 Canvas element registered for coordinate conversion');
    }

    return () => {
      dropZones.delete(element);
      if (canvasElement() === element) {
        setCanvasElement(null);
      }
    };
  };

  const registerDragSource = (element: HTMLElement, dragData: any) => {
    console.log('🎮 Registering drag source:', element, dragData);
    dragSources.set(element, dragData);

    return () => {
      dragSources.delete(element);
    };
  };

  // Global event listeners for mouse tracking
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (dragState.isDragging) {
      updateDrag({ x: e.clientX, y: e.clientY }, e.target as HTMLElement);
    }
  };

  const handleGlobalMouseUp = (e: MouseEvent) => {
    if (dragState.isDragging) {
      // Don't use e.target - always use findValidDropZone to properly detect the canvas
      endDrag();
    }
  };

  const handleGlobalDragOver = (e: DragEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    }
  };

  const handleGlobalDrop = (e: DragEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      endDrag(e.target as HTMLElement);
    }
  };

  // Set up global listeners
  createEffect(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    cleanupDrag();
    dropZones.clear();
    dragSources.clear();
  });

  const contextValue: DragDropContextValue = {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    registerDropZone,
    registerDragSource,
    screenToCanvas,
    canvasToScreen,
    setCanvasTransform
  };

  return (
    <DragDropContext.Provider value={contextValue}>
      {props.children}
    </DragDropContext.Provider>
  );
}

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
}

// Utility hook for drag sources
export function useDragSource(element: () => HTMLElement | undefined, dragData: () => any) {
  const { registerDragSource, startDrag } = useDragDrop();

  createEffect(() => {
    const el = element();
    const data = dragData();

    if (el && data) {
      const unregister = registerDragSource(el, data);

      const handleMouseDown = (e: MouseEvent) => {
        startDrag('node-create', data, el, e);
      };

      const handleDragStart = (e: DragEvent) => {
        e.dataTransfer!.setData('text/plain', typeof data === 'string' ? data : JSON.stringify(data));
        startDrag('node-create', data, el, e);
      };

      el.addEventListener('mousedown', handleMouseDown);
      el.addEventListener('dragstart', handleDragStart);

      onCleanup(() => {
        unregister();
        el.removeEventListener('mousedown', handleMouseDown);
        el.removeEventListener('dragstart', handleDragStart);
      });
    }
  });
}

// Utility hook for drop zones
export function useDropZone(
  element: () => HTMLElement | undefined,
  onDrop: (data: any, position: { x: number; y: number }) => boolean
) {
  const { registerDropZone } = useDragDrop();

  createEffect(() => {
    const el = element();

    if (el) {
      const unregister = registerDropZone(el, onDrop);

      onCleanup(() => {
        unregister();
      });
    }
  });
}