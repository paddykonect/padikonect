"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import * as authApi from "@/features/auth/api";
import { ApiError } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Backend always returns the same 200 shape regardless of whether the
      // identifier matches an account (enumeration-safe) — so this call
      // never itself reveals account existence.
      const { pendingToken } = await authApi.forgotPassword(identifier);
      sessionStorage.setItem("pk_reset_token", pendingToken);
      router.push("/reset-password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-6">
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Reset your password</h1>
        <p className="font-body text-sm text-body-text">Enter your phone or email and we&apos;ll send you a code to reset your password.</p>

        <TextField placeholder="Phone or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </div>

      <Button type="submit" variant="primary" disabled={!identifier.trim()} loading={submitting}>
        Send code
      </Button>
    </form>
  );
}
