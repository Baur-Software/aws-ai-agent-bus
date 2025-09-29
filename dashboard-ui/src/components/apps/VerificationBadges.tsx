import { Show, For } from 'solid-js';

interface VerificationBadgesProps {
  isOfficial: boolean;
  isSigned: boolean;
  verificationBadges: ('official' | 'signed' | 'popular' | 'verified')[];
}

export default function VerificationBadges(props: VerificationBadgesProps) {
  const getBadgeConfig = (type: string) => {
    switch (type) {
      case 'official':
        return {
          label: 'Official',
          icon: '🏛️',
          className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
          tooltip: 'Official MCP Server maintained by the core team'
        };
      case 'signed':
        return {
          label: 'Signed',
          icon: '🔐',
          className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
          tooltip: 'Code-signed and cryptographically verified'
        };
      case 'verified':
        return {
          label: 'Verified',
          icon: '✅',
          className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
          tooltip: 'Verified by community moderators'
        };
      case 'popular':
        return {
          label: 'Popular',
          icon: '🔥',
          className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
          tooltip: 'High adoption rate in the community'
        };
      default:
        return null;
    }
  };

  // Determine which badges to show
  const badges = () => {
    const result: string[] = [];

    if (props.isOfficial) result.push('official');
    if (props.isSigned) result.push('signed');

    // Add additional badges from the array
    props.verificationBadges.forEach(badge => {
      if (!result.includes(badge)) {
        result.push(badge);
      }
    });

    return result;
  };

  return (
    <div class="flex items-center gap-1 flex-wrap">
      <For each={badges()}>
        {(badgeType) => {
          const config = getBadgeConfig(badgeType);
          if (!config) return null;

          return (
            <div
              class={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border ${config.className}`}
              title={config.tooltip}
            >
              <span class="text-xs">{config.icon}</span>
              <span>{config.label}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
}