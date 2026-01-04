import { createMemo, Show, For } from 'solid-js';
import {
  validatePassword,
  getStrengthDescription,
  getStrengthColors,
  PasswordPolicy,
  DEFAULT_PASSWORD_POLICY,
} from '../../utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  policy?: PasswordPolicy;
  showRequirements?: boolean;
  showStrengthBar?: boolean;
  showDescription?: boolean;
  class?: string;
}

/**
 * PasswordStrengthIndicator Component
 *
 * Displays real-time password strength feedback including:
 * - Strength bar visualization
 * - Strength description text
 * - Individual requirement checklist
 */
export default function PasswordStrengthIndicator(props: PasswordStrengthIndicatorProps) {
  const policy = () => props.policy || DEFAULT_PASSWORD_POLICY;
  const showRequirements = () => props.showRequirements !== false;
  const showStrengthBar = () => props.showStrengthBar !== false;
  const showDescription = () => props.showDescription !== false;

  const validation = createMemo(() => {
    return validatePassword(props.password, policy());
  });

  const strengthColors = createMemo(() => {
    return getStrengthColors(validation().strength);
  });

  const strengthDescription = createMemo(() => {
    return getStrengthDescription(validation().strength);
  });

  // Calculate number of bars to fill based on strength
  const strengthBars = createMemo(() => {
    const strength = validation().strength;
    switch (strength) {
      case 'excellent': return 5;
      case 'strong': return 4;
      case 'good': return 3;
      case 'fair': return 2;
      case 'weak': return 1;
      default: return 0;
    }
  });

  return (
    <div class={`space-y-3 ${props.class || ''}`}>
      {/* Strength Bar */}
      <Show when={showStrengthBar() && props.password}>
        <div class="space-y-1">
          <div class="flex gap-1">
            <For each={[1, 2, 3, 4, 5]}>
              {(bar) => (
                <div
                  class={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    bar <= strengthBars()
                      ? strengthColors().bg
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </For>
          </div>
          <Show when={showDescription()}>
            <div class="flex justify-between items-center text-xs">
              <span class={strengthColors().text}>
                {strengthDescription()}
              </span>
              <span class="text-slate-500 dark:text-slate-400">
                {validation().score}%
              </span>
            </div>
          </Show>
        </div>
      </Show>

      {/* Requirements Checklist */}
      <Show when={showRequirements() && props.password}>
        <div class="space-y-1.5">
          <p class="text-xs font-medium text-slate-600 dark:text-slate-400">
            Password requirements:
          </p>
          <ul class="space-y-1">
            <For each={validation().requirements}>
              {(requirement) => (
                <li class="flex items-center gap-2 text-xs">
                  <span
                    class={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-all duration-200 ${
                      requirement.met
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <Show
                      when={requirement.met}
                      fallback={
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="4" stroke-width="2" />
                        </svg>
                      }
                    >
                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </Show>
                  </span>
                  <span
                    class={`transition-colors duration-200 ${
                      requirement.met
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {requirement.label}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
