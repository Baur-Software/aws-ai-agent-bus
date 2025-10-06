import { createSignal, Show, For, createMemo } from 'solid-js';
import type { AgentDefinition } from '../services/AgentDefinitionService';

interface CreateAgentWizardProps {
  onClose: () => void;
  onCreated: (agent: AgentDefinition) => void;
  agentService: any;
  mcpClient: any;
  existingAgents?: AgentDefinition[]; // Pass in existing agents to extract icons
  connectedApps?: any[]; // Pass in connected apps to extract icons
  availableModels?: Array<{ id: string; name: string }>; // Models from AWS Bedrock
}

// Template from .claude/agents/AGENT_TEMPLATE.md (inlined for browser access)
const AGENT_TEMPLATE = `---
name: your-agent-identifier
description: |
  [2-3 sentence description of the agent's core expertise and primary use cases]
---

# [Agent Name]

[2-3 sentence description of the agent's expertise and role in the development workflow]

## Core Expertise

### [Primary Capability Category]
- [Specific skill/knowledge area]
- [Another specific area]
- [Advanced feature or pattern]

### [Secondary Capability Category]
- [Related skill area]
- [Technical implementation detail]
- [Best practice or pattern]

## Tool Usage

I effectively use the provided tools to:
- **Read**: [How this agent uses file reading capabilities]
- **Write/Edit**: [How this agent creates and modifies files]
- **Grep/Glob**: [How this agent searches and finds patterns]
- **Bash**: [How this agent uses command line operations]
- **WebFetch**: [How this agent researches current information]

---

[Concluding statement about what this agent delivers]`;

