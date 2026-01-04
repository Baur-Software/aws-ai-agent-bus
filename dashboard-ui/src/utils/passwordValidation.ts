/**
 * Password Validation Utility
 *
 * Enforces password policy:
 * - Minimum 8 characters
 * - At least one lowercase letter (a-z)
 * - At least one uppercase letter (A-Z)
 * - At least one digit (0-9)
 * - Optional: At least one special character (!@#$%^&*()_+-=[]{}|;':\",./<>?)
 */

export interface PasswordPolicy {
  minLength: number;
  requireLowercase: boolean;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  requirements: PasswordRequirement[];
  strength: PasswordStrength;
  score: number;
}

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | 'excellent';

// Default password policy matching the new security requirements
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Optional by default, configurable per organization
};

// Regex patterns for validation
const PATTERNS = {
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  numbers: /\d/,
  specialChars: /[!@#$%^&*()_+\-=\[\]{}|;':",./<>?\\`~]/,
};

/**
 * Validates a password against the specified policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult {
  const errors: string[] = [];
  const requirements: PasswordRequirement[] = [];

  // Length check
  const lengthMet = password.length >= policy.minLength;
  requirements.push({
    id: 'length',
    label: `At least ${policy.minLength} characters`,
    met: lengthMet,
  });
  if (!lengthMet) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  // Lowercase check
  if (policy.requireLowercase) {
    const lowercaseMet = PATTERNS.lowercase.test(password);
    requirements.push({
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: lowercaseMet,
    });
    if (!lowercaseMet) {
      errors.push('Password must contain at least one lowercase letter');
    }
  }

  // Uppercase check
  if (policy.requireUppercase) {
    const uppercaseMet = PATTERNS.uppercase.test(password);
    requirements.push({
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: uppercaseMet,
    });
    if (!uppercaseMet) {
      errors.push('Password must contain at least one uppercase letter');
    }
  }

  // Numbers check
  if (policy.requireNumbers) {
    const numbersMet = PATTERNS.numbers.test(password);
    requirements.push({
      id: 'numbers',
      label: 'At least one number (0-9)',
      met: numbersMet,
    });
    if (!numbersMet) {
      errors.push('Password must contain at least one number');
    }
  }

  // Special characters check
  if (policy.requireSpecialChars) {
    const specialMet = PATTERNS.specialChars.test(password);
    requirements.push({
      id: 'special',
      label: 'At least one special character (!@#$%^&*)',
      met: specialMet,
    });
    if (!specialMet) {
      errors.push('Password must contain at least one special character');
    }
  }

  // Calculate strength score and rating
  const { score, strength } = calculatePasswordStrength(password, policy);

  return {
    isValid: errors.length === 0,
    errors,
    requirements,
    strength,
    score,
  };
}

/**
 * Calculates password strength score and rating
 */
export function calculatePasswordStrength(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): { score: number; strength: PasswordStrength } {
  let score = 0;

  if (!password) {
    return { score: 0, strength: 'weak' };
  }

  // Base score from length
  if (password.length >= policy.minLength) score += 20;
  if (password.length >= 10) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 14) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety
  if (PATTERNS.lowercase.test(password)) score += 10;
  if (PATTERNS.uppercase.test(password)) score += 10;
  if (PATTERNS.numbers.test(password)) score += 10;
  if (PATTERNS.specialChars.test(password)) score += 15;

  // Bonus for mixed character types
  const typesUsed = [
    PATTERNS.lowercase.test(password),
    PATTERNS.uppercase.test(password),
    PATTERNS.numbers.test(password),
    PATTERNS.specialChars.test(password),
  ].filter(Boolean).length;

  if (typesUsed >= 3) score += 10;
  if (typesUsed === 4) score += 10;

  // Cap at 100
  score = Math.min(score, 100);

  // Determine strength level
  let strength: PasswordStrength;
  if (score >= 80) {
    strength = 'excellent';
  } else if (score >= 60) {
    strength = 'strong';
  } else if (score >= 40) {
    strength = 'good';
  } else if (score >= 20) {
    strength = 'fair';
  } else {
    strength = 'weak';
  }

  return { score, strength };
}

/**
 * Returns a user-friendly description for each strength level
 */
export function getStrengthDescription(strength: PasswordStrength): string {
  switch (strength) {
    case 'excellent':
      return 'Your password is very strong';
    case 'strong':
      return 'Your password is strong';
    case 'good':
      return 'Your password meets requirements';
    case 'fair':
      return 'Consider adding more complexity';
    case 'weak':
      return 'Password needs improvement';
    default:
      return '';
  }
}

/**
 * Returns color classes for strength visualization
 */
export function getStrengthColors(strength: PasswordStrength): {
  text: string;
  bg: string;
  border: string;
} {
  switch (strength) {
    case 'excellent':
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-500',
        border: 'border-green-500',
      };
    case 'strong':
      return {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-500',
        border: 'border-blue-500',
      };
    case 'good':
      return {
        text: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-500',
        border: 'border-yellow-500',
      };
    case 'fair':
      return {
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-500',
        border: 'border-orange-500',
      };
    case 'weak':
    default:
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500',
        border: 'border-red-500',
      };
  }
}

/**
 * Generates password suggestions based on validation result
 */
export function getPasswordSuggestions(result: PasswordValidationResult): string[] {
  const suggestions: string[] = [];
  const unmetRequirements = result.requirements.filter(r => !r.met);

  if (unmetRequirements.length > 0) {
    suggestions.push('Make sure your password has:');
    unmetRequirements.forEach(req => {
      suggestions.push(`- ${req.label}`);
    });
  }

  if (result.score < 60) {
    suggestions.push('To increase strength, consider:');
    if (result.score < 40) {
      suggestions.push('- Using a longer password (12+ characters recommended)');
    }
    suggestions.push('- Adding a mix of letters, numbers, and symbols');
    suggestions.push('- Avoiding common words or patterns');
  }

  return suggestions;
}

/**
 * Checks if two passwords match
 */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

/**
 * Validates confirm password field
 */
export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): { isValid: boolean; error: string | null } {
  if (!confirmPassword) {
    return { isValid: false, error: 'Please confirm your password' };
  }
  if (!passwordsMatch(password, confirmPassword)) {
    return { isValid: false, error: 'Passwords do not match' };
  }
  return { isValid: true, error: null };
}
