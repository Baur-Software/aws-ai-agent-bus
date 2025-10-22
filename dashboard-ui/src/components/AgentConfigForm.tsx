import { createSignal, Show, For, createMemo } from 'solid-js';
import { Eye, EyeOff, ChevronDown, Info } from 'lucide-solid';

export interface AgentConfigFormData {
  name: string;
  description?: string;
  category: string;
  icon: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  requiresPrivacy?: boolean;
}

interface AgentConfigFormProps {
  value: AgentConfigFormData;
  onChange: (value: AgentConfigFormData) => void;
  availableModels?: Array<{ id: string; name: string }>;
  availableIcons?: string[];
  showAdvanced?: boolean;
  mode?: 'create' | 'edit';
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  costPer1kTokens: { input: number; output: number };
  purpose: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
}

// Model configurations with cost and purpose information
const MODEL_CONFIGS: ModelInfo[] = [
  {
    id: 'bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 3.5 Sonnet v2 (Bedrock)',
    provider: 'AWS Bedrock',
    costPer1kTokens: { input: 0.003, output: 0.015 },
    purpose: 'Latest and most capable model',
    speed: 'medium',
    quality: 'high'
  },
  {
    id: 'bedrock:anthropic.claude-3-haiku-20240307-v1:0',
    name: 'Claude 3 Haiku (Bedrock)',
    provider: 'AWS Bedrock',
    costPer1kTokens: { input: 0.00025, output: 0.00125 },
    purpose: 'Fast & cost-effective',
    speed: 'fast',
    quality: 'medium'
  },
  {
    id: 'bedrock:anthropic.claude-3-opus-20240229-v1:0',
    name: 'Claude 3 Opus (Bedrock)',
    provider: 'AWS Bedrock',
    costPer1kTokens: { input: 0.015, output: 0.075 },
    purpose: 'Maximum intelligence',
    speed: 'slow',
    quality: 'high'
  }
];

const DEFAULT_ICONS = ['🤖', '🎯', '💻', '⚡', '🔧', '🎨', '📊', '🔍', '🚀', '💡', '🔌', '⚙️'];

