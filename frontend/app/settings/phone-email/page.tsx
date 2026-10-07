"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { emailError, phoneError } from "@/features/auth/validation";
import * as profileApi from "@/features/profile/api";
import * as settingsApi from "@/features/settings/api";
import { SettingsScreen } from "@/features/settings/components";
import { ApiError } from "@/lib/api/client";

const toLocal = (phone: string | null) => (phone ?? "").replace(/^\+234/, "");

// Figma "Phone & email" (284:9466). Saving sends a code first; the new
// details are only stored once it's confirmed.
function PhoneEmailContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [original, setOriginal] = useState<{ phoneLocal: string; email: string } | null>(null);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    profileApi
      .getOwnProfile(accessToken)
      .then((p) => {
        setOriginal({ phoneLocal: toLocal(p.phone), email: p.email });
        setPhoneLocal(toLocal(p.phone));
        setEmail(p.email);
      })
      .catch(() => setError("Couldn't load your details."));
  }, [accessToken]);

  const phoneChanged = !!original && phoneLocal !== original.phoneLocal;
  const emailChanged = !!original && email.trim().toLowerCase() !== original.email.toLowerCase();
  const phoneErr = phoneChanged ? phoneError(phoneLocal) : null;
  const emailErr = emailChanged ? emailError(email) : null;
  const canSave = (phoneChanged || emailChanged) && !phoneErr && !emailErr;

  async function requestCode() {
    if (!accessToken || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      const res = await settingsApi.requestContactChange(accessToken, {
        ...(phoneChanged && { phone: `+234${phoneLocal}` }),
        ...(emailChanged && { email: email.trim() }),
      });
      setSentTo(res.sentTo);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!accessToken || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await settingsApi.verifyContactChange(accessToken, code);
      router.replace("/settings?saved=contact");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't verify that code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!accessToken) return;
    setError(null);
    try {
      setSentTo((await settingsApi.resendContactChange(accessToken)).sentTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't resend the code.");
    }
  }

  if (sentTo) {
    return (
      <SettingsScreen
        title="Phone & email"
        footer={
          <>
            <Button onClick={() => void verify()} disabled={code.length !== 6} loading={busy}>
              Confirm change
            </Button>
            <Button variant="text" onClick={() => setSentTo(null)}>
              Back
            </Button>
          </>
        }
      >
        <p className="font-body text-sm leading-5 text-body-text">
          Enter the 6-digit code we sent to <span className="font-bold text-heading">{sentTo}</span> to save your new details.
        </p>
        <OtpInput value={code} onChange={setCode} error={!!error} disabled={busy} />
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        <button type="button" onClick={() => void resend()} className="self-start font-body text-[13px] font-bold text-heading underline">
          Resend code
        </button>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen
      title="Phone & email"
      footer={
        <Button onClick={() => void requestCode()} disabled={!canSave} loading={busy}>
          Save changes
        </Button>
      }
    >
      <PhoneField
        aria-label="Phone number"
        placeholder="81 234 567 89"
        value={phoneLocal}
        onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
        error={phoneErr ?? undefined}
        disabled={!original}
      />
      <TextField
        type="email"
        aria-label="Email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailErr ?? undefined}
        disabled={!original}
      />
      <p className="rounded-xl bg-card px-3.5 py-3 font-body text-[12.5px] leading-[18.75px] text-body-text">
        Changing your phone or email will send a verification code to confirm the new details before they&apos;re saved.
      </p>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </SettingsScreen>
  );
}

export default function PhoneEmailPage() {
  return (
    <RequireAuth>
      <PhoneEmailContent />
    </RequireAuth>
  );
}
