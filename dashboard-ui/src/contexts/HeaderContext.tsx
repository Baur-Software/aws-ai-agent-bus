import { createContext, useContext, createSignal } from 'solid-js';

interface HeaderInfo {
  title: string;
  tagline: string;
}

interface HeaderContextType {
  headerInfo: () => HeaderInfo;
  setHeaderInfo: (info: HeaderInfo) => void;
}

const HeaderContext = createContext<HeaderContextType>();

interface HeaderProviderProps {
  children: any;
}

export function HeaderProvider(props: HeaderProviderProps) {
  const [headerInfo, setHeaderInfo] = createSignal<HeaderInfo>({
    title: 'AWS AI Agent Bus',
    tagline: 'Model Context Protocol Dashboard'
  });

  const value: HeaderContextType = {
    headerInfo,
    setHeaderInfo
  };

  return (
    <HeaderContext.Provider value={value}>
      {props.children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}

// Helper hook to set page header info with cleanup
export function usePageHeader(title: string, tagline: string) {
  const { setHeaderInfo } = useHeader();
  
  // Set header info when component mounts
  setHeaderInfo({ title, tagline });
  return { title, tagline };
  
  // Optional: You could add cleanup to reset to default when component unmounts
  // This would be useful if you want to reset to default when navigating away
}