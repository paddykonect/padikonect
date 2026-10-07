export interface PublicUser {
  id: string;
  fullName: string;
  // Null for accounts created with Google sign-in.
  phone: string | null;
  email: string;
  role: string;
  status: string;
}

export interface AuthSession {
  accessToken: string;
  user: PublicUser;
}

export interface SignupInput {
  fullName: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  password: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}

export interface LoginInput {
  identifier: string;
  password: string;
  keepMeLoggedIn?: boolean;
}

export type LoginResult = AuthSession | { requiresVerification: true; pendingToken: string };

export interface GoogleSignInInput {
  idToken: string;
  ageConfirmed?: boolean;
  termsAccepted?: boolean;
  keepMeLoggedIn?: boolean;
}

export type GoogleSignInResult = AuthSession & { isNewUser: boolean };
