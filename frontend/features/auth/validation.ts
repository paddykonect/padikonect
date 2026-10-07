export const PHONE_REGEX = /^\d{10}$/;

// Returns the message to show under the phone field, or null when valid.
// A leading 0 (local format, e.g. 0803…) would become +2340…, so reject it.
export function phoneError(phoneLocal: string): string | null {
  if (!phoneLocal) return "Enter your phone number";
  if (phoneLocal.startsWith("0")) return "Leave out the leading 0 — e.g. 8031234567";
  if (!PHONE_REGEX.test(phoneLocal)) return "Phone number must be 10 digits";
  return null;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the message to show under the email field, or null when valid.
export function emailError(email: string): string | null {
  if (!email.trim()) return "Enter your email address";
  if (!EMAIL_REGEX.test(email.trim())) return "Enter a valid email address, e.g. name@example.com";
  return null;
}

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

// Latest date of birth that is still 18+ today, as YYYY-MM-DD (used as the
// date picker's max). The backend re-checks this.
export function latestAdultDob(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear() - 18, now.getMonth(), now.getDate()));
  return d.toISOString().slice(0, 10);
}

// Returns the message to show under the date-of-birth field, or null when valid.
export function dobError(dob: string, now = new Date()): string | null {
  if (!dob) return "Enter your date of birth";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob < "1900-01-01") return "Enter a valid date of birth";
  if (dob > latestAdultDob(now)) return "You must be 18 or older to join Padikonect";
  return null;
}

export function isSignupValid(fields: {
  fullName: string;
  phoneLocal: string;
  email: string;
  dateOfBirth: string;
  password: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}): boolean {
  return (
    fields.fullName.trim().length >= 2 &&
    phoneError(fields.phoneLocal) === null &&
    emailError(fields.email) === null &&
    dobError(fields.dateOfBirth) === null &&
    fields.password.length >= 8 &&
    fields.ageConfirmed &&
    fields.termsAccepted
  );
}
