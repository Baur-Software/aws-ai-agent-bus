import { createSignal, onMount, Show, For } from 'solid-js';
import { Cpu, Plus, Edit, Trash2, Play } from 'lucide-solid';
import { CreateAgentWizard } from '../components/CreateAgentWizard';
import { AgentPromptEditor } from '../components/AgentPromptEditor';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useArtifactService } from '../services/ArtifactService';
import { useAgentDefinitionService } from '../services/AgentDefinitionService';
import type { AgentDefinition } from '../services/AgentDefinitionService';

interface AgentsProps {
  isOverlay?: boolean;
}

export default function Agents(props: AgentsProps) {
  const [agents, setAgents] = createSignal<AgentDefinition[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showCreateWizard, setShowCreateWizard] = createSignal(false);
  const [editingAgent, setEditingAgent] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');

  const dashboardServer = useDashboardServer();
  const { callMCPTool } = dashboardServer;
  const artifactService = useArtifactService();
  const agentService = useAgentDefinitionService(artifactService, { callMCPTool });

  // Load agents from artifacts
  const loadAgents = async () => {
    setLoading(true);
    try {
      // List all agent definition files from artifacts
      const result = await callMCPTool('artifacts_list', { prefix: 'agents/' });

      if (result?.artifacts) {
        // Load each agent definition
        const agentDefs = await Promise.all(
          result.artifacts
            .filter((a: any) => a.key.endsWith('.md'))
            .map(async (artifact: any) => {
              try {
                const agentId = artifact.key.replace('agents/', '').replace('.md', '');
                return await agentService.getAgent(agentId);
              } catch (err) {
                console.error('Failed to load agent:', artifact.key, err);
                return null;
              }
            })
        );

        setAgents(agentDefs.filter(Boolean) as AgentDefinition[]);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadAgents();
  });

  const handleCreateAgent = async (agent: AgentDefinition) => {
    await loadAgents();
    setShowCreateWizard(false);
  };

  const handleEditAgent = (agentId: string) => {
    setEditingAgent(agentId);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await artifactService.delete(`agents/${agentId}.md`);
      await loadAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const filteredAgents = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return agents();

    return agents().filter(agent =>
      agent.name.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.category?.toLowerCase().includes(query)
    );
  };

  return (
    <div class="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div class="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <Cpu class="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">AI Agents</h1>
              <p class="text-sm text-gray-500 dark:text-gray-400">Create and manage reusable agent definitions</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateWizard(true)}
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus class="w-4 h-4" />
            Create Agent
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Agents Grid */}
      <div class="flex-1 overflow-y-auto p-6">
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center h-64">
              <div class="text-gray-500 dark:text-gray-400">Loading agents...</div>
            </div>
          }
        >
          <Show
            when={filteredAgents().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center h-64">
                <Cpu class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <p class="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery() ? 'No agents match your search' : 'No agents created yet'}
                </p>
                <Show when={!searchQuery()}>
                  <button
                    onClick={() => setShowCreateWizard(true)}
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Create Your First Agent
                  </button>
                </Show>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={filteredAgents()}>
                {(agent) => (
                  <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex items-center gap-3">
                        <div class="text-3xl">{agent.icon || '🤖'}</div>
                        <div>
                          <h3 class="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                          <span class="text-xs text-gray-500 dark:text-gray-400 capitalize">{agent.category || 'custom'}</span>
                        </div>
                      </div>
                    </div>

                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                      {agent.description || 'No description'}
                    </p>

                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => handleEditAgent(agent.id)}
                        class="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                      >
                        <Edit class="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        class="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Create Agent Wizard */}
      <Show when={showCreateWizard()}>
        <CreateAgentWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleCreateAgent}
          agentService={agentService}
          mcpClient={{ callMCPTool }}
          existingAgents={agents()}
          connectedApps={[]}
          availableModels={[
            { id: 'bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet' },
            { id: 'bedrock:anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku' }
          ]}
        />
      </Show>

      {/* Edit Agent */}
      <Show when={editingAgent()}>
        <AgentPromptEditor
          agentId={editingAgent()!}
          context="personal"
          onSave={async (markdown, metadata) => {
            await artifactService.put(`agents/${editingAgent()}.md`, markdown);
            await loadAgents();
          }}
          onClose={() => setEditingAgent(null)}
          agentService={agentService}
        />
      </Show>
    </div>
  );
}
