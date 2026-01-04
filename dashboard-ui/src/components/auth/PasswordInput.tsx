import { createSignal, createMemo, Show, JSX } from 'solid-js';
import {
  validatePassword,
  PasswordPolicy,
  DEFAULT_PASSWORD_POLICY,
  PasswordValidationResult,
} from '../../utils/passwordValidation';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onInput: (value: string) => void;
  onValidation?: (result: PasswordValidationResult) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  showStrengthIndicator?: boolean;
  showRequirements?: boolean;
  policy?: PasswordPolicy;
  error?: string;
  class?: string;
}

/**
 * PasswordInput Component
 *
 * Enhanced password input field with:
 * - Show/hide password toggle
 * - Real-time validation
 * - Integrated strength indicator
 * - Accessible ARIA attributes
 */
export default function PasswordInput(props: PasswordInputProps) {
  const [showPassword, setShowPassword] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);

  const policy = () => props.policy || DEFAULT_PASSWORD_POLICY;
  const showStrengthIndicator = () => props.showStrengthIndicator !== false;
  const showRequirements = () => props.showRequirements !== false;

  const validation = createMemo(() => {
    const result = validatePassword(props.value, policy());
    props.onValidation?.(result);
    return result;
  });

  const hasError = () => {
    return (
      props.error ||
      (props.value && !validation().isValid && !isFocused())
    );
  };

  const errorMessage = () => {
    if (props.error) return props.error;
    if (props.value && !validation().isValid && !isFocused()) {
      return validation().errors[0];
    }
    return null;
  };

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
    props.onInput(e.currentTarget.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword());
  };

  const inputId = () => props.id || 'password-input';
  const errorId = () => `${inputId()}-error`;
  const descriptionId = () => `${inputId()}-description`;

  return (
    <div class={props.class || ''}>
      <Show when={props.label}>
        <label
          for={inputId()}
          class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {props.label}
          <Show when={props.required}>
            <span class="text-red-500 ml-0.5">*</span>
          </Show>
        </label>
      </Show>

      <div class="relative">
        <input
          id={inputId()}
          name={props.name || 'password'}
          type={showPassword() ? 'text' : 'password'}
          value={props.value}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          required={props.required}
          autocomplete={props.autoComplete || 'new-password'}
          aria-invalid={hasError() ? 'true' : 'false'}
          aria-describedby={hasError() ? errorId() : descriptionId()}
          class={`
            appearance-none block w-full px-3 py-2 pr-10 border rounded-md
            placeholder-slate-400 dark:placeholder-slate-500
            bg-white dark:bg-slate-800
            text-slate-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-offset-0
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            sm:text-sm
            ${
              hasError()
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500 focus:border-blue-500'
            }
          `}
        />

        {/* Show/Hide Password Toggle */}
        <button
          type="button"
          onClick={togglePasswordVisibility}
          disabled={props.disabled}
          class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={showPassword() ? 'Hide password' : 'Show password'}
          tabindex={-1}
        >
          <Show
            when={showPassword()}
            fallback={
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            }
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          </Show>
        </button>
      </div>

      {/* Error Message */}
      <Show when={errorMessage()}>
        <p id={errorId()} class="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage()}
        </p>
      </Show>

      {/* Password Strength Indicator */}
      <Show when={showStrengthIndicator() && props.value && isFocused()}>
        <div class="mt-3">
          <PasswordStrengthIndicator
            password={props.value}
            policy={policy()}
            showRequirements={showRequirements()}
            showStrengthBar={true}
            showDescription={true}
          />
        </div>
      </Show>

      {/* Hidden description for screen readers */}
      <p id={descriptionId()} class="sr-only">
        Password must be at least {policy().minLength} characters and include
        {policy().requireUppercase && ' an uppercase letter,'}
        {policy().requireLowercase && ' a lowercase letter,'}
        {policy().requireNumbers && ' a number'}
        {policy().requireSpecialChars && ', and a special character'}.
      </p>
    </div>
  );
}
