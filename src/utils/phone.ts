// Tanzania phone validation utility
// Accepts: +255XXXXXXXXX (12 digits total) or 0XXXXXXXXX (10 digits)
// Rejects: too short/too long/letters

export interface PhoneValidationResult {
  isValid: boolean;
  error: string | null;
  normalized: string | null;
}

export const validateTZPhone = (phone: string): PhoneValidationResult => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: 'Phone number is required', normalized: null };
  }

  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check for letters or invalid characters
  if (!/^[\d+]+$/.test(cleaned)) {
    return { isValid: false, error: 'Phone number contains invalid characters', normalized: null };
  }

  // +255XXXXXXXXX format (12 chars: +255 + 9 digits)
  if (cleaned.startsWith('+255')) {
    if (cleaned.length !== 13) {
      return { isValid: false, error: 'Invalid phone format. Use +255XXXXXXXXX', normalized: null };
    }
    return { isValid: true, error: null, normalized: cleaned };
  }

  // 0XXXXXXXXX format (10 digits)
  if (cleaned.startsWith('0')) {
    if (cleaned.length !== 10) {
      return { isValid: false, error: 'Invalid phone format. Use 0XXXXXXXXX', normalized: null };
    }
    // Normalize to +255 format
    return { isValid: true, error: null, normalized: '+255' + cleaned.slice(1) };
  }

  // 255XXXXXXXXX format without + (12 digits)
  if (cleaned.startsWith('255')) {
    if (cleaned.length !== 12) {
      return { isValid: false, error: 'Invalid phone format. Use +255XXXXXXXXX', normalized: null };
    }
    return { isValid: true, error: null, normalized: '+' + cleaned };
  }

  return { isValid: false, error: 'Invalid phone format. Use +255XXXXXXXXX or 0XXXXXXXXX', normalized: null };
};
