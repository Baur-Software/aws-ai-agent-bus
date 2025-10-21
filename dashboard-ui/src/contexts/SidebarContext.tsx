import { createContext, useContext, createSignal, createEffect, JSX } from 'solid-js';
import { useDashboardServer } from './DashboardServerContext';
import {
  Home,
  BarChart3,
  Calendar,
  Database,
  Archive,
  PlayCircle,
  Radio,
  Settings,
  Wand2
} from 'lucide-solid';

export interface SidebarItem {
  id: string;
  icon: any;
  label: string;
  href: string;
  requiresIntegration?: string; // e.g., 'google-analytics'
  requiresInfrastructure?: 'kv' | 's3' | 'events' | 'workflows';
  alwaysVisible?: boolean;
}

export interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

export interface SidebarPreferences {
  hiddenItems: string[];
  sectionOrder: string[];
  customItems?: SidebarItem[];
}

export interface SidebarContextValue {
  sections: () => SidebarSection[];
  allSections: () => SidebarSection[]; // Unfiltered sections for settings page
  preferences: () => SidebarPreferences;
  connectedIntegrations: () => Set<string>;
  availableInfrastructure: () => Set<string>;
  updatePreferences: (newPrefs: Partial<SidebarPreferences>) => Promise<void>;
  hideItem: (itemId: string) => Promise<void>;
  showItem: (itemId: string) => Promise<void>;
  isItemVisible: (item: SidebarItem) => boolean;
}

const SidebarContext = createContext<SidebarContextValue>();

// Default sidebar configuration
const defaultSections: SidebarSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    items: [
      { id: 'overview', icon: Home, label: 'Overview', href: '/dashboard', alwaysVisible: true },
      { id: 'analytics', icon: BarChart3, label: 'Analytics', href: '/analytics', requiresIntegration: 'google-analytics' }
    ]
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      { id: 'kv-store', icon: Database, label: 'KV Store', href: '/kv-store', requiresInfrastructure: 'kv' },
      { id: 'artifacts', icon: Archive, label: 'Artifacts & S3', href: '/artifacts', requiresInfrastructure: 's3' },
      { id: 'workflows', icon: PlayCircle, label: 'Workflows', href: '/workflows', requiresInfrastructure: 'workflows' },
      { id: 'events', icon: Radio, label: 'Events', href: '/events', requiresInfrastructure: 'events' },
      { id: 'node-designer', icon: Wand2, label: 'Node Designer', href: '/node-designer' }
    ]
  },
  {
    id: 'system',
    title: 'System',
    items: [
      { id: 'settings', icon: Settings, label: 'Settings', href: '/settings', alwaysVisible: true }
    ]
  }
];

const defaultPreferences: SidebarPreferences = {
  hiddenItems: [],
  sectionOrder: ['dashboard', 'tools', 'system']
};

interface SidebarProviderProps {
  children: JSX.Element;
}

