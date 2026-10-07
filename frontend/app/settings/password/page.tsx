"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { passwordRules } from "@/features/auth/validation";
import * as settingsApi from "@/features/settings/api";
import { SettingsScreen } from "@/features/settings/components";
import { ApiError } from "@/lib/api/client";

// Figma "change password" (301:4531). Like signup, the badges are live
// guidance; the real rule is the backend's 8+ characters.
function ChangePasswordContent() {
  const router = useRouter();
  const { accessToken, replaceAccessToken } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && next.length >= 8 && confirm === next;

  async function submit() {
    if (!accessToken || !valid) return;
    setBusy(true);
    setError(null);
    setCurrentError(null);
    try {
      const { accessToken: token } = await settingsApi.changePassword(accessToken, { currentPassword: current, newPassword: next });
      replaceAccessToken(token);
      router.replace("/settings?saved=password");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CURRENT_PASSWORD") setCurrentError(err.message);
      else setError(err instanceof ApiError ? err.message : "Couldn't update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsScreen
      title="Change password"
      footer={
        <Button onClick={() => void submit()} disabled={!valid} loading={busy}>
          Update password
        </Button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordField
          placeholder="Current password"
          aria-label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={currentError ?? undefined}
        />
        <PasswordField
          placeholder="New password"
          aria-label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={next.length > 0 && next.length < 8 ? "Use at least 8 characters" : undefined}
        />
        <PasswordField
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords don't match" : undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Badge met={passwordRules.length(next)}>6 characters</Badge>
          <Badge met={passwordRules.uppercase(next)}>Uppercase</Badge>
          <Badge met={passwordRules.lowercase(next)}>Lowercase</Badge>
          <Badge met={passwordRules.number(next)}>Number</Badge>
          <Badge met={passwordRules.special(next)}>Special character</Badge>
        </div>
        <Link href="/forgot-password" className="self-start font-body text-[13px] font-bold leading-[18px] text-heading">
          Forgot your current password?
        </Link>
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {/* Lets Enter submit; the visible button lives in the footer. */}
        <button type="submit" hidden />
      </form>
    </SettingsScreen>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordContent />
    </RequireAuth>
  );
}
