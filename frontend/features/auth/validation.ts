export const PHONE_REGEX = /^\d{10}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Figma's password-strength badges (6 chars / upper / lower / number /
// special) are richer than what the PRD and backend actually require
// ("password (8+ characters)" — see SignupDto, @MinLength(8) only). Shown
// here as live visual feedback only; submission is gated on the real
// backend rule (>=8 chars), not on satisfying every badge.
export const passwordRules = {
  length: (v: string) => v.length >= 6,
  uppercase: (v: string) => /[A-Z]/.test(v),
  lowercase: (v: string) => /[a-z]/.test(v),
  number: (v: string) => /\d/.test(v),
  special: (v: string) => /[^A-Za-z0-9]/.test(v),
};

export function isSignupValid(fields: {
  fullName: string;
  phoneLocal: string;
  email: string;
  password: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}): boolean {
  return (
    fields.fullName.trim().length >= 2 &&
    PHONE_REGEX.test(fields.phoneLocal) &&
    EMAIL_REGEX.test(fields.email) &&
    fields.password.length >= 8 &&
    fields.ageConfirmed &&
    fields.termsAccepted
  );
}
