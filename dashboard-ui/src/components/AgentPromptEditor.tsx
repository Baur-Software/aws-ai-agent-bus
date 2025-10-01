import { createSignal, Show, onMount } from 'solid-js';
import type { AgentDefinition, AgentPrompt } from '../services/AgentDefinitionService';

interface AgentPromptEditorProps {
  agentId: string;
  context?: 'system' | 'personal' | 'organizational';
  onSave: (markdown: string, metadata: {
    name: string;
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
  }) => Promise<void>;
  onClose: () => void;
  agentService: any; // AgentDefinitionService
}

export function AgentPromptEditor(props: AgentPromptEditorProps) {
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [agent, setAgent] = createSignal<AgentDefinition | null>(null);
  const [markdown, setMarkdown] = createSignal('');
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [category, setCategory] = createSignal('custom');
  const [icon, setIcon] = createSignal('🤖');
  const [showPreview, setShowPreview] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      // Load agent data
      const agentDef = await props.agentService.getAgent(props.agentId, props.context);
      const prompt = await props.agentService.getAgentPrompt(props.agentId, props.context);

      if (agentDef) {
        setAgent(agentDef);
        setName(agentDef.name);
        setDescription(agentDef.description);
        setCategory(agentDef.category);
        setIcon(agentDef.icon);
      }

      if (prompt) {
        setMarkdown(prompt.markdown);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await props.onSave(markdown(), {
        name: name(),
        description: description(),
        category: category(),
        icon: icon()
      });

      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const renderMarkdownPreview = () => {
    // Simple markdown rendering (can be enhanced with a proper markdown library)
    return (
      <div
        class="prose prose-sm max-w-none dark:prose-invert"
        innerHTML={markdown()
          .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
          .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-3 mb-2">$1</h2>')
          .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-2 mb-1">$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded">$1</code>')
          .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre class="bg-gray-900 p-3 rounded overflow-x-auto"><code>$2</code></pre>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n\n/g, '</p><p>')
        }
      />
    );
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{icon()}</span>
            <div>
              <h2 class="text-xl font-bold text-white">
                Edit Agent: {name() || props.agentId}
              </h2>
              <p class="text-sm text-gray-400">
                {props.context === 'system' ? 'System Agent (Fork to edit)' : `${category()} agent`}
              </p>
            </div>
          </div>

          <button
            onClick={props.onClose}
            class="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <Show when={!loading()} fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-gray-400">Loading agent...</div>
          </div>
        }>
          <div class="flex-1 overflow-hidden">
            {/* Metadata Fields */}
            <div class="p-4 border-b border-gray-700 bg-gray-850">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Agent name..."
                    disabled={props.context === 'system'}
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={icon()}
                    onInput={(e) => setIcon(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="🤖"
                    disabled={props.context === 'system'}
                  />
                </div>

                <div class="col-span-2">
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                    placeholder="Agent description..."
                    disabled={props.context === 'system'}
                  />
                </div>
              </div>
            </div>

            {/* Editor Toolbar */}
            <div class="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
              <div class="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview())}
                  class={`px-3 py-1 rounded text-sm font-medium ${
                    showPreview()
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {showPreview() ? '📝 Edit' : '👁️ Preview'}
                </button>

                <Show when={props.context === 'system'}>
                  <span class="text-xs text-yellow-500 ml-2">
                    ⚠️ System agents are read-only. Fork to customize.
                  </span>
                </Show>
              </div>

              <div class="text-xs text-gray-500">
                {markdown().length} characters
              </div>
            </div>

            {/* Editor/Preview Area */}
            <div class="flex-1 overflow-auto">
              <Show when={!showPreview()} fallback={
                <div class="p-6 bg-gray-900 min-h-full">
                  {renderMarkdownPreview()}
                </div>
              }>
                <textarea
                  value={markdown()}
                  onInput={(e) => setMarkdown(e.currentTarget.value)}
                  class="w-full h-full p-6 bg-gray-900 text-white font-mono text-sm focus:outline-none resize-none"
                  placeholder="# Agent Prompt

Write your agent's system prompt in markdown...

## Core Expertise
- Expertise area 1
- Expertise area 2

## Required MCP Tools
\`\`\`yaml
- tool_name_1
- tool_name_2
\`\`\`"
                  disabled={props.context === 'system'}
                  style={{ "min-height": "400px" }}
                />
              </Show>
            </div>
          </div>
        </Show>

        {/* Footer */}
        <div class="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-850">
          <Show when={error()}>
            <div class="text-red-500 text-sm">
              ❌ {error()}
            </div>
          </Show>

          <div class="flex-1" />

          <div class="flex gap-2">
            <button
              onClick={props.onClose}
              class="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
              disabled={saving()}
            >
              Cancel
            </button>

            <Show when={props.context !== 'system'}>
              <button
                onClick={handleSave}
                class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving() || !name() || !markdown()}
              >
                {saving() ? 'Saving...' : 'Save Agent'}
              </button>
            </Show>

            <Show when={props.context === 'system'}>
              <button
                onClick={async () => {
                  const forked = await props.agentService.forkAgent(props.agentId, `${name()} (Custom)`);
                  // TODO: Switch to editing the forked agent
                  props.onClose();
                }}
                class="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
                disabled={saving()}
              >
                Fork Agent
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
