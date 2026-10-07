"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as settingsApi from "@/features/settings/api";
import { SettingsScreen } from "@/features/settings/components";
import { APP_NAME } from "@/features/settings/content";
import { ApiError } from "@/lib/api/client";

const GOES_WITH_IT = [
  "Your profile, taste picks & padi connections",
  "Hangouts you've hosted or joined, and chat history",
  "Padi Rewards progress and any pending invites",
  "Your phone number & email on file",
];

// Figma "Delete account" (304:5726).
function DeleteAccountContent() {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!accessToken || !understood) return;
    setBusy(true);
    setError(null);
    try {
      await settingsApi.deleteAccount(accessToken);
      // The session is already gone server-side; this just clears local state.
      await logout();
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <SettingsScreen
      title="Delete account"
      footer={
        <>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={!understood || busy}
            className="w-full rounded-full bg-error px-5 py-4 text-center font-body text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
          <button type="button" onClick={() => router.back()} className="w-full rounded-full px-5 py-4 text-center font-body text-sm font-medium text-heading">
            Cancel
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2.5 px-2 pb-1 pt-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-[rgba(179,38,30,0.12)]">
          <Image src="/icons/settings/warning.svg" alt="" width={26} height={26} />
        </span>
        <h2 className="font-heading text-[19px] font-bold leading-[26px] text-heading">This can&apos;t be undone</h2>
        <p className="font-body text-[13px] leading-[18px] text-body-text">
          Deleting your account permanently removes your {APP_NAME} profile. Here&apos;s what goes with it:
        </p>
      </div>

      <ul className="flex flex-col rounded-2xl bg-card px-3.5 py-1.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
        {GOES_WITH_IT.map((item) => (
          <li key={item} className="flex items-start gap-2.5 py-2.5">
            <Image src="/icons/settings/cross.svg" alt="" width={16} height={16} className="mt-px shrink-0" />
            <span className="font-body text-[13px] leading-[18px] text-heading">{item}</span>
          </li>
        ))}
      </ul>

      <p className="font-body text-xs leading-4 text-body-text">
        If you&apos;re just taking a break, you can log out instead and come back anytime — your account stays intact.
      </p>

      <label className="flex items-center gap-2.5 rounded-[14px] bg-card p-3.5 px-[18px]">
        <Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span className="font-body text-[13px] leading-[18px] text-body-text">I understand this is permanent and my account cannot be recovered.</span>
      </label>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </SettingsScreen>
  );
}

export default function DeleteAccountPage() {
  return (
    <RequireAuth>
      <DeleteAccountContent />
    </RequireAuth>
  );
}
