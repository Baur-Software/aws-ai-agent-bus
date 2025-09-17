import { createContext, useContext, createSignal, createEffect, onMount, JSX } from 'solid-js';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: () => boolean;
  isLight: () => boolean;
}

const ThemeContext = createContext<ThemeContextValue>();

interface ThemeProviderProps {
  children: JSX.Element;
}

export function ThemeProvider(props: ThemeProviderProps) {
  const [theme, setTheme] = createSignal<Theme>('light');
  
  // Load theme from localStorage on mount
  onMount(() => {
    const savedTheme = (localStorage.getItem('dashboard-theme') as Theme) || 'light';
    setTheme(savedTheme);
  });

  // Save theme to localStorage and apply to document
  createEffect(() => {
    const currentTheme = theme();
    localStorage.setItem('dashboard-theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.className = `theme-${currentTheme}`;
  });

  const toggleTheme = (): void => {
    setTheme(theme() === 'light' ? 'dark' : 'light');
  };

  const contextValue: ThemeContextValue = {
    theme,
    setTheme,
    toggleTheme,
    isDark: () => theme() === 'dark',
    isLight: () => theme() === 'light'
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}