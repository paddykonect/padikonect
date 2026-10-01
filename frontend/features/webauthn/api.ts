import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { apiRequest } from "@/lib/api/client";
import { AuthSession } from "@/features/auth/types";

export function getRegistrationOptions(accessToken: string) {
  return apiRequest<PublicKeyCredentialCreationOptionsJSON>("/auth/webauthn/registration/options", {
    method: "POST",
    accessToken,
  });
}

export function verifyRegistration(accessToken: string, response: RegistrationResponseJSON) {
  return apiRequest<{ message: string }>("/auth/webauthn/registration/verify", {
    accessToken,
    body: { response },
  });
}

export function getAuthenticationOptions(identifier: string) {
  return apiRequest<{ flowId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
    "/auth/webauthn/authentication/options",
    { body: { identifier } },
  );
}

export function verifyAuthentication(flowId: string, response: AuthenticationResponseJSON) {
  return apiRequest<AuthSession>("/auth/webauthn/authentication/verify", {
    body: { flowId, response },
  });
}
