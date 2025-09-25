import { createSignal, createContext, useContext, JSX } from 'solid-js';

interface OverlayContextValue {
  overlays: () => Array<{
    id: string;
    component: () => JSX.Element;
    title: string;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  }>;
  openOverlay: (overlay: {
    id: string;
    component: () => JSX.Element;
    title: string;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  }) => void;
  closeOverlay: (id: string) => void;
  closeAllOverlays: () => void;
}

const OverlayContext = createContext<OverlayContextValue>();

export function OverlayProvider(props: { children: JSX.Element }) {
  const [overlays, setOverlays] = createSignal<Array<{
    id: string;
    component: () => JSX.Element;
    title: string;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  }>>([]);

  const openOverlay = (overlay: {
    id: string;
    component: () => JSX.Element;
    title: string;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
  }) => {
    // Close existing overlay with same ID if it exists
    setOverlays(prev => prev.filter(o => o.id !== overlay.id));
    // Add new overlay
    setOverlays(prev => [...prev, overlay]);
  };

  const closeOverlay = (id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  };

  const closeAllOverlays = () => {
    setOverlays([]);
  };

  const value: OverlayContextValue = {
    overlays,
    openOverlay,
    closeOverlay,
    closeAllOverlays
  };

  return (
    <OverlayContext.Provider value={value}>
      {props.children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider');
  }
  return context;
}