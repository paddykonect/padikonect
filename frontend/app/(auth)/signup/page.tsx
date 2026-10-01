"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as authApi from "@/features/auth/api";
import { isSignupValid, passwordRules } from "@/features/auth/validation";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = isSignupValid({ fullName, phoneLocal, email, password, ageConfirmed, termsAccepted });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { pendingToken } = await authApi.signup({
        fullName,
        phone: `+234${phoneLocal}`,
        email,
        password,
        ageConfirmed,
        termsAccepted,
      });
      sessionStorage.setItem("pk_pending_token", pendingToken);
      sessionStorage.setItem("pk_pending_email", email);
      router.push("/verify-otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-1">
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Create your account</h1>

        <TextField placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <PhoneField placeholder="Enter phone number" value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))} required />
        <TextField type="email" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} icon={<MailIcon />} required />
        <PasswordField placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge met={passwordRules.length(password)}>6 characters</Badge>
            <Badge met={passwordRules.uppercase(password)}>Uppercase</Badge>
            <Badge met={passwordRules.lowercase(password)}>Lowercase</Badge>
            <Badge met={passwordRules.number(password)}>Number</Badge>
            <Badge met={passwordRules.special(password)}>Special character</Badge>
          </div>
        </div>

        <label className="flex items-center gap-2.5 px-1">
          <Checkbox checked={ageConfirmed && termsAccepted} onChange={(e) => { setAgeConfirmed(e.target.checked); setTermsAccepted(e.target.checked); }} />
          <span className="font-body text-xs text-body-text">
            {"I'm 18+ and I agree to the "}
            <span className="text-heading underline">Terms &amp; Privacy Policy.</span>
          </span>
        </label>

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" variant="primary" disabled={!valid} loading={submitting}>
          Continue
        </Button>
        <Link href="/login" className="w-full">
          <Button type="button" variant="text">
            {"Already have account? "}
            <span className="font-bold">Log in</span>
          </Button>
        </Link>
      </div>
    </form>
  );
}

function MailIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-body-text">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
