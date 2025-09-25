// Workflow Settings Component
// Manages workflow-related user preferences and configuration

import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { 
  Settings, Save, Download, Upload, Trash2, RefreshCw, 
  Clock, Bell, Shield, Database, Globe, User, Tag,
  CheckCircle, AlertCircle, Info, Eye, EyeOff,
  FileText, Folder, Star, BarChart3
} from 'lucide-solid';
import { WorkflowStorageService } from '../../services/WorkflowStorageService';

interface WorkflowSettingsProps {
  workflowStorage: WorkflowStorageService;
}

interface WorkflowPreferences {
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  defaultExecutionTimeout: number; // seconds
  showExecutionLogs: boolean;
  enableNotifications: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  defaultWorkflowCategory: string;
  defaultTags: string[];
  maxStoredExecutions: number;
  compressOldWorkflows: boolean;
  shareAnalytics: boolean;
  theme: 'light' | 'dark' | 'auto';
  gridSize: 'small' | 'medium' | 'large';
  showNodeLabels: boolean;
  snapToGrid: boolean;
}

const DEFAULT_PREFERENCES: WorkflowPreferences = {
  autoSave: true,
  autoSaveInterval: 30,
  defaultExecutionTimeout: 300,
  showExecutionLogs: true,
  enableNotifications: true,
  notifyOnSuccess: true,
  notifyOnFailure: true,
  defaultWorkflowCategory: '',
  defaultTags: [],
  maxStoredExecutions: 10,
  compressOldWorkflows: true,
  shareAnalytics: false,
  theme: 'auto',
  gridSize: 'medium',
  showNodeLabels: true,
  snapToGrid: true
};