export function CreateAgentWizard(props: CreateAgentWizardProps) {
  const [step, setStep] = createSignal<'input' | 'generating' | 'review'>('input');
  const [prompt, setPrompt] = createSignal(AGENT_TEMPLATE); // Initialize with template
  const [name, setName] = createSignal('');
  const [category, setCategory] = createSignal('custom');
  const [icon, setIcon] = createSignal('🤖');
  const [model, setModel] = createSignal('bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0');
  const [showIconPicker, setShowIconPicker] = createSignal(false);
  const [generatedMarkdown, setGeneratedMarkdown] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  // Dynamically collect icons from system agents and connected apps
  const availableIcons = createMemo(() => {
    const icons = new Set<string>();

    // Add icons from existing agents
    props.existingAgents?.forEach(agent => {
      if (agent.icon) icons.add(agent.icon);
    });

    // Add icons from connected apps
    props.connectedApps?.forEach(app => {
      if (app.icon) icons.add(app.icon);
    });

    ['🤖', '🎯', '💻', '⚡', '🔧', '🎨', '📊', '🔍'].forEach(icon => icons.add(icon));

    return Array.from(icons);
  });

  const handleGenerate = async () => {
    if (!prompt().trim()) {
      setError('Please describe what you want the agent to do');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      // Send event to backend to generate agent markdown
      await props.mcpClient.callMCPTool('events_send', {
        detailType: 'agent.generate.requested',
        source: 'create-agent-wizard',
        detail: {
          requestId: `gen_${Date.now()}`,
          agentName: name() || 'Untitled Agent',
          category: category(),
          icon: icon(),
          template: prompt(),
          prompt: `Create an AI agent definition in markdown format based on this template and description.

Agent Name: ${name() || 'Untitled Agent'}
Category: ${category()}
Icon: ${icon()}

Template Content:
${prompt()}

Generate a complete, professional agent markdown file following the template structure. Fill in the placeholders with appropriate content based on the agent name and category.`
        }
      });

      // Wait for response event (backend will publish agent.generate.completed)
      // For now, use a simple timeout and polling approach
      // TODO: Implement proper WebSocket subscription for agent.generate.completed event

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Agent generation timed out'));
        }, 30000); // 30 second timeout

        // Poll for result (temporary solution until WebSocket event subscription is ready)
        const checkInterval = setInterval(async () => {
          try {
            const result = await props.mcpClient.callMCPTool('kv_get', {
              key: `agent-generation-result-${Date.now()}`
            });

            if (result?.value) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve(JSON.parse(result.value));
            }
          } catch (err) {
            // Continue polling
          }
        }, 1000);
      });

      const markdown = response?.markdown || '';

      if (!markdown) {
        throw new Error('Failed to generate agent definition');
      }

      setGeneratedMarkdown(markdown);
      setStep('review');

    } catch (err: any) {
      setError(err.message || 'Failed to generate agent');
      setStep('input');
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);

    try {
      const agentId = (name() || 'custom-agent')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const agent = await props.agentService.saveAgent(
        agentId,
        generatedMarkdown(),
        {
          name: name() || 'Custom Agent',
          description: prompt().substring(0, 200),
          category: category(),
          icon: icon(),
          model: model()
        }
      );

      props.onCreated(agent);
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto"
      onClick={(e) => {
        // Only close if clicking the backdrop
        if (e.target === e.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div
        class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🪄</span>
            <div>
              <h2 class="text-xl font-bold text-white">Create New Agent</h2>
              <p class="text-sm text-gray-400">
                {step() === 'input' && 'Agents can be connected to apps and output to others.'}
                {step() === 'generating' && 'Generating agent definition...'}
                {step() === 'review' && 'Review and customize'}
              </p>
            </div>
          </div>

          <button
            onClick={props.onClose}
            class="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-800"
            disabled={step() === 'generating'}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-6">
          {/* Step 1: Input */}
          <Show when={step() === 'input'}>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  placeholder="My Custom Agent"
                />
              </div>

              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category()}
                    onChange={(e) => setCategory(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="custom">Custom</option>
                    <option value="orchestrators">Orchestrators</option>
                    <option value="core">Core</option>
                    <option value="specialized">Specialized</option>
                    <option value="integrations">Integrations</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Model
                  </label>
                  <select
                    value={model()}
                    onChange={(e) => setModel(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <Show when={props.availableModels && props.availableModels.length > 0} fallback={
                      <option value="" disabled>No models available - check MCP server connection</option>
                    }>
                      <For each={props.availableModels}>
                        {(modelOption) => (
                          <option value={modelOption.id}>
                            {modelOption.name}
                          </option>
                        )}
                      </For>
                    </Show>
                  </select>
                </div>

                <div class="relative">
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Icon
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker())}
                    class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white hover:bg-gray-750 focus:outline-none focus:border-blue-500 text-left flex items-center gap-2"
                  >
                    <span class="text-2xl">{icon()}</span>
                    <span class="text-gray-400 text-sm">Click to change</span>
                  </button>

                  {/* Icon Picker Dropdown */}
                  <Show when={showIconPicker()}>
                    <div class="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-lg p-2">
                      <div class="grid grid-cols-8 gap-1">
                        <For each={availableIcons()}>
                          {(emoji) => (
                            <button
                              type="button"
                              onClick={() => {
                                setIcon(emoji);
                                setShowIconPicker(false);
                              }}
                              class="text-2xl p-2 hover:bg-gray-700 rounded transition-colors"
                            >
                              {emoji}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">
                  Agent Template *
                </label>
                <textarea
                  value={prompt()}
                  onInput={(e) => setPrompt(e.currentTarget.value)}
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 font-mono text-sm resize-none overflow-y-auto"
                  rows={20}
                />
                <div class="text-xs text-gray-500 mt-1">
                  {prompt().length} characters • Edit the template directly or click "Generate with AI" for assistance
                </div>
              </div>
            </div>
          </Show>

          {/* Step 2: Generating */}
          <Show when={step() === 'generating'}>
            <div class="flex flex-col items-center justify-center py-12">
              <div class="animate-spin text-6xl mb-4">🪄</div>
              <div class="text-lg font-medium text-white mb-2">
                Generating your agent...
              </div>
              <div class="text-sm text-gray-400">
                Using Claude to create a professional agent definition
              </div>
              <div class="mt-6 w-full max-w-md bg-gray-800 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </Show>

          {/* Step 3: Review */}
          <Show when={step() === 'review'}>
            <div class="space-y-4">
              <div class="p-4 bg-gray-800 rounded border border-gray-700">
                <div class="text-sm font-medium text-green-400 mb-1">
                  ✅ Agent generated successfully!
                </div>
                <div class="text-xs text-gray-400">
                  Review the generated markdown below and edit if needed before creating.
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-300">
                    Generated Agent Prompt
                  </label>
                  <button
                    onClick={() => setStep('input')}
                    class="text-xs text-blue-400 hover:text-blue-300"
                  >
                    ← Back to edit
                  </button>
                </div>
                <textarea
                  value={generatedMarkdown()}
                  onInput={(e) => setGeneratedMarkdown(e.currentTarget.value)}
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  rows={20}
                />
                <div class="text-xs text-gray-500 mt-1">
                  You can edit this markdown directly before creating the agent
                </div>
              </div>
            </div>
          </Show>
        </div>

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
              disabled={step() === 'generating' || saving()}
            >
              Cancel
            </button>

            <Show when={step() === 'input'}>
              <button
                onClick={handleGenerate}
                class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!prompt().trim() || !name().trim()}
              >
                Generate with AI 🪄
              </button>

              <button
                onClick={() => {
                  setGeneratedMarkdown(prompt());
                  setStep('review');
                }}
                class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!prompt().trim() || !name().trim()}
              >
                Create from Template ✨
              </button>
            </Show>

            <Show when={step() === 'review'}>
              <button
                onClick={handleCreate}
                class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving() || !generatedMarkdown()}
              >
                {saving() ? 'Creating...' : 'Create Agent ✨'}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
