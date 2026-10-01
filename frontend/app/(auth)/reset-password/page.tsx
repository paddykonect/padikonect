"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordField } from "@/components/ui/PasswordField";
import * as authApi from "@/features/auth/api";
import { ApiError } from "@/lib/api/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // sessionStorage only exists client-side, so this genuinely can't be
    // read during the initial render (SSR) — useEffect + setState is the
    // correct pattern here, not something to restructure around.
    const token = sessionStorage.getItem("pk_reset_token");
    if (!token) {
      router.replace("/forgot-password");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingToken(token);
  }, [router]);

  const valid = code.length === 6 && newPassword.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken || !valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(pendingToken, code, newPassword);
      sessionStorage.removeItem("pk_reset_token");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="font-heading text-2xl font-bold text-heading">Password updated</h1>
        <p className="font-body text-sm text-body-text">Taking you to log in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Enter the code</h1>
        <p className="font-body text-sm text-body-text">Enter the 6-digit code we sent you, then choose a new password.</p>

        <OtpInput value={code} onChange={setCode} disabled={submitting} />
        <PasswordField placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </div>

      <Button type="submit" variant="primary" disabled={!valid} loading={submitting}>
        Reset password
      </Button>
    </form>
  );
}