export default function WorkflowSettings(props: WorkflowSettingsProps) {
  const [preferences, setPreferences] = createSignal<WorkflowPreferences>(DEFAULT_PREFERENCES);
  const [isDirty, setIsDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [lastSaved, setLastSaved] = createSignal<string | null>(null);

  // Load user preferences
  onMount(async () => {
    try {
      const stored = await props.workflowStorage.getWorkflowPreferences();
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...stored });
      }
    } catch (error) {
      console.warn('Could not load workflow preferences:', error);
    }
  });

  // Load workflow statistics
  const [stats] = createResource(async () => {
    const workflows = await props.workflowStorage.listWorkflows();
    const categories = new Set(workflows.map(w => w.category).filter(Boolean));
    const tags = new Set(workflows.flatMap(w => w.tags));
    
    return {
      totalWorkflows: workflows.length,
      totalExecutions: workflows.reduce((sum, w) => sum + w.executionCount, 0),
      categories: Array.from(categories),
      tags: Array.from(tags),
      totalNodes: workflows.reduce((sum, w) => sum + w.nodeCount, 0),
      avgNodesPerWorkflow: workflows.length > 0 
        ? Math.round(workflows.reduce((sum, w) => sum + w.nodeCount, 0) / workflows.length)
        : 0
    };
  });

  // Update preference and mark dirty
  const updatePreference = <K extends keyof WorkflowPreferences>(
    key: K, 
    value: WorkflowPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // Save preferences
  const handleSave = async () => {
    setSaving(true);
    try {
      await props.workflowStorage.saveWorkflowPreferences(preferences());
      setIsDirty(false);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to save workflow preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    if (confirm('Reset all workflow settings to defaults?')) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsDirty(true);
    }
  };

  // Export all workflows
  const handleExportAll = async () => {
    try {
      const workflows = await props.workflowStorage.listWorkflows();
      const exported = await props.workflowStorage.exportWorkflows(
        workflows.map(w => w.id)
      );
      
      if (exported) {
        const blob = new Blob([exported], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all-workflows-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export workflows');
    }
  };

  // Import workflows
  const handleImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await props.workflowStorage.importWorkflows(text);
      
      if (result.imported > 0) {
        alert(`Successfully imported ${result.imported} workflows`);
      }
      
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        alert(`Import completed with ${result.errors.length} errors. Check console for details.`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import workflows');
    }
    
    input.value = '';
  };

  // Clear all workflow data
  const handleClearData = async () => {
    const confirmed = confirm(
      'This will delete ALL your workflows and execution history. This action cannot be undone. Are you sure?'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = prompt(
      'Type "DELETE ALL WORKFLOWS" to confirm this action:'
    );
    
    if (doubleConfirm !== 'DELETE ALL WORKFLOWS') {
      alert('Action cancelled - text did not match');
      return;
    }

    try {
      const workflows = await props.workflowStorage.listWorkflows();
      for (const workflow of workflows) {
        await props.workflowStorage.deleteWorkflow(workflow.id);
      }
      alert('All workflows have been deleted');
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear workflow data');
    }
  };

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Workflow Settings</h2>
          <p class="text-gray-600 dark:text-gray-400">Configure your workflow preferences and manage data</p>
        </div>
        
        <div class="flex items-center gap-3">
          <Show when={lastSaved()}>
            <span class="text-sm text-green-600">
              <CheckCircle class="w-4 h-4 inline mr-1" />
              Saved at {lastSaved()}
            </span>
          </Show>
          
          <Show when={isDirty()}>
            <span class="text-sm text-yellow-600">
              <AlertCircle class="w-4 h-4 inline mr-1" />
              Unsaved changes
            </span>
          </Show>
          
          <button
            onClick={handleSave}
            disabled={!isDirty() || saving()}
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving() ? <RefreshCw class="w-4 h-4 animate-spin" /> : <Save class="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 class="w-5 h-5" />
          Workflow Statistics
        </h3>
        
        <Show when={stats()}>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">{stats()!.totalWorkflows}</div>
              <div class="text-sm text-gray-600">Total Workflows</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">{stats()!.totalExecutions}</div>
              <div class="text-sm text-gray-600">Total Executions</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-600">{stats()!.totalNodes}</div>
              <div class="text-sm text-gray-600">Total Nodes</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-orange-600">{stats()!.avgNodesPerWorkflow}</div>
              <div class="text-sm text-gray-600">Avg Nodes/Workflow</div>
            </div>
          </div>
        </Show>
      </div>

      {/* Auto-Save Settings */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock class="w-5 h-5" />
          Auto-Save Settings
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Enable Auto-Save</label>
              <p class="text-sm text-gray-500">Automatically save workflows while editing</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().autoSave}
              onChange={(e) => updatePreference('autoSave', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          <Show when={preferences().autoSave}>
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700">Auto-Save Interval</label>
                <p class="text-sm text-gray-500">Seconds between auto-saves</p>
              </div>
              <select
                value={preferences().autoSaveInterval}
                onChange={(e) => updatePreference('autoSaveInterval', parseInt(e.target.value))}
                class="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
              </select>
            </div>
          </Show>
        </div>
      </div>

      {/* Execution Settings */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings class="w-5 h-5" />
          Execution Settings
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Default Timeout</label>
              <p class="text-sm text-gray-500">Default execution timeout in seconds</p>
            </div>
            <select
              value={preferences().defaultExecutionTimeout}
              onChange={(e) => updatePreference('defaultExecutionTimeout', parseInt(e.target.value))}
              class="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={1800}>30 minutes</option>
              <option value={3600}>1 hour</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Show Execution Logs</label>
              <p class="text-sm text-gray-500">Display detailed logs during workflow execution</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().showExecutionLogs}
              onChange={(e) => updatePreference('showExecutionLogs', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Max Stored Executions</label>
              <p class="text-sm text-gray-500">Number of execution results to keep per workflow</p>
            </div>
            <select
              value={preferences().maxStoredExecutions}
              onChange={(e) => updatePreference('maxStoredExecutions', parseInt(e.target.value))}
              class="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value={5}>5 executions</option>
              <option value={10}>10 executions</option>
              <option value={25}>25 executions</option>
              <option value={50}>50 executions</option>
              <option value={100}>100 executions</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Bell class="w-5 h-5" />
          Notification Settings
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Enable Notifications</label>
              <p class="text-sm text-gray-500">Show notifications for workflow events</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().enableNotifications}
              onChange={(e) => updatePreference('enableNotifications', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          <Show when={preferences().enableNotifications}>
            <div class="ml-4 space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-sm text-gray-700">Notify on Success</label>
                <input
                  type="checkbox"
                  checked={preferences().notifyOnSuccess}
                  onChange={(e) => updatePreference('notifyOnSuccess', e.target.checked)}
                  class="rounded text-green-600 focus:ring-green-500"
                />
              </div>
              
              <div class="flex items-center justify-between">
                <label class="text-sm text-gray-700">Notify on Failure</label>
                <input
                  type="checkbox"
                  checked={preferences().notifyOnFailure}
                  onChange={(e) => updatePreference('notifyOnFailure', e.target.checked)}
                  class="rounded text-red-600 focus:ring-red-500"
                />
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Default Values */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText class="w-5 h-5" />
          Default Values
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Default Category</label>
            <input
              type="text"
              value={preferences().defaultWorkflowCategory}
              onInput={(e) => updatePreference('defaultWorkflowCategory', e.target.value)}
              placeholder="e.g., Content Management"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Default Tags</label>
            <input
              type="text"
              value={preferences().defaultTags.join(', ')}
              onInput={(e) => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                updatePreference('defaultTags', tags);
              }}
              placeholder="e.g., automation, analytics"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p class="text-xs text-gray-500 mt-1">Comma-separated list of tags</p>
          </div>
        </div>
      </div>

      {/* Editor Settings */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Eye class="w-5 h-5" />
          Editor Settings
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Theme</label>
              <p class="text-sm text-gray-500">Editor appearance theme</p>
            </div>
            <select
              value={preferences().theme}
              onChange={(e) => updatePreference('theme', e.target.value as any)}
              class="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Grid Size</label>
              <p class="text-sm text-gray-500">Node positioning grid size</p>
            </div>
            <select
              value={preferences().gridSize}
              onChange={(e) => updatePreference('gridSize', e.target.value as any)}
              class="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Show Node Labels</label>
              <p class="text-sm text-gray-500">Display labels on workflow nodes</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().showNodeLabels}
              onChange={(e) => updatePreference('showNodeLabels', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Snap to Grid</label>
              <p class="text-sm text-gray-500">Automatically align nodes to grid</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().snapToGrid}
              onChange={(e) => updatePreference('snapToGrid', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Database class="w-5 h-5" />
          Data Management
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Compress Old Workflows</label>
              <p class="text-sm text-gray-500">Compress workflows not accessed for 30+ days</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().compressOldWorkflows}
              onChange={(e) => updatePreference('compressOldWorkflows', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Share Anonymous Analytics</label>
              <p class="text-sm text-gray-500">Help improve the platform with usage analytics</p>
            </div>
            <input
              type="checkbox"
              checked={preferences().shareAnalytics}
              onChange={(e) => updatePreference('shareAnalytics', e.target.checked)}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Import/Export */}
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Folder class="w-5 h-5" />
          Import/Export
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Export All Workflows</label>
              <p class="text-sm text-gray-500">Download all your workflows as JSON</p>
            </div>
            <button
              onClick={handleExportAll}
              class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              <Download class="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-700">Import Workflows</label>
              <p class="text-sm text-gray-500">Import workflows from JSON file</p>
            </div>
            <label class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm cursor-pointer">
              <Upload class="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                class="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div class="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
          <Shield class="w-5 h-5" />
          Danger Zone
        </h3>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-red-700">Reset All Settings</label>
              <p class="text-sm text-red-600">Reset all workflow settings to defaults</p>
            </div>
            <button
              onClick={handleReset}
              class="flex items-center gap-2 px-3 py-1.5 border border-red-300 text-red-700 rounded-md hover:bg-red-100 text-sm"
            >
              <RefreshCw class="w-4 h-4" />
              Reset
            </button>
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-red-700">Delete All Workflows</label>
              <p class="text-sm text-red-600">Permanently delete all your workflows and data</p>
            </div>
            <button
              onClick={handleClearData}
              class="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
            >
              <Trash2 class="w-4 h-4" />
              Delete All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}