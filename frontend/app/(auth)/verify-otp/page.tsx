"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import * as authApi from "@/features/auth/api";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    // sessionStorage only exists client-side, so this genuinely can't be
    // read during the initial render (SSR) — useEffect + setState is the
    // correct pattern here, not something to restructure around.
    const token = sessionStorage.getItem("pk_pending_token");
    if (!token) {
      router.replace("/signup");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingToken(token);
    setEmail(sessionStorage.getItem("pk_pending_email"));
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleVerify() {
    if (!pendingToken || code.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await authApi.verifySignupOtp(pendingToken, code);
      setSession(session);
      sessionStorage.removeItem("pk_pending_token");
      sessionStorage.removeItem("pk_pending_email");
      router.push("/taste-picker");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!pendingToken || cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await authApi.resendSignupOtp(pendingToken);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-1">
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => router.back()} className="flex size-9 items-center justify-center rounded-full bg-white" aria-label="Back">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
        </button>

        <div className="flex flex-col gap-2.5">
          <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Enter the code</h1>
          <div className="flex items-center justify-between gap-2.5">
            <p className="flex-1 font-body text-sm text-body-text">
              {email ? `We sent a 6-digit code to ${email}` : "We sent a 6-digit code to your email"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <OtpInput value={code} onChange={setCode} error={!!error} disabled={submitting} />
          <p className="font-body text-[13px] text-body-text">
            {cooldown > 0 ? (
              <>
                {"Resend code in "}
                <span className="text-heading">
                  0:{cooldown.toString().padStart(2, "0")}
                </span>
              </>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending} className="font-bold text-heading underline">
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}
          </p>
        </div>

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </div>

      <Button type="button" variant="primary" disabled={code.length !== 6} loading={submitting} onClick={handleVerify}>
        Verify
      </Button>
    </div>
  );
}
