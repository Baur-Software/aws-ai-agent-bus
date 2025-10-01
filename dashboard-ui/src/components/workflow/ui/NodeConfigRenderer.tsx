/**
 * Node Config Renderer
 *
 * Generic, composable component that renders configuration forms
 * based on node schemas from nodeDefinitions.ts or AgentDefinition.
 *
 * This replaces hardcoded config forms in FloatingNodePanel.
 */

import { For } from 'solid-js';
import type { NodeDefinition } from '../../../config/nodeDefinitions';

interface NodeConfigRendererProps {
  nodeDefinition: NodeDefinition;
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

export default function NodeConfigRenderer(props: NodeConfigRendererProps) {
  const configFields = props.nodeDefinition.configFields || [];

  /**
   * Get nested value from config (supports "delegation.maxAgents" keys)
   */
  const getValue = (key: string) => {
    if (!key.includes('.')) {
      return props.config[key] ?? getDefaultValue(key);
    }

    const [parent, child] = key.split('.');
    return props.config[parent]?.[child] ?? getDefaultValue(key);
  };

  /**
   * Get default value for a field
   */
  const getDefaultValue = (key: string) => {
    const field = configFields.find(f => f.key === key);
    return field?.defaultValue ?? '';
  };

  /**
   * Render individual field based on type
   */
  const renderField = (field: NonNullable<NodeDefinition['configFields']>[number]) => {
    const value = getValue(field.key);

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
            value={value}
            onInput={(e) => props.onConfigChange(field.key, e.currentTarget.value)}
            placeholder={field.label}
          />
        );

      case 'textarea':
        return (
          <textarea
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
            rows="3"
            value={value}
            onInput={(e) => props.onConfigChange(field.key, e.currentTarget.value)}
            placeholder={field.label}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
            value={value}
            onInput={(e) => props.onConfigChange(field.key, Number(e.currentTarget.value))}
          />
        );

      case 'select':
        return (
          <select
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
            value={value}
            onChange={(e) => props.onConfigChange(field.key, e.currentTarget.value)}
          >
            <option value="">Select...</option>
            <For each={field.options || []}>
              {(option) => (
                <option value={option.value}>
                  {option.label}
                </option>
              )}
            </For>
          </select>
        );

      case 'json':
        return (
          <textarea
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 font-mono pointer-events-auto"
            rows="4"
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onInput={(e) => {
              try {
                const parsed = JSON.parse(e.currentTarget.value);
                props.onConfigChange(field.key, parsed);
              } catch {
                // Invalid JSON, store as string for now
                props.onConfigChange(field.key, e.currentTarget.value);
              }
            }}
            placeholder='{"key": "value"}'
          />
        );

      default:
        return (
          <input
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-2 focus:ring-blue-500 pointer-events-auto"
            value={value}
            onInput={(e) => props.onConfigChange(field.key, e.currentTarget.value)}
          />
        );
    }
  };

  return (
    <div class="space-y-4">
      <For each={configFields}>
        {(field) => (
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {field.label}
              {field.required && <span class="text-red-500 ml-1">*</span>}
            </label>
            {renderField(field)}
          </div>
        )}
      </For>

      {configFields.length === 0 && (
        <div class="text-sm text-gray-500 dark:text-gray-400 italic">
          No configuration options available for this node.
        </div>
      )}
    </div>
  );
}
