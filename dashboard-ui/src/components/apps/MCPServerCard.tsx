import { createSignal, Show, For } from 'solid-js';
import { MCPServerListing } from '../../types/mcpCatalog';
import VerificationBadges from './VerificationBadges';
import CapabilitiesTags from './CapabilitiesTags';
import { getServiceLogo } from '../../utils/logoUtils';

interface MCPServerCardProps {
  server: MCPServerListing;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: (serverId: string) => Promise<void>;
  onDisconnect: (serverId: string) => Promise<void>;
  onViewDetails: (serverId: string) => void;
}

export default function MCPServerCard(props: MCPServerCardProps) {
  const [showDetails, setShowDetails] = createSignal(false);
  const [showWorkflowDetails, setShowWorkflowDetails] = createSignal(false);

  const logo = getServiceLogo(props.server.name);

  const formatNumber = (num?: number): string => {
    if (num == null || num === undefined) {
      return '0';
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (date: Date | undefined | null): string => {
    if (!date || isNaN(date.getTime())) {
      return 'Unknown';
    }

    const daysDiff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Ensure the value is finite for RelativeTimeFormat
    if (!isFinite(daysDiff)) {
      return 'Unknown';
    }

    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      daysDiff,
      'day'
    );
  };

  return (
    <div class={`rounded-xl border transition-all duration-200 overflow-hidden ${
      props.isConnected
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-sm'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600'
    }`}>
      {/* Main Content */}
      <div class="p-5">
        {/* Header with Icon and Title */}
        <div class="flex items-start gap-4 mb-4">
          {/* Server Icon */}
          <div class={`flex-shrink-0 w-12 h-12 rounded-xl ${logo.bgColor} flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-600`}>
            <Show when={logo.logoUrl} fallback={
              <span class="text-white font-bold text-lg">
                {logo.fallbackLetter}
              </span>
            }>
              <img
                src={logo.logoUrl}
                alt={`${props.server.name} logo`}
                class="w-8 h-8 object-contain"
                onError={(e) => {
                  // If logo fails to load, hide it and show fallback
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.remove('bg-white');
                    parent.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-purple-600');
                    parent.innerHTML = `<span class="text-white font-bold text-lg">${logo.fallbackLetter}</span>`;
                  }
                }}
              />
            </Show>
          </div>

          {/* Content Area - Gets most space */}
          <div class="flex-1 min-w-0">
            {/* Title and Badges */}
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {props.server.name}
                </h3>
                <VerificationBadges
                  isOfficial={props.server.isOfficial}
                  isSigned={props.server.isSigned}
                  verificationBadges={props.server.verificationBadges}
                />
              </div>

              {/* Connect Button - Moved to top right, more compact */}
              <div class="flex-shrink-0">
                <Show when={props.isConnected}>
                  <button
                    class="w-8 h-8 rounded-lg border border-green-300 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-400 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 transition-all flex items-center justify-center"
                    onClick={() => props.onDisconnect(props.server.id)}
                    disabled={props.isConnecting}
                    title="Connected - Click to disconnect"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </Show>

                <Show when={!props.isConnected}>
                  <button
                    class="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:border-slate-500 transition-all flex items-center justify-center"
                    onClick={() => props.onConnect(props.server.id)}
                    disabled={props.isConnecting}
                    title="Connect"
                  >
                    <Show when={props.isConnecting} fallback={
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    }>
                      <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </Show>
                  </button>
                </Show>
              </div>
            </div>

            {/* Description - Now has much more space */}
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 line-clamp-3">
              {props.server.description}
            </p>

            {/* Meta Info Row - Only show meaningful info */}
            <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <span class="font-medium">by {props.server.publisher}</span>
              <Show when={props.server.category && props.server.category !== 'Other'}>
                <span>•</span>
                <span class="capitalize">{props.server.category}</span>
              </Show>
            </div>

            {/* Capabilities - More compact, max 2 */}
            <Show when={props.server.capabilities && props.server.capabilities.length > 0}>
              <CapabilitiesTags capabilities={props.server.capabilities} maxDisplay={2} />
            </Show>

            {/* Workflow Integration Summary */}
            <Show when={props.server.workflowNodes && props.server.workflowNodes.length > 0}>
              <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowWorkflowDetails(!showWorkflowDetails())}
                  class="w-full flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                    </svg>
                    <span class="font-medium">{props.server.workflowNodes.length} workflow nodes</span>
                    <Show when={props.server.specializedAgents && props.server.specializedAgents.length > 0}>
                      <span>•</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{props.server.specializedAgents.length} agents</span>
                    </Show>
                  </div>
                  <svg
                    class={`w-4 h-4 transition-transform ${showWorkflowDetails() ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expandable Workflow Details */}
                <Show when={showWorkflowDetails()}>
                  <div class="mt-3 space-y-3 pl-2">
                    {/* Workflow Nodes List */}
                    <Show when={props.server.workflowNodeDetails && props.server.workflowNodeDetails.length > 0}>
                      <div>
                        <div class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Available Nodes:</div>
                        <div class="space-y-1.5">
                          <For each={props.server.workflowNodeDetails}>
                            {(node) => (
                              <div class="flex items-start gap-2 text-xs">
                                <span class="text-base flex-shrink-0">{node.icon || '📦'}</span>
                                <div class="flex-1 min-w-0">
                                  <div class="font-medium text-slate-800 dark:text-slate-200">{node.name}</div>
                                  <div class="text-slate-500 dark:text-slate-400 text-xs">{node.description}</div>
                                  <div class="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
                                    <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{node.category}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* Specialized Agents List */}
                    <Show when={props.server.specializedAgentDetails && props.server.specializedAgentDetails.length > 0}>
                      <div>
                        <div class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Specialized Agents:</div>
                        <div class="space-y-1.5">
                          <For each={props.server.specializedAgentDetails}>
                            {(agent) => (
                              <div class="flex items-start gap-2 text-xs">
                                <span class="text-base flex-shrink-0">🤖</span>
                                <div class="flex-1 min-w-0">
                                  <div class="font-medium text-slate-800 dark:text-slate-200">{agent.name}</div>
                                  <div class="text-slate-500 dark:text-slate-400 text-xs">{agent.description}</div>
                                  <div class="flex flex-wrap gap-1 mt-1">
                                    <For each={agent.expertise}>
                                      {(skill) => (
                                        <span class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                                          {skill}
                                        </span>
                                      )}
                                    </For>
                                  </div>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* Data Compatibility Info */}
                    <Show when={props.server.dataInputTypes || props.server.dataOutputTypes}>
                      <div>
                        <div class="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Data Compatibility:</div>
                        <div class="space-y-1">
                          <Show when={props.server.dataInputTypes && props.server.dataInputTypes.length > 0}>
                            <div class="text-xs">
                              <span class="text-slate-600 dark:text-slate-400">Accepts: </span>
                              <span class="text-slate-700 dark:text-slate-300">{props.server.dataInputTypes.join(', ')}</span>
                            </div>
                          </Show>
                          <Show when={props.server.dataOutputTypes && props.server.dataOutputTypes.length > 0}>
                            <div class="text-xs">
                              <span class="text-slate-600 dark:text-slate-400">Produces: </span>
                              <span class="text-slate-700 dark:text-slate-300">{props.server.dataOutputTypes.join(', ')}</span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Footer with Metrics and Links - Only show if there's meaningful data */}
      <Show when={
        (props.server.downloadCount && props.server.downloadCount > 0) ||
        (props.server.starCount && props.server.starCount > 0) ||
        props.server.toolCount ||
        props.server.repository
      }>
        <div class="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            {/* Metrics - Only show non-zero values */}
            <div class="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <Show when={props.server.downloadCount && props.server.downloadCount > 0}>
                <div class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <span>{formatNumber(props.server.downloadCount)}</span>
                </div>
              </Show>

              <Show when={props.server.starCount && props.server.starCount > 0}>
                <div class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>{formatNumber(props.server.starCount)}</span>
                </div>
              </Show>

              <Show when={props.server.toolCount && props.server.toolCount > 0}>
                <div class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>{props.server.toolCount} tools</span>
                </div>
              </Show>
            </div>

            {/* Action Links */}
            <div class="flex items-center gap-3">
              <Show when={props.server.repository}>
                <a
                  href={props.server.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex items-center gap-1"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  GitHub
                </a>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}