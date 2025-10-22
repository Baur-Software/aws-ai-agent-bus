import { Show } from 'solid-js';
import { Lock, Zap, ArrowRight, ExternalLink, Loader } from 'lucide-solid';
import { useInfraState } from '../../../hooks/useFeatureFlag';
import { useOrganization } from '../../../contexts/OrganizationContext';

interface UpgradePromptProps {
  nodeType: string;
  nodeDisplayName: string;
  nodeDescription?: string;
}

export function UpgradePrompt(props: UpgradePromptProps) {
  const { currentOrganization } = useOrganization();
  const infraState = useInfraState();

  const org = () => currentOrganization();

  const handleUpgrade = () => {
    // Navigate to billing/upgrade page
    window.location.hash = '#/settings/billing';
  };

  return (
    <div class="p-6 space-y-4">
      {/* Locked Badge */}
      <div class="flex items-center justify-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-full">
          <Lock class="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span class="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Locked Node
          </span>
        </div>
      </div>

      {/* Node Info */}
      <div class="text-center space-y-2">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          {props.nodeDisplayName}
        </h3>
        <Show when={props.nodeDescription}>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {props.nodeDescription}
          </p>
        </Show>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          This node requires a subscription upgrade to use.
        </p>
      </div>

      {/* Infrastructure State */}
      <Show when={infraState() === 'deploying'}>
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-start gap-3">
            <Loader class="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-900 dark:text-blue-200">
                Infrastructure Deploying
              </p>
              <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Your infrastructure is being provisioned.
                This node will be available once deployment completes.
              </p>
            </div>
          </div>
        </div>
      </Show>

      <Show when={infraState() === 'failed'}>
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex items-start gap-3">
            <Lock class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-sm font-medium text-red-900 dark:text-red-200">
                Infrastructure Deployment Failed
              </p>
              <p class="text-xs text-red-700 dark:text-red-300 mt-1">
                There was an issue deploying your infrastructure. Please contact support.
              </p>
            </div>
          </div>
        </div>
      </Show>

      {/* Upgrade Button */}
      <Show when={infraState() !== 'deploying'}>
        <button
          type="button"
          onClick={handleUpgrade}
          class="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <span>Upgrade Subscription</span>
          <ArrowRight class="w-5 h-5" />
        </button>
      </Show>

      {/* Learn More Link */}
      <div class="text-center">
        <a
          href="https://docs.example.com/workspace-tiers"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Learn more about workspace tiers
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
