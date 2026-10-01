import { apiRequest } from "@/lib/api/client";
import { AuthSession, LoginInput, LoginResult, SignupInput } from "./types";

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

/** Relies on the httpOnly refresh cookie the backend sets — no body needed. */
export function refreshSession() {
  return apiRequest<{ accessToken: string }>("/auth/refresh", { method: "POST", body: {} });
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { body: {} });
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
