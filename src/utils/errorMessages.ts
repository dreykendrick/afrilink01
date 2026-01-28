/**
 * Central error message mapping utility.
 * Converts technical/raw error messages into user-friendly, calm, actionable text.
 * 
 * Usage:
 *   import { getUserFriendlyError } from '@/utils/errorMessages';
 *   toast({ title: 'Error', description: getUserFriendlyError(error.message) });
 */

interface ErrorMapping {
  pattern: RegExp;
  message: string;
}

const errorMappings: ErrorMapping[] = [
  // Network / Fetch errors
  { pattern: /failed to fetch|network|net::err|econnrefused|enotfound/i, message: 'Network problem. Please check your internet connection and try again.' },
  { pattern: /timeout|timed out/i, message: 'The request took too long. Please try again.' },

  // OTP / SMS errors
  { pattern: /otp|verification code|sms delivery|send.*code/i, message: "We couldn't send the verification code right now. Please try again in a moment." },
  { pattern: /invalid.*code|expired.*code|no valid otp/i, message: 'The code is invalid or has expired. Please request a new one.' },

  // Authentication errors
  { pattern: /invalid login credentials/i, message: 'Invalid email or password. Please check and try again.' },
  { pattern: /email not confirmed/i, message: 'Please verify your email before signing in.' },
  { pattern: /user already registered/i, message: 'An account with this email already exists. Please sign in instead.' },
  { pattern: /jwt|token.*expired|session.*expired/i, message: 'Your session has expired. Please sign in again.' },
  { pattern: /not authenticated|log ?in.*required/i, message: 'Please sign in to continue.' },

  // Permission / Authorization errors
  { pattern: /permission denied|403|unauthorized|forbidden/i, message: "You don't have permission to perform this action." },
  { pattern: /42501/i, message: 'Permission denied. Please ensure you are signed in correctly.' },

  // Validation errors
  { pattern: /missing.*field|required.*field|fill.*all/i, message: 'Please fill in all required fields.' },
  { pattern: /invalid.*email/i, message: 'Please enter a valid email address.' },
  { pattern: /invalid.*phone/i, message: 'Please enter a valid phone number.' },
  { pattern: /password.*short|password.*6/i, message: 'Password must be at least 6 characters.' },

  // Duplicate / Conflict errors
  { pattern: /23505|already exists|duplicate/i, message: 'This item already exists. Please use a different name.' },

  // Server / Unknown errors
  { pattern: /500|internal.*error|server.*error/i, message: 'Something went wrong on our side. Please try again later.' },
  { pattern: /edge function|non-2xx|status code/i, message: 'Something went wrong. Please try again.' },
];

/**
 * Converts a technical error message to a user-friendly message.
 * Falls back to a generic friendly message if no pattern matches.
 */
export function getUserFriendlyError(error: unknown, fallback?: string): string {
  const errorMessage = extractErrorMessage(error);
  
  // Log the original error for debugging (console only)
  console.error('[Error]', errorMessage);

  // Check against known patterns
  for (const mapping of errorMappings) {
    if (mapping.pattern.test(errorMessage)) {
      return mapping.message;
    }
  }

  // Return fallback or generic message
  return fallback || 'Something went wrong. Please try again.';
}

/**
 * Extracts a string message from various error types.
 */
function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.error_description === 'string') return obj.error_description;
  }
  return String(error);
}

/**
 * Specific error messages for common scenarios.
 * Use these directly when you know the exact context.
 */
export const friendlyErrors = {
  network: 'Network problem. Please check your internet connection and try again.',
  otpSend: "We couldn't send the verification code right now. Please try again in a moment.",
  otpInvalid: 'The code is invalid or has expired. Please request a new one.',
  loginFailed: 'Login failed. Please check your details and try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  permissionDenied: "You don't have permission to perform this action.",
  serverError: 'Something went wrong on our side. Please try again later.',
  generic: 'Something went wrong. Please try again.',
} as const;
