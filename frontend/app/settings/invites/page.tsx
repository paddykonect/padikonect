"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as profileApi from "@/features/profile/api";
import { InvitePolicy } from "@/features/profile/types";
import { SettingsScreen } from "@/features/settings/components";
import { APP_NAME, INVITE_POLICY_LABEL } from "@/features/settings/content";
import { ApiError } from "@/lib/api/client";

const OPTIONS: Array<{ id: InvitePolicy; hint: string }> = [
  { id: "EVERYONE", hint: `Any ${APP_NAME} user can invite you` },
  { id: "PADIS_ONLY", hint: "Only people you've connected with before" },
  { id: "NO_ONE", hint: "You can still invite others yourself" },
];

// Figma "Who can invite me" (301:4713). Saves as soon as you pick.
function InvitesContent() {
  const { accessToken } = useAuth();
  const [policy, setPolicy] = useState<InvitePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    profileApi
      .getOwnProfile(accessToken)
      .then((p) => setPolicy(p.invitePolicy))
      .catch(() => setError("Couldn't load your setting."));
  }, [accessToken]);

  async function choose(next: InvitePolicy) {
    if (!accessToken || next === policy) return;
    const previous = policy;
    setPolicy(next);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, { invitePolicy: next });
    } catch (err) {
      setPolicy(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't save that. Please try again.");
    }
  }

  return (
    <SettingsScreen title="Who can invite me">
      <p className="font-body text-sm leading-5 text-body-text">
        Choose who can send you hangout invites. This doesn&apos;t affect requests to join public hangouts.
      </p>
      <div role="radiogroup" aria-label="Who can invite me" className="flex flex-col overflow-hidden rounded-2xl bg-card [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={policy === o.id}
            disabled={policy === null}
            onClick={() => void choose(o.id)}
            className="flex items-center gap-3 p-3.5 text-left"
          >
            <Image src={policy === o.id ? "/icons/radio-selected.svg" : "/icons/radio-normal.svg"} alt="" width={24} height={24} className="dark-invert" />
            <span className="flex flex-col gap-0.5">
              <span className="font-body text-sm text-heading">{INVITE_POLICY_LABEL[o.id]}</span>
              <span className="font-body text-[12.5px] text-body-text">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </SettingsScreen>
  );
}

export default function InvitesPage() {
  return (
    <RequireAuth>
      <InvitesContent />
    </RequireAuth>
  );
}
