import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import type { AgentDefinition } from '../services/AgentDefinitionService';

interface AgentSelectorProps {
  value?: string;                    // Selected agent ID
  context?: 'system' | 'personal' | 'organizational';
  onChange: (agentId: string, agentContext: 'system' | 'personal' | 'organizational') => void;
  onEdit?: (agentId: string, context: 'system' | 'personal' | 'organizational') => void;
  onFork?: (systemAgentId: string) => void;
  agentService: any;                 // AgentDefinitionService
  disabled?: boolean;
}

export function AgentSelector(props: AgentSelectorProps) {
  const [loading, setLoading] = createSignal(true);
  const [systemAgents, setSystemAgents] = createSignal<AgentDefinition[]>([]);
  const [userAgents, setUserAgents] = createSignal<AgentDefinition[]>([]);
  const [orgAgents, setOrgAgents] = createSignal<AgentDefinition[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal<AgentDefinition | null>(null);
  const [selectedContext, setSelectedContext] = createSignal<'system' | 'personal' | 'organizational'>('system');

  onMount(async () => {
    await loadAgents();
  });

  const loadAgents = async () => {
    setLoading(true);
    try {
      const [system, personal, org] = await Promise.all([
        props.agentService.listAgents('system').catch(() => []),
        props.agentService.listAgents('personal').catch(() => []),
        props.agentService.listAgents('organizational').catch(() => [])
      ]);

      setSystemAgents(system);
      setUserAgents(personal);
      setOrgAgents(org);

      // Find currently selected agent
      if (props.value) {
        const allAgents = [...system, ...personal, ...org];
        const current = allAgents.find(a => a.id === props.value);
        if (current) {
          setSelectedAgent(current);
          setSelectedContext(current.context);
        }
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (agent: AgentDefinition) => {
    setSelectedAgent(agent);
    setSelectedContext(agent.context);
    props.onChange(agent.id, agent.context);
  };

  const allAgents = () => [
    ...systemAgents(),
    ...userAgents(),
    ...orgAgents()
  ];

  const groupedAgents = () => {
    const groups: Record<string, AgentDefinition[]> = {
      'System Agents': systemAgents(),
      'My Agents': userAgents(),
      'Team Agents': orgAgents()
    };

    return Object.entries(groups).filter(([_, agents]) => agents.length > 0);
  };

  return (
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-300">
        Agent
        <Show when={selectedAgent()}>
          <span class="text-gray-500 ml-2">
            ({selectedAgent()!.context})
          </span>
        </Show>
      </label>

      <Show when={loading()} fallback={
        <div class="space-y-2">
          {/* Agent Dropdown */}
          <select
            value={props.value}
            onChange={(e) => {
              const agentId = e.currentTarget.value;
              const agent = allAgents().find(a => a.id === agentId);
              if (agent) handleSelect(agent);
            }}
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
            disabled={props.disabled}
          >
            <option value="">Select an agent...</option>
            <For each={groupedAgents()}>
              {([groupName, agents]) => (
                <optgroup label={groupName}>
                  <For each={agents}>
                    {(agent) => (
                      <option value={agent.id}>
                        {agent.icon} {agent.name}
                      </option>
                    )}
                  </For>
                </optgroup>
              )}
            </For>
          </select>

          {/* Selected Agent Info */}
          <Show when={selectedAgent()}>
            <div class="p-3 bg-gray-800 rounded border border-gray-700">
              <div class="flex items-start justify-between">
                <div class="flex items-start gap-3">
                  <span class="text-2xl">{selectedAgent()!.icon}</span>
                  <div class="flex-1">
                    <div class="font-medium text-white">
                      {selectedAgent()!.name}
                    </div>
                    <div class="text-sm text-gray-400 mt-1">
                      {selectedAgent()!.description}
                    </div>

                    <Show when={selectedAgent()!.requiredMCPTools?.length}>
                      <div class="mt-2">
                        <div class="text-xs text-gray-500">Required MCP Tools:</div>
                        <div class="flex flex-wrap gap-1 mt-1">
                          <For each={selectedAgent()!.requiredMCPTools}>
                            {(tool) => (
                              <span class="px-2 py-0.5 bg-blue-900 text-blue-300 text-xs rounded">
                                {tool}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    <Show when={selectedAgent()!.requiredIntegrations?.length}>
                      <div class="mt-2">
                        <div class="text-xs text-gray-500">Required Integrations:</div>
                        <div class="flex flex-wrap gap-1 mt-1">
                          <For each={selectedAgent()!.requiredIntegrations}>
                            {(integration) => (
                              <span class="px-2 py-0.5 bg-purple-900 text-purple-300 text-xs rounded">
                                {integration}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Actions */}
                <div class="flex gap-1 ml-2">
                  <Show when={props.onEdit}>
                    <button
                      onClick={() => props.onEdit!(selectedAgent()!.id, selectedAgent()!.context)}
                      class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                      title={selectedAgent()!.context === 'system' ? 'View agent' : 'Edit agent'}
                    >
                      {selectedAgent()!.context === 'system' ? '👁️' : '✏️'}
                    </button>
                  </Show>

                  <Show when={selectedAgent()!.context === 'system' && props.onFork}>
                    <button
                      onClick={() => props.onFork!(selectedAgent()!.id)}
                      class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                      title="Fork agent for customization"
                    >
                      🔀
                    </button>
                  </Show>
                </div>
              </div>

              {/* Prompt Preview */}
              <Show when={selectedAgent()!.promptPreview}>
                <div class="mt-3 pt-3 border-t border-gray-700">
                  <div class="text-xs text-gray-500 mb-1">Prompt Preview:</div>
                  <div class="text-xs text-gray-400 font-mono">
                    {selectedAgent()!.promptPreview}...
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* No agents message */}
          <Show when={allAgents().length === 0}>
            <div class="p-4 bg-gray-800 rounded border border-gray-700 text-center text-gray-400">
              <div class="text-sm">No agents available</div>
              <div class="text-xs mt-1">System agents should be seeded on first deployment</div>
            </div>
          </Show>
        </div>
      }>
        <div class="flex items-center justify-center p-4 bg-gray-800 rounded">
          <div class="text-gray-400 text-sm">Loading agents...</div>
        </div>
      </Show>
    </div>
  );
}
