import { Settings as SettingsIcon, Plug, User, Shield, Bell, Palette, Database, Menu } from 'lucide-solid';
import { useNavigate } from '@solidjs/router';
import { usePageHeader } from '../contexts/HeaderContext';

const SETTINGS_SECTIONS = [
  {
    title: 'Connected Apps',
    description: 'Connect external services and APIs',
    icon: Plug,
    href: '/settings/integrations',
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
    available: false
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

function SettingsCard({ section }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (section.available) {
      navigate(section.href);
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

function Settings() {
  // Set page-specific header
  usePageHeader('Settings', 'Configure dashboard preferences and integrations');
  
  return (
    <div class="max-w-4xl mx-auto p-6">
      <div class="grid gap-6 md:grid-cols-2">
        {SETTINGS_SECTIONS.map(section => (
          <SettingsCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

export default Settings;