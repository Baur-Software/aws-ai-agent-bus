import { createSignal, createEffect, Show } from 'solid-js';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { UpdateOrganizationRequest } from '../../../services/OrganizationService';
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Globe, Clock } from 'lucide-solid';

export default function SecuritySettings() {
  const { currentOrganization, updateOrganization, canManageOrganization } = useOrganization();
  const { addNotification } = useNotifications();

  const [isSaving, setIsSaving] = createSignal(false);
  const [settings, setSettings] = createSignal({
    requireMFA: false,
    enforceSSO: false,
    allowMemberInvites: true,
    requireApprovalForApps: false,
    sessionTimeout: 480,
    allowedEmailDomains: [] as string[],
    passwordPolicy: {
      minLength: 8,
      requireSpecialChars: false,
      requireNumbers: true,
      requireUppercase: true
    }
  });

  const [newEmailDomain, setNewEmailDomain] = createSignal('');

  // Initialize settings when organization loads
  createEffect(() => {
    const org = currentOrganization();
    if (org?.settings) {
      setSettings({
        requireMFA: org.settings.requireMFA,
        enforceSSO: org.settings.enforceSSO,
        allowMemberInvites: org.settings.allowMemberInvites,
        requireApprovalForApps: org.settings.requireApprovalForApps,
        sessionTimeout: org.settings.sessionTimeout,
        allowedEmailDomains: org.settings.allowedEmailDomains || [],
        passwordPolicy: {
          minLength: org.settings.passwordPolicy.minLength,
          requireSpecialChars: org.settings.passwordPolicy.requireSpecialChars,
          requireNumbers: org.settings.passwordPolicy.requireNumbers,
          requireUppercase: org.settings.passwordPolicy.requireUppercase
        }
      });
    }
  });

  const handleSaveSettings = async () => {
    const org = currentOrganization();
    if (!org || !canManageOrganization()) return;

    try {
      setIsSaving(true);

      const updates: UpdateOrganizationRequest = {
        settings: settings()
      };

      await updateOrganization(org.id, updates);

      addNotification({
        type: 'success',
        title: 'Security Settings Updated',
        message: 'Security settings have been saved successfully.'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update security settings'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updatePasswordPolicy = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      passwordPolicy: { ...prev.passwordPolicy, [key]: value }
    }));
  };

  const addEmailDomain = () => {
    const domain = newEmailDomain().trim().toLowerCase();
    if (!domain) return;

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      addNotification({
        type: 'error',
        title: 'Invalid Domain',
        message: 'Please enter a valid domain name (e.g., company.com)'
      });
      return;
    }

    const currentDomains = settings().allowedEmailDomains;
    if (currentDomains.includes(domain)) {
      addNotification({
        type: 'error',
        title: 'Domain Already Added',
        message: 'This domain is already in the allowed list'
      });
      return;
    }

    updateSetting('allowedEmailDomains', [...currentDomains, domain]);
    setNewEmailDomain('');
  };

  const removeEmailDomain = (domain: string) => {
    const currentDomains = settings().allowedEmailDomains;
    updateSetting('allowedEmailDomains', currentDomains.filter(d => d !== domain));
  };

  const getSecurityScore = () => {
    let score = 0;
    const currentSettings = settings();

    if (currentSettings.requireMFA) score += 25;
    if (currentSettings.enforceSSO) score += 20;
    if (currentSettings.passwordPolicy.minLength >= 12) score += 15;
    if (currentSettings.passwordPolicy.requireSpecialChars) score += 10;
    if (currentSettings.passwordPolicy.requireNumbers) score += 10;
    if (currentSettings.passwordPolicy.requireUppercase) score += 10;
    if (currentSettings.sessionTimeout <= 240) score += 10; // 4 hours or less

    return Math.min(score, 100);
  };

  const getSecurityLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 60) return { level: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 40) return { level: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    return { level: 'Needs Improvement', color: 'text-red-600 dark:text-red-400' };
  };

  return (
    <div class="p-6 space-y-8">
      {/* Security Score */}
      <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            Security Score
          </h2>
          <div class="text-right">
            <div class="text-3xl font-bold text-slate-900 dark:text-white">
              {getSecurityScore()}%
            </div>
            <div class={`text-sm font-medium ${getSecurityLevel(getSecurityScore()).color}`}>
              {getSecurityLevel(getSecurityScore()).level}
            </div>
          </div>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${getSecurityScore()}%` }}
          />
        </div>
      </div>

      {/* Authentication Settings */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Authentication & Access
        </h2>
        <div class="space-y-6">
          {/* Multi-Factor Authentication */}
          <div class="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start">
              <Key class="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Multi-Factor Authentication
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Require all members to use two-factor authentication for enhanced security.
                </p>
              </div>
            </div>
            <Show when={canManageOrganization()}>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={settings().requireMFA}
                  onChange={(e) => updateSetting('requireMFA', e.currentTarget.checked)}
                />
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </Show>
          </div>

          {/* Single Sign-On */}
          <div class="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start">
              <Shield class="w-5 h-5 text-green-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Enforce Single Sign-On (SSO)
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Require members to authenticate through your organization's SSO provider.
                </p>
              </div>
            </div>
            <Show when={canManageOrganization()}>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={settings().enforceSSO}
                  onChange={(e) => updateSetting('enforceSSO', e.currentTarget.checked)}
                />
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </Show>
          </div>

          {/* Session Timeout */}
          <div class="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start mb-4">
              <Clock class="w-5 h-5 text-purple-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Session Timeout
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Automatically sign out inactive users after this time period.
                </p>
              </div>
            </div>
            <Show when={canManageOrganization()}>
              <select
                class="input max-w-xs"
                value={settings().sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.currentTarget.value))}
              >
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
                <option value={720}>12 hours</option>
                <option value={1440}>24 hours</option>
              </select>
            </Show>
          </div>
        </div>
      </div>

      {/* Member Management */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Member Management
        </h2>
        <div class="space-y-6">
          {/* Allow Member Invites */}
          <div class="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start">
              <Globe class="w-5 h-5 text-indigo-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Allow Member Invitations
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Allow existing members to invite new team members to the organization.
                </p>
              </div>
            </div>
            <Show when={canManageOrganization()}>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={settings().allowMemberInvites}
                  onChange={(e) => updateSetting('allowMemberInvites', e.currentTarget.checked)}
                />
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </Show>
          </div>

          {/* Require App Approval */}
          <div class="flex items-start justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start">
              <CheckCircle class="w-5 h-5 text-emerald-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Require App Connection Approval
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Require admin approval before members can connect new MCP servers or apps.
                </p>
              </div>
            </div>
            <Show when={canManageOrganization()}>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={settings().requireApprovalForApps}
                  onChange={(e) => updateSetting('requireApprovalForApps', e.currentTarget.checked)}
                />
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </Show>
          </div>

          {/* Allowed Email Domains */}
          <div class="p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div class="flex items-start mb-4">
              <Globe class="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
              <div>
                <h3 class="font-medium text-slate-900 dark:text-white">
                  Allowed Email Domains
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Restrict member invitations to specific email domains. Leave empty to allow all domains.
                </p>
              </div>
            </div>

            <Show when={canManageOrganization()}>
              <div class="space-y-3">
                <div class="flex gap-2">
                  <input
                    type="text"
                    class="input flex-1"
                    placeholder="example.com"
                    value={newEmailDomain()}
                    onInput={(e) => setNewEmailDomain(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmailDomain();
                      }
                    }}
                  />
                  <button
                    class="btn btn-primary"
                    onClick={addEmailDomain}
                    disabled={!newEmailDomain().trim()}
                  >
                    Add
                  </button>
                </div>

                <Show when={settings().allowedEmailDomains.length > 0}>
                  <div class="flex flex-wrap gap-2">
                    {settings().allowedEmailDomains.map(domain => (
                      <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full">
                        {domain}
                        <button
                          class="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                          onClick={() => removeEmailDomain(domain)}
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Password Policy */}
      <div>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          Password Policy
        </h2>
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Minimum Length */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Password Length
              </label>
              <Show when={canManageOrganization()} fallback={
                <div class="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                  <span class="text-slate-900 dark:text-white">
                    {settings().passwordPolicy.minLength} characters
                  </span>
                </div>
              }>
                <select
                  class="input"
                  value={settings().passwordPolicy.minLength}
                  onChange={(e) => updatePasswordPolicy('minLength', parseInt(e.currentTarget.value))}
                >
                  <option value={8}>8 characters</option>
                  <option value={10}>10 characters</option>
                  <option value={12}>12 characters</option>
                  <option value={14}>14 characters</option>
                  <option value={16}>16 characters</option>
                </select>
              </Show>
            </div>
          </div>

          {/* Password Requirements */}
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-slate-900 dark:text-white">
              Password Requirements
            </h3>

            <div class="space-y-3">
              <label class="flex items-center">
                <input
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                  checked={settings().passwordPolicy.requireUppercase}
                  onChange={(e) => updatePasswordPolicy('requireUppercase', e.currentTarget.checked)}
                  disabled={!canManageOrganization()}
                />
                <span class="ml-2 text-sm text-slate-700 dark:text-slate-300">
                  Require uppercase letters (A-Z)
                </span>
              </label>

              <label class="flex items-center">
                <input
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                  checked={settings().passwordPolicy.requireNumbers}
                  onChange={(e) => updatePasswordPolicy('requireNumbers', e.currentTarget.checked)}
                  disabled={!canManageOrganization()}
                />
                <span class="ml-2 text-sm text-slate-700 dark:text-slate-300">
                  Require numbers (0-9)
                </span>
              </label>

              <label class="flex items-center">
                <input
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                  checked={settings().passwordPolicy.requireSpecialChars}
                  onChange={(e) => updatePasswordPolicy('requireSpecialChars', e.currentTarget.checked)}
                  disabled={!canManageOrganization()}
                />
                <span class="ml-2 text-sm text-slate-700 dark:text-slate-300">
                  Require special characters (!@#$%^&*)
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Show when={canManageOrganization()}>
        <div class="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            class="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={isSaving()}
          >
            <Show when={isSaving()} fallback={
              <>
                <Lock class="w-4 h-4 mr-2" />
                Save Security Settings
              </>
            }>
              <div class="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
}