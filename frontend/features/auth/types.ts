export interface PublicUser {
  id: string;
  fullName: string;
  phone: string;
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
