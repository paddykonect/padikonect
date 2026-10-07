"use client";

import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as webauthnApi from "@/features/webauthn/api";
import { ApiError } from "@/lib/api/client";

// Figma nodes 250:8433 ("Biometric option"), 269:4654/269:4738 ("Biometric
// finger print option"). Figma-only addition, not in the PRD — built at the
// user's explicit request as a full WebAuthn/passkey slice. Shown once after
// a successful password login (not during fresh signup — see the Figma
// canvas layout this was found on, which groups it with Login/forgot-password,
// not with Taste Picker/Location).

type Method = "fingerprint" | "faceid";

function promptedKey(userId: string): string {
  return `pk_biometric_prompted_${userId}`;
}

function markPrompted(userId: string) {
  try {
    localStorage.setItem(promptedKey(userId), "1");
  } catch {
    // Private browsing / storage disabled — worst case the prompt reappears next login.
  }
}

const COPY: Record<Method, { icon: string; heading: string; body: string; cta: string }> = {
  fingerprint: {
    icon: "/icons/fingerprint-large.svg",
    heading: "Enable Fingerprint Login",
    body: "Speed up your sign-in by enabling fingerprint authentication. Just a quick tap and you're in — no need to type your password every time.",
    cta: "Use Finger print",
  },
  faceid: {
    icon: "/icons/face-id-large.svg",
    heading: "Enable Face ID Login",
    body: "Speed up your sign-in by enabling Face ID. Just a quick glance and you're in — no need to type your password every time.",
    cta: "Use Face ID",
  },
};

function EnableBiometricContent() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [checking, setChecking] = useState(true);
  const [method, setMethod] = useState<Method | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function proceed() {
    if (user) markPrompted(user.id);
    router.push("/home");
  }

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) return;
      let alreadyPrompted = false;
      try {
        alreadyPrompted = localStorage.getItem(promptedKey(user.id)) === "1";
      } catch {
        alreadyPrompted = false;
      }
      if (alreadyPrompted || !browserSupportsWebAuthn()) {
        if (!cancelled) proceed();
        return;
      }
      const available = await platformAuthenticatorIsAvailable();
      if (!available) {
        if (!cancelled) proceed();
        return;
      }
      if (!cancelled) setChecking(false);
    }
    void check();
    return () => {
      cancelled = true;
    };
    // proceed()/router/user are stable enough for this mount-time capability check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleEnable() {
    if (!accessToken || !method || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const options = await webauthnApi.getRegistrationOptions(accessToken);
      const response = await startRegistration({ optionsJSON: options });
      await webauthnApi.verifyRegistration(accessToken, response);
      proceed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not enable biometric login on this device.");
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="font-body text-sm text-body-text">Loading…</p>
      </div>
    );
  }

  if (!method) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Secure your access</h1>
          <p className="font-body text-sm text-body-text">Choose how you want to quickly transact on your Paddykonect app</p>
        </div>

        <div className="flex flex-col gap-[18px] rounded-field border border-border bg-card p-4">
          <button type="button" className="flex items-center gap-2" onClick={() => setMethod("faceid")}>
            <Image src="/icons/face-id.svg" alt="" width={24} height={24} />
            <span className="font-body text-sm font-medium text-heading">Face ID</span>
          </button>
          <div className="h-px w-full bg-border" />
          <button type="button" className="flex items-center gap-2" onClick={() => setMethod("fingerprint")}>
            <Image src="/icons/fingerprint.svg" alt="" width={24} height={24} />
            <span className="font-body text-sm font-medium text-heading">Touch ID</span>
          </button>
        </div>

        <Button type="button" variant="text" onClick={proceed}>
          Maybe later
        </Button>
      </div>
    );
  }

  const copy = COPY[method];

  return (
    <div className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-[193px] items-center justify-center rounded-full bg-card">
          <Image src={copy.icon} alt="" width={115} height={115} />
        </div>
        <h1 className="font-heading text-xl font-bold leading-[28px] text-heading">{copy.heading}</h1>
        <p className="font-body text-sm leading-[21px] text-body-text">{copy.body}</p>
      </div>

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button type="button" variant="primary" loading={submitting} onClick={() => void handleEnable()}>
          {copy.cta}
        </Button>
        <Button type="button" variant="text" onClick={proceed}>
          Maybe later
        </Button>
      </div>
    </div>
  );
}

export default function EnableBiometricPage() {
  return (
    <RequireAuth>
      <EnableBiometricContent />
    </RequireAuth>
  );
}