export function SidebarProvider(props: SidebarProviderProps) {
  const { kvStore, isConnected } = useDashboardServer();
  const [preferences, setPreferences] = createSignal<SidebarPreferences>(defaultPreferences);
  const [connectedIntegrations, setConnectedIntegrations] = createSignal<Set<string>>(new Set());
  const [availableInfrastructure, setAvailableInfrastructure] = createSignal<Set<string>>(new Set());

  // Load preferences from KV store
  const loadPreferences = async () => {
    if (!isConnected()) return;

    try {
      const result = await kvStore.get('user-sidebar-preferences');
      if (result?.value) {
        const saved = JSON.parse(result.value);

        // Clean up: remove any alwaysVisible items from hiddenItems
        const allAlwaysVisibleIds = defaultSections
          .flatMap(section => section.items)
          .filter(item => item.alwaysVisible)
          .map(item => item.id);

        const cleanedHiddenItems = (saved.hiddenItems || []).filter(
          (id: string) => !allAlwaysVisibleIds.includes(id)
        );

        const cleanedPrefs = {
          ...defaultPreferences,
          ...saved,
          hiddenItems: cleanedHiddenItems
        };

        setPreferences(cleanedPrefs);

        // If we cleaned anything, save the cleaned preferences
        if (cleanedHiddenItems.length !== (saved.hiddenItems || []).length) {
          console.log('Cleaned alwaysVisible items from hiddenItems:', {
            before: saved.hiddenItems,
            after: cleanedHiddenItems
          });
          await kvStore.set('user-sidebar-preferences', JSON.stringify(cleanedPrefs), 24 * 7);
        }
      }
    } catch (error) {
      console.warn('Failed to load sidebar preferences:', error);
    }
  };

  // Save preferences to KV store
  const savePreferences = async (newPrefs: SidebarPreferences) => {
    if (!isConnected()) {
      console.warn('Cannot save preferences: not connected to server');
      return;
    }

    try {
      console.log('Saving sidebar preferences:', newPrefs);
      // Update local state immediately for instant UI feedback
      setPreferences(newPrefs);

      // Then persist to KV store
      await kvStore.set('user-sidebar-preferences', JSON.stringify(newPrefs), 24 * 7); // 1 week TTL
      console.log('Sidebar preferences saved successfully');
    } catch (error) {
      console.error('Failed to save sidebar preferences:', error);
      // Could revert local state here if save fails, but for now just log
    }
  };

  // Load connected integrations
  const loadConnectedIntegrations = async () => {
    if (!isConnected()) return;

    try {
      // Check for integration configuration keys
      const integrationTypes = ['google-analytics', 'slack', 'github', 'stripe', 'hubspot'];
      const connected = new Set<string>();

      for (const type of integrationTypes) {
        try {
          // Check for app configuration
          const appConfig = await kvStore.get(`integration-${type}`);
          if (appConfig?.value) {
            // Check for at least one user connection
            const userConnection = await kvStore.get(`user-demo-user-123-integration-${type}-default`);
            if (userConnection?.value) {
              connected.add(type);
            }
          }
        } catch (error) {
          // Continue checking other integrations
        }
      }

      setConnectedIntegrations(connected);
    } catch (error) {
      console.warn('Failed to load connected integrations:', error);
    }
  };

  // Check available infrastructure
  const checkInfrastructure = async () => {
    if (!isConnected()) return;

    const available = new Set<string>();

    try {
      // Test KV store
      await kvStore.get('test-infrastructure');
      available.add('kv');
    } catch (error) {
      console.warn('KV store not available');
    }

    // Note: We could add more infrastructure checks here
    // For now, we'll assume other infrastructure is available if KV works
    if (available.has('kv')) {
      available.add('s3');
      available.add('events');
      available.add('workflows');
    }

    setAvailableInfrastructure(available);
  };

  // Load data when connected
  createEffect(() => {
    if (isConnected()) {
      loadPreferences();
      loadConnectedIntegrations();
      checkInfrastructure();
    }
  });

  // Check if an item should be visible
  const isItemVisible = (item: SidebarItem): boolean => {
    // Always show items marked as alwaysVisible (cannot be hidden by user)
    if (item.alwaysVisible) return true;

    // Hide if user explicitly hid it (only applies to non-alwaysVisible items)
    if (preferences().hiddenItems.includes(item.id)) return false;

    // Check integration requirement
    if (item.requiresIntegration) {
      if (!connectedIntegrations().has(item.requiresIntegration)) return false;
    }

    // Check infrastructure requirement
    if (item.requiresInfrastructure) {
      if (!availableInfrastructure().has(item.requiresInfrastructure)) return false;
    }

    return true;
  };

  // Return all sections without filtering (for settings page)
  const allSections = () => {
    return defaultSections;
  };

  // Filter sections to only show visible items (for sidebar)
  const sections = () => {
    return defaultSections
      .map(section => ({
        ...section,
        items: section.items.filter(isItemVisible)
      }))
      .filter(section => section.items.length > 0); // Remove empty sections
  };

  const updatePreferences = async (newPrefs: Partial<SidebarPreferences>) => {
    const updated = { ...preferences(), ...newPrefs };
    await savePreferences(updated);
  };

  const hideItem = async (itemId: string) => {
    console.log('Hiding sidebar item:', itemId);
    const currentPrefs = preferences();
    const hiddenItems = [...currentPrefs.hiddenItems, itemId];
    const updated = { ...currentPrefs, hiddenItems };
    await savePreferences(updated);
  };

  const showItem = async (itemId: string) => {
    console.log('Showing sidebar item:', itemId);
    const currentPrefs = preferences();
    const hiddenItems = currentPrefs.hiddenItems.filter(id => id !== itemId);
    const updated = { ...currentPrefs, hiddenItems };
    await savePreferences(updated);
  };

  const contextValue: SidebarContextValue = {
    sections,
    allSections,
    preferences,
    connectedIntegrations,
    availableInfrastructure,
    updatePreferences,
    hideItem,
    showItem,
    isItemVisible
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {props.children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}