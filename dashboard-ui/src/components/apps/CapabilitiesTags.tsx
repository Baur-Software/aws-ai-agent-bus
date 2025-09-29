import { For } from 'solid-js';

interface CapabilitiesTagsProps {
  capabilities?: string[];
  maxDisplay?: number;
}

export default function CapabilitiesTags(props: CapabilitiesTagsProps) {
  const maxDisplay = () => props.maxDisplay || 4;
  const capabilities = () => props.capabilities || [];
  const displayCapabilities = () => capabilities().slice(0, maxDisplay());
  const remainingCount = () => Math.max(0, capabilities().length - maxDisplay());

  const getCapabilityColor = (capability: string): string => {
    // Simple hash to color mapping for consistent colors
    const hash = capability.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    const colors = [
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
    ];

    return colors[Math.abs(hash) % colors.length];
  };

  const formatCapability = (capability: string): string => {
    // Convert camelCase or snake_case to readable format
    return capability
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div class="flex items-center gap-1 flex-wrap">
      <For each={displayCapabilities()}>
        {(capability) => (
          <span
            class={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${getCapabilityColor(capability)}`}
            title={`Capability: ${formatCapability(capability)}`}
          >
            {formatCapability(capability)}
          </span>
        )}
      </For>

      {remainingCount() > 0 && (
        <span
          class="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          title={`${remainingCount()} more capabilities: ${capabilities().slice(maxDisplay()).map(formatCapability).join(', ')}`}
        >
          +{remainingCount()} more
        </span>
      )}
    </div>
  );
}