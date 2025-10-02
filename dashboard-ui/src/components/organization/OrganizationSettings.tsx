import { createSignal, Show, For } from 'solid-js';
import { usePageHeader } from '../../contexts/HeaderContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useNotifications } from '../../contexts/NotificationContext';
import GeneralSettings from './settings/GeneralSettings';
import MemberManagement from './settings/MemberManagement';
import SecuritySettings from './settings/SecuritySettings';
import BillingSettings from './settings/BillingSettings';
import { Settings, Users, Shield, CreditCard, AlertTriangle } from 'lucide-solid';

type SettingsTab = 'general' | 'members' | 'security' | 'billing';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: any;
  description: string;
  requiresPermission?: string;
}

export default function OrganizationSettings() {
  const { currentOrganization, canManageOrganization, canManageMembers } = useOrganization();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = createSignal<SettingsTab>('general');

  usePageHeader('Organization Settings', 'Manage your organization settings, members, and security');

  const tabs: TabConfig[] = [
    {
      id: 'general',
      label: 'General',
      icon: Settings,
      description: 'Organization profile and basic settings'
    },
    {
      id: 'members',
      label: 'Members',
      icon: Users,
      description: 'Manage organization members and permissions',
      requiresPermission: 'members'
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      description: 'Security settings and authentication policies',
      requiresPermission: 'admin'
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: CreditCard,
      description: 'Billing information and subscription management',
      requiresPermission: 'admin'
    }
  ];

  const visibleTabs = () => tabs.filter(tab => {
    if (!tab.requiresPermission) return true;

    switch (tab.requiresPermission) {
      case 'members':
        return canManageMembers();
      case 'admin':
        return canManageOrganization();
      case 'owner':
        return currentOrganization()?.userRole === 'owner';
      default:
        return true;
    }
  });

  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId);
  };

  const renderActiveTab = () => {
    switch (activeTab()) {
      case 'general':
        return <GeneralSettings />;
      case 'members':
        return canManageMembers() ? <MemberManagement /> : <AccessDenied />;
      case 'security':
        return canManageOrganization() ? <SecuritySettings /> : <AccessDenied />;
      case 'billing':
        return canManageOrganization() ? <BillingSettings /> : <AccessDenied />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div class="max-w-6xl mx-auto p-6">
      <Show when={!currentOrganization()}>
        <div class="text-center py-12">
          <AlertTriangle class="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No Organization Selected
          </h3>
          <p class="text-slate-600 dark:text-slate-400">
            Please select an organization to manage its settings.
          </p>
        </div>
      </Show>

      <Show when={currentOrganization()}>
        <div class="mb-8">
          {/* Organization Header */}
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span class="text-white font-bold text-xl">
                {currentOrganization()?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
                {currentOrganization()?.name}
              </h1>
              <p class="text-slate-600 dark:text-slate-400">
                {currentOrganization()?.description || 'No description provided'}
              </p>
              <div class="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <span>{currentOrganization()?.memberCount} members</span>
                <span>•</span>
                <span class="capitalize">{currentOrganization()?.userRole}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div class="border-b border-slate-200 dark:border-slate-700">
            <nav class="flex space-x-8" aria-label="Tabs">
              <For each={visibleTabs()}>
                {(tab) => {
                  const isActive = () => activeTab() === tab.id;
                  const Icon = tab.icon;

                  return (
                    <button
                      onClick={() => handleTabChange(tab.id)}
                      class={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        isActive()
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                      }`}
                    >
                      <Icon class={`w-5 h-5 mr-2 ${
                        isActive()
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-500'
                      }`} />
                      {tab.label}
                    </button>
                  );
                }}
              </For>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          {renderActiveTab()}
        </div>
      </Show>
    </div>
  );
}

function AccessDenied() {
  return (
    <div class="p-8 text-center">
      <Shield class="w-12 h-12 mx-auto mb-4 text-slate-400" />
      <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
        Access Denied
      </h3>
      <p class="text-slate-600 dark:text-slate-400">
        You don't have permission to access this section.
      </p>
    </div>
  );
}