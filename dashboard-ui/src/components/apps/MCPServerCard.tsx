import { createSignal, Show } from 'solid-js';
import { MCPServerListing } from '../../types/mcpCatalog';
import VerificationBadges from './VerificationBadges';
import CapabilitiesTags from './CapabilitiesTags';

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

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (date: Date): string => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div class={`rounded-lg border transition-all duration-200 ${
      props.isConnected
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-sm'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
    }`}>
      {/* Header */}
      <div class="p-6 pb-4">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            {/* Server Icon */}
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span class="text-white font-bold text-sm">
                {props.server.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {props.server.name}
                </h3>
                <VerificationBadges
                  isOfficial={props.server.isOfficial}
                  isSigned={props.server.isSigned}
                  verificationBadges={props.server.verificationBadges}
                />
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {props.server.description}
              </p>
            </div>
          </div>

          {/* Connection Status */}
          <div class="flex-shrink-0 ml-4">
            <Show when={props.isConnected}>
              <button
                class="btn btn-sm btn-outline text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                onClick={() => props.onDisconnect(props.server.id)}
                disabled={props.isConnecting}
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Connected
              </button>
            </Show>

            <Show when={!props.isConnected}>
              <button
                class="btn btn-sm btn-primary"
                onClick={() => props.onConnect(props.server.id)}
                disabled={props.isConnecting}
              >
                <Show when={props.isConnecting} fallback={<span>Connect</span>}>
                  <svg class="animate-spin w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </Show>
              </button>
            </Show>
          </div>
        </div>

        {/* Publisher and Version */}
        <div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mb-4">
          <span>by {props.server.publisher}</span>
          <span>•</span>
          <span>v{props.server.version}</span>
          <span>•</span>
          <span class="capitalize">{props.server.category}</span>
        </div>

        {/* Capabilities Tags */}
        <CapabilitiesTags capabilities={props.server.capabilities} />
      </div>

      {/* Metrics */}
      <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>{formatNumber(props.server.downloadCount)}</span>
            </div>

            <div class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span>{formatNumber(props.server.starCount)}</span>
            </div>

            <div class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{props.server.toolCount} tools</span>
            </div>
          </div>

          <div class="text-right">
            <span>Updated {formatDate(new Date(props.server.lastUpdated))}</span>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <Show when={showDetails()}>
        <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
          <div class="space-y-3">
            {/* Authentication Methods */}
            <Show when={props.server.authMethods.length > 0}>
              <div>
                <h4 class="text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Authentication Methods
                </h4>
                <div class="flex flex-wrap gap-1">
                  {props.server.authMethods.map(method => (
                    <span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      {method.replace('_', ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </Show>

            {/* Installation */}
            <Show when={props.server.installCommand || props.server.npmPackage || props.server.dockerImage}>
              <div>
                <h4 class="text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Installation
                </h4>
                <div class="space-y-1">
                  <Show when={props.server.installCommand}>
                    <code class="block text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded text-slate-800 dark:text-slate-200">
                      {props.server.installCommand}
                    </code>
                  </Show>
                  <Show when={props.server.npmPackage}>
                    <div class="text-xs text-slate-600 dark:text-slate-400">
                      NPM: {props.server.npmPackage}
                    </div>
                  </Show>
                  <Show when={props.server.dockerImage}>
                    <div class="text-xs text-slate-600 dark:text-slate-400">
                      Docker: {props.server.dockerImage}
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Configuration Requirements */}
            <Show when={props.server.configurationSchema.length > 0}>
              <div>
                <h4 class="text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Configuration Required ({props.server.configurationSchema.length} fields)
                </h4>
                <div class="text-xs text-slate-600 dark:text-slate-400">
                  {props.server.configurationSchema.filter(field => field.required).length} required fields,
                  {props.server.configurationSchema.filter(field => !field.required).length} optional
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Action Buttons */}
      <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <button
            class="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            onClick={() => setShowDetails(!showDetails())}
          >
            {showDetails() ? 'Hide Details' : 'Show Details'}
          </button>

          <div class="flex gap-2">
            <Show when={props.server.documentation}>
              <a
                href={props.server.documentation}
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-outline"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Docs
              </a>
            </Show>

            <Show when={props.server.repository}>
              <button
                class="btn btn-sm btn-outline"
                onClick={() => props.onViewDetails(props.server.id)}
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                GitHub
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}