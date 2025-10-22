import { createSignal, For, Show } from 'solid-js';
import {
  generateOAuth2Config,
  generateAPIKeyConfig,
  QUICK_GENERATORS,
  validateOAuth2Config
} from '../utils/oauth2Generator';
import type { AppConfig } from '../contexts/KVStoreContext';
import { useEventDrivenAppConfigs } from '../hooks/useEventDrivenKV';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  Plus, X, Check, Code, Key, Globe,
  ChevronDown, Sparkles, Copy, ExternalLink
} from 'lucide-solid';

interface AppConfigGeneratorProps {
  onCancel: () => void;
  initialConfig?: Partial<AppConfig>;
  orgId?: string;
}

export default function AppConfigGenerator(props: AppConfigGeneratorProps) {
  // Hooks
  const { saveConfig, isLoading } = useEventDrivenAppConfigs();
  const dashboardServer = useDashboardServer();
  const { success, error } = useNotifications();

  // Form state
  const [configType, setConfigType] = createSignal<'oauth2' | 'api_key'>('oauth2');
  const [formData, setFormData] = createSignal({
    id: '',
    name: '',
    category: '',
    description: '',
    custom_auth_url: '',
    custom_token_url: '',
    scopes: '',
    docs_url: ''
  });
  const [customFields, setCustomFields] = createSignal([]);
  const [workflowCapabilities, setWorkflowCapabilities] = createSignal([]);
  const [previewConfig, setPreviewConfig] = createSignal<AppConfig | null>(null);
  const [validationErrors, setValidationErrors] = createSignal<string[]>([]);

  // Categories
  const categories = ['Analytics', 'CRM', 'Communication', 'Development', 'Productivity', 'Payments', 'E-commerce', 'Marketing', 'Social'];

  // Update form field
  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    generatePreview();
  };

  // Add custom field
  const addCustomField = () => {
    setCustomFields(prev => [...prev, {
      key: '',
      label: '',
      type: 'text',
      required: false
    }]);
  };

  // Remove custom field
  const removeCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
    generatePreview();
  };

  // Update custom field
  const updateCustomField = (index: number, key: string, value: any) => {
    setCustomFields(prev => prev.map((field, i) =>
      i === index ? { ...field, [key]: value } : field
    ));
    generatePreview();
  };

  // Add workflow capability
  const addWorkflowCapability = () => {
    const capability = prompt('Enter workflow capability name:');
    if (capability) {
      setWorkflowCapabilities(prev => [...prev, capability]);
      generatePreview();
    }
  };

  // Generate preview
  const generatePreview = () => {
    try {
      const data = formData();
      if (!data.id || !data.name) {
        setPreviewConfig(null);
        return;
      }

      let config: AppConfig;

      if (configType() === 'oauth2') {
        const scopes = data.scopes.split(',').map(s => s.trim()).filter(Boolean);

        if (!data.custom_auth_url || !data.custom_token_url) {
          setPreviewConfig(null);
          setValidationErrors(['Auth URL and Token URL are required for OAuth2']);
          return;
        }

        config = generateOAuth2Config({
          id: data.id,
          name: data.name,
          category: data.category,
          description: data.description,
          auth_url: data.custom_auth_url,
          token_url: data.custom_token_url,
          scopes,
          additional_fields: customFields(),
          workflow_capabilities: workflowCapabilities(),
          docs_url: data.docs_url || undefined
        });
      } else {
        config = generateAPIKeyConfig({
          id: data.id,
          name: data.name,
          category: data.category,
          description: data.description,
          fields: customFields().length > 0 ? customFields() : undefined,
          workflow_capabilities: workflowCapabilities(),
          docs_url: data.docs_url || undefined
        });
      }

      const validation = validateOAuth2Config(config);
      setValidationErrors(validation.errors);
      setPreviewConfig(config);
    } catch (err) {
      console.error('Preview generation failed:', err);
      setPreviewConfig(null);
    }
  };


  // Save config via events
  const handleSave = async () => {
    const config = previewConfig();
    if (!config || validationErrors().length > 0) return;

    try {
      // Emit config creation event (optional - events may not be available)
      if (dashboardServer.callMCPTool) {
        await dashboardServer.callMCPTool('events_send', {
          detailType: 'app-config.created',
          detail: {
            config,
            orgId: props.orgId,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Save via event-driven system
      const saveSuccess = await saveConfig(config, props.orgId);
      if (saveSuccess) {
        success(`✅ App configuration '${config.name}' created successfully!`);
        props.onCancel(); // Close form
      }
    } catch (err) {
      console.error('Save failed:', err);
      error(`❌ Failed to save app configuration: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div class="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">App Config Generator</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">Create OAuth2 or API key configurations</p>
        </div>
        <button
          onClick={props.onCancel}
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div class="space-y-4">
          {/* Basic Info */}
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={configType()}
                  onChange={(e) => setConfigType(e.target.value as any)}
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
                >
                  <option value="oauth2">OAuth2</option>
                  <option value="api_key">API Key</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={formData().category}
                  onChange={(e) => updateField('category', e.target.value)}
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
                >
                  <option value="">Select category</option>
                  <For each={categories}>
                    {(cat) => <option value={cat}>{cat}</option>}
                  </For>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ID</label>
              <input
                type="text"
                value={formData().id}
                onInput={(e) => updateField('id', e.target.value)}
                placeholder="unique-app-id"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={formData().name}
                onInput={(e) => updateField('name', e.target.value)}
                placeholder="App Name"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                value={formData().description}
                onInput={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of the integration"
                rows={2}
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
              />
            </div>
          </div>

          {/* OAuth2 specific */}
          <Show when={configType() === 'oauth2'}>
            <div class="space-y-3">
              <div class="grid grid-cols-1 gap-3">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Auth URL</label>
                  <input
                    type="url"
                    value={formData().custom_auth_url}
                    onInput={(e) => updateField('custom_auth_url', e.target.value)}
                    placeholder="https://provider.com/oauth/authorize"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Token URL</label>
                  <input
                    type="url"
                    value={formData().custom_token_url}
                    onInput={(e) => updateField('custom_token_url', e.target.value)}
                    placeholder="https://provider.com/oauth/token"
                    class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scopes</label>
                <input
                  type="text"
                  value={formData().scopes}
                  onInput={(e) => updateField('scopes', e.target.value)}
                  placeholder="scope1, scope2, scope3"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md text-sm"
                />
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Comma-separated list</p>
              </div>
            </div>
          </Show>

          {/* Actions */}
          <div class="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleSave}
              disabled={!previewConfig() || validationErrors().length > 0 || isLoading()}
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check class="w-4 h-4" />
              {isLoading() ? 'Saving...' : 'Save Config'}
            </button>
            <button
              onClick={props.onCancel}
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Preview */}
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <Code class="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Generated Config</span>
          </div>

          <Show when={validationErrors().length > 0}>
            <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div class="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Validation Errors</div>
              <For each={validationErrors()}>
                {(validationError) => (
                  <div class="text-xs text-red-600 dark:text-red-400">• {validationError}</div>
                )}
              </For>
            </div>
          </Show>

          <Show when={previewConfig()} fallback={
            <div class="p-8 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
              Fill in the form to see preview
            </div>
          }>
            <div class="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              <pre class="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
                {JSON.stringify(previewConfig(), null, 2)}
              </pre>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}