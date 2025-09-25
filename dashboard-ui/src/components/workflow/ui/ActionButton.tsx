import { JSX } from 'solid-js';

interface ActionButtonProps {
  icon: any;
  label: string;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'warning';
  loading?: boolean;
  disabled?: boolean;
  badge?: boolean;
  title?: string;
  compact?: boolean;
}

export default function ActionButton(props: ActionButtonProps) {
  const getVariantClasses = () => {
    switch (props.variant) {
      case 'primary':
        return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500';
      case 'secondary':
      default:
        return 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    }
  };

  return (
    <button
      class={`relative px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 flex items-center gap-2 ${getVariantClasses()} ${
        props.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'
      }`}
      onClick={props.onClick}
      onContextMenu={props.onContextMenu}
      disabled={props.disabled}
      title={props.title}
    >
      <props.icon class={`w-4 h-4 ${props.loading ? 'animate-spin' : ''}`} />
      {!props.compact && <span>{props.label}</span>}
      {props.badge && (
        <div class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      )}
    </button>
  );
}