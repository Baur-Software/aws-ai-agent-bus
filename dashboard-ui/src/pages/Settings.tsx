import { Settings as SettingsIcon, Plug, User, Shield, Bell, Palette, Database, Menu, ArrowLeft, Box } from 'lucide-solid';
import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import { usePageHeader } from '../contexts/HeaderContext';
import SidebarSettings from '../components/SidebarSettings';
import NotificationSettings from '../components/NotificationSettings';
import NodeManagementSettings from '../components/organization/settings/NodeManagementSettings';

const SETTINGS_SECTIONS = [
  {
    title: 'Workflow Nodes',
    description: 'Manage available workflow nodes and create custom ones',
    icon: Box,
    href: '/settings/nodes',
    available: true
  },
  {
    title: 'Profile',
    description: 'Manage your account settings',
    icon: User,
    href: '/settings/profile',
    available: false
  },
  {
    title: 'Security',
    description: 'Authentication and access control',
    icon: Shield,
    href: '/settings/security',
    available: false
  },
  {
    title: 'Notifications',
    description: 'Configure alerts and notifications',
    icon: Bell,
    href: '/settings/notifications',
    available: true
  },
  {
    title: 'Appearance',
    description: 'Customize UI theme and layout',
    icon: Palette,
    href: '/settings/appearance',
    available: false
  },
  {
    title: 'Sidebar',
    description: 'Customize navigation menu visibility',
    icon: Menu,
    href: '/settings/sidebar',
    available: true
  },
  {
    title: 'Data & Storage',
    description: 'Manage data retention and backups',
    icon: Database,
    href: '/settings/data',
    available: false
  }
];

function SettingsCard({ section, onNavigate }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (section.available) {
      // Check if we have an onNavigate prop (overlay mode) or use regular navigation
      if (onNavigate) {
        onNavigate(section.href);
      } else {
        navigate(section.href);
      }
    }
  };

  return (
    <div 
      class={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 transition-all ${
        section.available 
          ? 'hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md cursor-pointer' 
          : 'opacity-60 cursor-not-allowed'
      }`}
      onClick={handleClick}
    >
      <div class="flex items-start gap-4">
        <div class={`p-3 rounded-lg ${section.available ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-600'} text-white`}>
          <section.icon class="w-6 h-6" />
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h3>
            {!section.available && (
              <span class="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                Coming Soon
              </span>
            )}
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400">{section.description}</p>
        </div>
      </div>
    </div>
  );
}

interface SettingsProps {
  isOverlay?: boolean;
}

function Settings({ isOverlay = false }: SettingsProps) {
  const [currentView, setCurrentView] = createSignal('main');

  // Set page-specific header (only when not in overlay)
  if (!isOverlay) {
    usePageHeader('Settings', 'Configure dashboard preferences and integrations');
  }

  const handleNavigate = (href: string) => {
    setCurrentView(href);
  };

  const handleBack = () => {
    setCurrentView('main');
  };

  const getPageInfo = (view: string) => {
    switch (view) {
      case '/settings/nodes':
        return { title: 'Workflow Nodes', description: 'Manage available workflow nodes and create custom ones' };
      case '/settings/sidebar':
        return { title: 'Sidebar Settings', description: 'Customize navigation menu visibility' };
      case '/settings/notifications':
        return { title: 'Notifications', description: 'Configure alerts and notifications' };
      default:
        return { title: 'Settings', description: 'Configure dashboard preferences and integrations' };
    }
  };

  const renderContent = () => {
    switch (currentView()) {
      case '/settings/nodes':
        return <NodeManagementSettings />;
      case '/settings/sidebar':
        return <SidebarSettings isOverlay={isOverlay} />;
      case '/settings/notifications':
        return <NotificationSettings />;
      default:
        return (
          <div class="grid gap-6 md:grid-cols-2">
            {SETTINGS_SECTIONS.map(section => (
              <SettingsCard
                key={section.title}
                section={section}
                onNavigate={isOverlay ? handleNavigate : undefined}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div class={`${isOverlay ? 'h-full flex flex-col' : 'max-w-4xl mx-auto'} p-6`}>
      {/* Header for overlay mode */}
      <Show when={isOverlay}>
        <div class="flex-shrink-0 mb-6">
          <div class="flex items-center gap-3 mb-2">
            {/* Back button in header */}
            <Show when={currentView() !== 'main'}>
              <button
                onClick={handleBack}
                class="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft class="w-4 h-4" />
                <span>Back</span>
              </button>
            </Show>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
              {getPageInfo(currentView()).title}
            </h1>
          </div>
        </div>
      </Show>

      {/* Content */}
      <div class={isOverlay ? 'flex-1 overflow-auto' : ''}>
        {renderContent()}
      </div>
    </div>
  );
}

export default Settings;