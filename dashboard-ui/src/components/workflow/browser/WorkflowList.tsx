import { createSignal, createResource, Show, For } from 'solid-js';
import { useOrganization } from '../../../contexts/OrganizationContext';
import WorkflowCapabilityGenerator from '../generator/WorkflowCapabilityGenerator';
import MCPToolGenerator from '../generator/MCPToolGenerator';

export interface Workflow {
  workflowId: string;
  name: string;
  description: string;
  definition: any;
  requiredApps: string[];
  sharedWith: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  contextName?: string;
}

export interface MCPContext {
  contextId: string;
  contextName: string;
  permissions: string[];
  oauthGrants: string[];
  workflows: string[];
}

class WorkflowService {
  static async getWorkflows(orgSlug: string): Promise<Workflow[]> {
    const response = await fetch('/api/workflows', {
      headers: {
        'x-organization-id': orgSlug,
        'x-user-id': 'demo-user'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch workflows');
    }

    const data = await response.json();
    return data.workflows || [];
  }

  static async getContexts(orgSlug: string): Promise<MCPContext[]> {
    const response = await fetch('/api/workflows/contexts', {
      headers: {
        'x-organization-id': orgSlug,
        'x-user-id': 'demo-user'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch contexts');
    }

    const data = await response.json();
    return data.contexts || [];
  }

  static async createWorkflow(orgSlug: string, workflow: {
    contextId: string;
    name: string;
    description: string;
    definition: any;
    requiredApps: string[];
  }): Promise<Workflow> {
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgSlug,
        'x-user-id': 'demo-user'
      },
      body: JSON.stringify(workflow)
    });

    if (!response.ok) {
      throw new Error('Failed to create workflow');
    }

    return response.json();
  }
}

export function WorkflowList() {
  const { currentOrganization } = useOrganization();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'workflows' | 'generator' | 'tools'>('workflows');

  // Load workflows for current organization
  const [workflows, { refetch: refetchWorkflows }] = createResource(
    () => currentOrganization()?.slug,
    async (orgSlug) => {
      if (!orgSlug) return [];
      return WorkflowService.getWorkflows(orgSlug);
    }
  );

  // Load MCP contexts for current organization
  const [contexts] = createResource(
    () => currentOrganization()?.slug,
    async (orgSlug) => {
      if (!orgSlug) return [];
      return WorkflowService.getContexts(orgSlug);
    }
  );

  const handleCreateWorkflow = async (workflowData: any) => {
    const orgSlug = currentOrganization()?.slug;
    if (!orgSlug) return;

    try {
      await WorkflowService.createWorkflow(orgSlug, workflowData);
      refetchWorkflows();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Workflows</h1>
          <p class="text-gray-600">
            Shared workflows for <span class="font-medium">{currentOrganization()?.name}</span>
          </p>
        </div>
        <Show when={activeTab() === 'workflows'}>
          <button
            onClick={() => setShowCreateModal(true)}
            class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Workflow
          </button>
        </Show>
      </div>

      {/* Tabs */}
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('workflows')}
            class={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab() === 'workflows'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Workflows
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            class={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab() === 'generator'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span class="flex items-center">
              Generate Workflows
              <svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            class={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab() === 'tools'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span class="flex items-center">
              Create MCP Tools
              <svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <Show when={activeTab() === 'workflows'}>
        {/* MCP Contexts Overview */}
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">
              MCP Contexts Available
            </h3>
            <div class="mt-2 text-sm text-blue-700">
              <Show when={contexts.loading}>
                <span>Loading contexts...</span>
              </Show>
              <Show when={!contexts.loading && (contexts() || []).length === 0}>
                <span>No MCP contexts found. Create one to enable workflow creation.</span>
                <a href={`/${currentOrganization()?.slug}/contexts`} class="ml-2 underline">
                  Manage Contexts
                </a>
              </Show>
              <Show when={!contexts.loading && (contexts() || []).length > 0}>
                <span>
                  {(contexts() || []).length} context{(contexts() || []).length !== 1 ? 's' : ''} available with OAuth integrations.
                </span>
                <a href={`/${currentOrganization()?.slug}/contexts`} class="ml-2 underline">
                  Manage Contexts
                </a>
              </Show>
            </div>
          </div>
        </div>
      </div>

      {/* Workflows Grid */}
      <Show when={workflows.loading}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={[1, 2, 3]}>
            {() => (
              <div class="bg-white p-6 rounded-lg border border-gray-200 animate-pulse">
                <div class="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div class="h-3 bg-gray-200 rounded w-full mb-4" />
                <div class="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!workflows.loading && (workflows() || []).length === 0}>
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No workflows</h3>
          <p class="mt-1 text-sm text-gray-500">
            Get started by creating your first workflow.
          </p>
          <div class="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create your first workflow
            </button>
          </div>
        </div>
      </Show>

      <Show when={!workflows.loading && (workflows() || []).length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={workflows()}>
            {(workflow) => (
              <div class="bg-white p-6 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="text-lg font-medium text-gray-900 mb-2">
                      {workflow.name}
                    </h3>
                    <p class="text-sm text-gray-600 mb-4">
                      {workflow.description}
                    </p>

                    {/* Required Apps */}
                    <Show when={workflow.requiredApps.length > 0}>
                      <div class="mb-4">
                        <div class="text-xs font-medium text-gray-500 mb-2">Required Apps:</div>
                        <div class="flex flex-wrap gap-1">
                          <For each={workflow.requiredApps}>
                            {(app) => (
                              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {app}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* Context and sharing info */}
                    <div class="text-xs text-gray-500">
                      <div>Context: {workflow.contextName || 'Unknown'}</div>
                      <div>
                        Shared with {workflow.sharedWith.length} user{workflow.sharedWith.length !== 1 ? 's' : ''}
                      </div>
                      <div>
                        Created {new Date(workflow.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div class="ml-4">
                    <button class="text-gray-400 hover:text-gray-600">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Execute button */}
                <div class="mt-4 pt-4 border-t border-gray-200">
                  <button class="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a1 1 0 001 1h4M9 10V9a1 1 0 011-1h4a1 1 0 011 1v1M9 10H8a1 1 0 00-1 1v4a1 1 0 001 1h1" />
                    </svg>
                    Execute Workflow
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={activeTab() === 'generator'}>
        <WorkflowCapabilityGenerator />
      </Show>

      <Show when={activeTab() === 'tools'}>
        <MCPToolGenerator />
      </Show>

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        isOpen={showCreateModal()}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateWorkflow}
        contexts={contexts() || []}
      />
    </div>
  );
}

function CreateWorkflowModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  contexts: MCPContext[];
}) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [contextId, setContextId] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim() || !contextId()) return;

    try {
      setLoading(true);
      await props.onSubmit({
        contextId: contextId(),
        name: name().trim(),
        description: description().trim(),
        definition: {
          version: '1.0',
          steps: []
        },
        requiredApps: []
      });

      // Reset form
      setName('');
      setDescription('');
      setContextId('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={props.onClose} />

          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <form onSubmit={handleSubmit}>
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div class="sm:flex sm:items-start">
                  <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Create New Workflow
                    </h3>

                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700">
                          MCP Context
                        </label>
                        <select
                          value={contextId()}
                          onInput={(e) => setContextId(e.currentTarget.value)}
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          required
                        >
                          <option value="">Select a context...</option>
                          <For each={props.contexts}>
                            {(context) => (
                              <option value={context.contextId}>
                                {context.contextName}
                              </option>
                            )}
                          </For>
                        </select>
                        <Show when={props.contexts.length === 0}>
                          <p class="mt-1 text-sm text-red-600">
                            No MCP contexts available. Please create one first.
                          </p>
                        </Show>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700">
                          Workflow Name
                        </label>
                        <input
                          type="text"
                          value={name()}
                          onInput={(e) => setName(e.currentTarget.value)}
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Data Processing Pipeline"
                          required
                        />
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          value={description()}
                          onInput={(e) => setDescription(e.currentTarget.value)}
                          rows="3"
                          class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Describe what this workflow does..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={loading() || !name().trim() || !contextId() || props.contexts.length === 0}
                  class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading() ? 'Creating...' : 'Create Workflow'}
                </button>
                <button
                  type="button"
                  onClick={props.onClose}
                  class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Show>
  );
}