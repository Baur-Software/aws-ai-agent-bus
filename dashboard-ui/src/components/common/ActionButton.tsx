import { JSX, Show } from 'solid-js';
import { LucideIcon } from 'lucide-solid';

export interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  badge?: boolean;
  tooltip?: string;
  hasRightClick?: boolean;
  class?: string;
}

export default function ActionButton(props: ActionButtonProps) {
  const variant = () => props.variant || 'secondary';
  const size = () => props.size || 'md';

  const getBaseClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

    // Size classes
    const sizeClasses = {
      sm: 'gap-1.5 px-2.5 py-1.5 text-xs rounded-md',
      md: 'gap-2 px-3 py-2 text-sm rounded-lg',
      lg: 'gap-2.5 px-4 py-2.5 text-base rounded-xl'
    };

    return `${baseClasses} ${sizeClasses[size()]}`;
  };

  const getVariantClasses = () => {
    if (props.disabled) {
      return 'opacity-40 cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500';
    }

    const variants = {
      primary: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] focus:ring-blue-500',

      secondary: 'bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98] focus:ring-gray-500',

      warning: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 dark:active:bg-orange-800 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] focus:ring-orange-500',

      success: 'bg-green-500 hover:bg-green-600 active:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:active:bg-green-800 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] focus:ring-green-500',

      danger: 'bg-red-500 hover:bg-red-600 active:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] focus:ring-red-500'
    };

    return variants[variant()];
  };

  const getIconSize = () => {
    const sizes = {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5'
    };
    return sizes[size()];
  };

  const tooltipText = () => {
    if (props.tooltip) return props.tooltip;
    if (props.hasRightClick) return `${props.label} • Right-click for more options`;
    return props.label;
  };

  return (
    <div class="relative">
      <button
        onClick={props.onClick}
        onContextMenu={props.onContextMenu}
        disabled={props.disabled}
        class={`${getBaseClasses()} ${getVariantClasses()} ${props.class || ''}`}
        title={tooltipText()}
        aria-label={props.label}
      >
        <Show
          when={props.loading}
          fallback={<props.icon class={getIconSize()} />}
        >
          <div class={`${getIconSize()} border-2 border-current border-t-transparent rounded-full animate-spin opacity-75`} />
        </Show>

        <span>{props.label}</span>
      </button>

      {/* Badge indicator */}
      <Show when={props.badge}>
        <div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
      </Show>
    </div>
  );
}