export function AgentConfigForm(props: AgentConfigFormProps) {
  const [showIconPicker, setShowIconPicker] = createSignal(false);
  const [showModelDetails, setShowModelDetails] = createSignal(false);
  const [showSystemPrompt, setShowSystemPrompt] = createSignal(false);

  const availableIcons = createMemo(() => {
    return props.availableIcons && props.availableIcons.length > 0
      ? props.availableIcons
      : DEFAULT_ICONS;
  });

  const selectedModelInfo = createMemo(() => {
    return MODEL_CONFIGS.find(m => m.id === props.value.modelId) || MODEL_CONFIGS[0];
  });

  const updateField = <K extends keyof AgentConfigFormData>(
    field: K,
    value: AgentConfigFormData[K]
  ) => {
    props.onChange({ ...props.value, [field]: value });
  };

  return (
    <div class="space-y-6">
      {/* Basic Information */}
      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          Basic Information
        </h3>

        {/* Name Field */}
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Agent Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
            placeholder="e.g., Google Analytics Expert"
            value={props.value.name}
            onInput={(e) => updateField('name', e.currentTarget.value)}
          />
        </div>

        {/* Description Field */}
        <Show when={props.mode === 'create'}>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white resize-none"
              rows={3}
              placeholder="Describe what this agent does..."
              value={props.value.description || ''}
              onInput={(e) => updateField('description', e.currentTarget.value)}
            />
          </div>
        </Show>

        {/* Category Field */}
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Category
          </label>
          <select
            class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
            value={props.value.category}
            onChange={(e) => updateField('category', e.currentTarget.value)}
          >
            <option value="orchestrators">Orchestrators</option>
            <option value="specialized">Specialized</option>
            <option value="universal">Universal</option>
            <option value="mcp-apps">MCP Apps</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Icon Picker */}
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Icon
          </label>
          <div class="relative">
            <button
              type="button"
              class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
              onClick={() => setShowIconPicker(!showIconPicker())}
            >
              <span class="flex items-center gap-2">
                <span class="text-2xl">{props.value.icon}</span>
                <span class="text-slate-600 dark:text-slate-400">Select an icon</span>
              </span>
              <ChevronDown class={`w-4 h-4 transition-transform ${showIconPicker() ? 'rotate-180' : ''}`} />
            </button>

            <Show when={showIconPicker()}>
              <div class="absolute z-10 mt-2 w-full p-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg">
                <div class="grid grid-cols-8 gap-2">
                  <For each={availableIcons()}>
                    {(availableIcon) => (
                      <button
                        type="button"
                        class={`p-2 text-2xl hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ${
                          props.value.icon === availableIcon ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => {
                          updateField('icon', availableIcon);
                          setShowIconPicker(false);
                        }}
                      >
                        {availableIcon}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Model Configuration */}
      <div class="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          Model Configuration
        </h3>

        {/* Model Selection */}
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Model
          </label>
          <select
            class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
            value={props.value.modelId || MODEL_CONFIGS[0].id}
            onChange={(e) => updateField('modelId', e.currentTarget.value)}
          >
            <For each={MODEL_CONFIGS}>
              {(model) => (
                <option value={model.id}>{model.name}</option>
              )}
            </For>
          </select>

          {/* Model Info */}
          <button
            type="button"
            class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            onClick={() => setShowModelDetails(!showModelDetails())}
          >
            <Info class="w-4 h-4" />
            {showModelDetails() ? 'Hide' : 'Show'} model details
          </button>

          <Show when={showModelDetails()}>
            <div class="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Provider:</span>
                  <span class="text-slate-600 dark:text-slate-400">{selectedModelInfo().provider}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Purpose:</span>
                  <span class="text-slate-600 dark:text-slate-400">{selectedModelInfo().purpose}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Speed:</span>
                  <span class={`capitalize ${
                    selectedModelInfo().speed === 'fast' ? 'text-green-600 dark:text-green-400' :
                    selectedModelInfo().speed === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedModelInfo().speed}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Cost (input):</span>
                  <span class="text-slate-600 dark:text-slate-400">
                    ${selectedModelInfo().costPer1kTokens.input.toFixed(5)}/1k tokens
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Cost (output):</span>
                  <span class="text-slate-600 dark:text-slate-400">
                    ${selectedModelInfo().costPer1kTokens.output.toFixed(5)}/1k tokens
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Advanced Settings */}
        <Show when={props.showAdvanced}>
          <div class="space-y-4">
            {/* Temperature */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Temperature: {(props.value.temperature ?? 0.7).toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="w-full"
                value={props.value.temperature ?? 0.7}
                onInput={(e) => updateField('temperature', parseFloat(e.currentTarget.value))}
              />
              <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white"
                min="100"
                max="4096"
                value={props.value.maxTokens ?? 2048}
                onInput={(e) => updateField('maxTokens', parseInt(e.currentTarget.value))}
              />
            </div>

            {/* System Prompt */}
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
                  System Prompt
                </label>
                <button
                  type="button"
                  class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => setShowSystemPrompt(!showSystemPrompt())}
                >
                  {showSystemPrompt() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                </button>
              </div>
              <Show when={showSystemPrompt()}>
                <textarea
                  class="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white resize-none font-mono text-sm"
                  rows={6}
                  placeholder="Optional custom system prompt for this agent..."
                  value={props.value.systemPrompt || ''}
                  onInput={(e) => updateField('systemPrompt', e.currentTarget.value)}
                />
              </Show>
            </div>

            {/* Privacy Settings */}
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                id="privacy-mode"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                checked={props.value.requiresPrivacy ?? false}
                onChange={(e) => updateField('requiresPrivacy', e.currentTarget.checked)}
              />
              <label for="privacy-mode" class="text-sm font-medium text-slate-700 dark:text-slate-300">
                Require privacy mode (data stays in your AWS account)
              </label>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
