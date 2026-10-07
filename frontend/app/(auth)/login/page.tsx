"use client";

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import * as authApi from "@/features/auth/api";
import { GoogleButton } from "@/features/auth/GoogleButton";
import { useAuth } from "@/features/auth/auth-context";
import * as webauthnApi from "@/features/webauthn/api";
import { ApiError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = useState(false);

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    platformAuthenticatorIsAvailable()
      .then((available) => setBiometricAvailable(available))
      .catch(() => setBiometricAvailable(false));
  }, []);

  const valid = identifier.trim().length > 0 && password.length > 0;

  async function handleBiometricLogin() {
    if (!identifier.trim() || biometricSubmitting) return;
    setBiometricSubmitting(true);
    setError(null);
    try {
      const { flowId, options } = await webauthnApi.getAuthenticationOptions(identifier.trim());
      const response = await startAuthentication({ optionsJSON: options });
      const session = await webauthnApi.verifyAuthentication(flowId, response);
      setSession(session);
      router.push("/home");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === "WEBAUTHN_NOT_ENROLLED"
            ? "Biometric login isn't set up for this account yet. Log in with your password first."
            : err.message,
        );
      } else {
        setError("Could not complete biometric login on this device.");
      }
    } finally {
      setBiometricSubmitting(false);
    }
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    try {
      const result = await authApi.googleSignIn({ idToken, keepMeLoggedIn });
      setSession(result);
      router.push("/enable-biometric");
    } catch (err) {
      if (err instanceof ApiError && err.code === "GOOGLE_SIGNUP_CONSENT_REQUIRED") {
        setError("There's no Paddykonect account for this Google account yet. Sign up first.");
      } else {
        setError(err instanceof ApiError ? err.message : "Google login failed. Please try again.");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.login({ identifier, password, keepMeLoggedIn });
      if ("requiresVerification" in result) {
        sessionStorage.setItem("pk_pending_token", result.pendingToken);
        sessionStorage.setItem("pk_pending_email", identifier);
        router.push("/verify-otp");
        return;
      }
      setSession(result);
      router.push("/enable-biometric");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ACCOUNT_LOCKED" && typeof err.params?.retryAfterSeconds === "number") {
          const minutes = Math.ceil(err.params.retryAfterSeconds / 60);
          setError(`Too many failed attempts. Please try again in ${minutes} minute(s).`);
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Welcome back</h1>

        <TextField
          placeholder="Phone or email"
          value={identifier}
          onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
          required
        />
        <PasswordField
          placeholder="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          required
        />

        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2.5">
            <Checkbox checked={keepMeLoggedIn} onChange={(e) => setKeepMeLoggedIn(e.target.checked)} />
            <span className="font-body text-xs text-body-text">Keep me logged in</span>
          </label>
          <Link href="/forgot-password" className="font-body text-xs font-bold text-heading underline">
            Forgot password
          </Link>
        </div>

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" variant="primary" disabled={!valid} loading={submitting}>
          Log in
        </Button>
        <GoogleButton text="signin_with" onCredential={(t) => void handleGoogle(t)} />
        {biometricAvailable && (
          <Button
            type="button"
            variant="text"
            disabled={!identifier.trim()}
            loading={biometricSubmitting}
            onClick={() => void handleBiometricLogin()}
          >
            Log in with Face ID / Touch ID
          </Button>
        )}
        <Link href="/signup" className="w-full">
          <Button type="button" variant="text">
            {"Don't have an account? "}
            <span className="font-bold">Sign up</span>
          </Button>
        </Link>
      </div>
    </form>
  );
}
