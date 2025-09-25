import { Component, Show, JSX } from 'solid-js';

export type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps {
  // Content
  icon?: Component<{ class?: string }>;
  label?: string;
  badge?: boolean;
  loading?: boolean;

  // Behavior
  onClick?: (e: MouseEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  onMouseDown?: (e: MouseEvent) => void;
  disabled?: boolean;

  // Styling
  variant?: ButtonVariant;
  size?: ButtonSize;
  class?: string;
  title?: string;

  // Layout
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export default function ActionButton(props: ActionButtonProps) {
  const variant = () => props.variant || 'secondary';
  const size = () => props.size || 'md';

  const getVariantClasses = () => {
    const baseClasses = 'font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]';

    if (props.disabled) {
      return `${baseClasses} opacity-40 cursor-not-allowed bg-gray-100/50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500`;
    }

    switch (variant()) {
      case 'primary':
        return `${baseClasses} bg-blue-500 hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800 text-white shadow-md hover:shadow-lg`;
      case 'warning':
        return `${baseClasses} bg-orange-500 hover:bg-orange-600 active:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 dark:active:bg-orange-800 text-white shadow-md hover:shadow-lg`;
      case 'danger':
        return `${baseClasses} bg-red-500 hover:bg-red-600 active:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800 text-white shadow-md hover:shadow-lg`;
      case 'secondary':
      default:
        return `${baseClasses} bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm hover:shadow-md`;
    }
  };

  const getSizeClasses = () => {
    switch (size()) {
      case 'sm':
        return props.iconOnly ? 'p-1.5' : 'px-2 py-1.5 text-xs gap-1';
      case 'lg':
        return props.iconOnly ? 'p-3' : 'px-4 py-3 text-base gap-3';
      case 'md':
      default:
        return props.iconOnly ? 'p-2' : 'px-3 py-2 text-sm gap-2';
    }
  };

  const getIconSize = () => {
    switch (size()) {
      case 'sm':
        return 'w-3 h-3';
      case 'lg':
        return 'w-5 h-5';
      case 'md':
      default:
        return 'w-4 h-4';
    }
  };

  const classes = () => [
    'relative flex items-center justify-center rounded-lg',
    getVariantClasses(),
    getSizeClasses(),
    props.fullWidth ? 'w-full' : '',
    props.class || ''
  ].filter(Boolean).join(' ');

  return (
    <div class="relative">
      <button
        onClick={props.onClick}
        onContextMenu={props.onContextMenu}
        onMouseDown={props.onMouseDown}
        disabled={props.disabled}
        class={classes()}
        title={props.title}
      >
        <Show
          when={props.loading}
          fallback={
            <Show when={props.icon}>
              <props.icon class={getIconSize()} />
            </Show>
          }
        >
          <div class={`border-2 border-white dark:border-white border-t-transparent rounded-full animate-spin ${getIconSize()}`} />
        </Show>

        <Show when={props.label && !props.iconOnly}>
          <span>{props.label}</span>
        </Show>
      </button>

      {/* Badge indicator */}
      <Show when={props.badge}>
        <div class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
      </Show>
    </div>
  );
}