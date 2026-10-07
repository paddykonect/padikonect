import { apiRequest } from "@/lib/api/client";
import { AuthSession, GoogleSignInInput, GoogleSignInResult, LoginInput, LoginResult, SignupInput } from "./types";

export function signup(input: SignupInput) {
  return apiRequest<{ pendingToken: string }>("/auth/signup", { body: input });
}

export function resendSignupOtp(pendingToken: string) {
  return apiRequest<{ message: string }>("/auth/otp/resend", { body: { pendingToken } });
}

export function verifySignupOtp(pendingToken: string, code: string) {
  return apiRequest<AuthSession>("/auth/otp/verify", { body: { pendingToken, code } });
}

export function login(input: LoginInput) {
  return apiRequest<LoginResult>("/auth/login", { body: input });
}

export function googleSignIn(input: GoogleSignInInput) {
  return apiRequest<GoogleSignInResult>("/auth/google", { body: input });
}

let inFlightRefresh: Promise<AuthSession> | null = null;

/**
 * Relies on the httpOnly refresh cookie the backend sets — no body needed.
 * Concurrent callers share one request: refresh tokens rotate on every use,
 * so two parallel refreshes (e.g. React Strict Mode's double effect) would
 * present the same token twice, which the backend treats as token theft and
 * revokes the whole session.
 */
export function refreshSession() {
  inFlightRefresh ??= apiRequest<AuthSession>("/auth/refresh", { method: "POST", body: {} }).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { body: {} });
}

/** Ends every session on every device, this one included. */
export function logoutAll(accessToken: string) {
  return apiRequest<{ message: string }>("/auth/logout-all", { body: {}, accessToken });
}

export function forgotPassword(identifier: string) {
  return apiRequest<{ pendingToken: string }>("/auth/forgot-password", { body: { identifier } });
}

export function resendForgotPasswordOtp(pendingToken: string) {
  return apiRequest<{ message: string }>("/auth/forgot-password/resend", { body: { pendingToken } });
}

export function resetPassword(pendingToken: string, code: string, newPassword: string) {
  return apiRequest<{ message: string }>("/auth/reset-password", { body: { pendingToken, code, newPassword } });
}
