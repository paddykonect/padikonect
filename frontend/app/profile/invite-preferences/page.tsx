"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { CheckIcon } from "@/features/hangouts/components/icons";
import { FlowScreen } from "@/features/hangouts/components/FlowScreen";
import * as profileApi from "@/features/profile/api";
import { RequireCountry } from "@/features/profile/require-country";
import { useOwnProfile } from "@/features/profile/use-own-profile";
import { ApiError } from "@/lib/api/client";

const PLAN_OPTIONS = ["Coffee", "Board games", "Food spots", "City walks", "Chill hangouts", "Arts & culture", "Live music", "Outdoor fun"];

// Figma node 419:xxxx ("Invitation preferences").
function InvitePreferencesContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile, setProfile } = useOwnProfile();
  const [plans, setPlans] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlans(profile.invitePlans);
    setLoaded(true);
  }, [profile, loaded]);

  const options = [...PLAN_OPTIONS, ...plans.filter((p) => !PLAN_OPTIONS.includes(p))];

  function toggle(plan: string) {
    setPlans((p) => (p.includes(plan) ? p.filter((x) => x !== plan) : [...p, plan]));
  }

  function addCustom() {
    const t = custom.trim();
    if (!t) return;
    setPlans((p) => (p.includes(t) ? p : [...p, t]));
    setCustom("");
    setAddOpen(false);
  }

  async function save() {
    if (!accessToken || saving) return;
    setSaving(true);
    setError(null);
    try {
      setProfile(await profileApi.updateOwnProfile(accessToken, { invitePlans: plans }));
      router.push("/profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your preferences.");
      setSaving(false);
    }
  }

  return (
    <FlowScreen
      title="Invitation preferences"
      backHref="/profile"
      footer={
        <Button type="button" variant="primary" loading={saving} onClick={() => void save()}>
          Save preferences
        </Button>
      }
    >
      <h1 className="font-heading text-2xl font-bold leading-8 text-heading">What should we invite you for?</h1>
      <p className="font-body text-sm text-body-text">Let your padis know which plans you&apos;re up for.</p>

      {/* Anything — Surprise me */}
      <button type="button" onClick={() => setPlans([])} className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left ${plans.length === 0 ? "border-accent bg-accent/20" : "border-border bg-card"}`}>
        <span className="text-2xl leading-none">🎉</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-body text-sm font-bold text-heading">Anything — Surprise me</span>
          <span className="font-body text-xs text-body-text">I&apos;m open to every kind of plan.</span>
        </span>
        <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${plans.length === 0 ? "border-accent" : "border-border"}`}>
          {plans.length === 0 && <span className="size-2.5 rounded-full bg-accent" />}
        </span>
      </button>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-heading">Or pick your kind of plans</h2>
        <span className="font-body text-[13px] text-body-text">{plans.length} selected</span>
      </div>
      <p className="-mt-2 font-body text-xs text-body-text">Choose as many as you like.</p>

      <div className="flex flex-wrap gap-2">
        {options.map((plan) => {
          const on = plans.includes(plan);
          return (
            <button
              key={plan}
              type="button"
              onClick={() => toggle(plan)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 font-body text-[13px] ${on ? "bg-ink font-bold text-white" : "border border-border bg-card text-heading"}`}
            >
              {on && <CheckIcon size={13} />}
              {plan}
            </button>
          );
        })}
        <button type="button" onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-full border border-dashed border-body-text px-4 py-2.5 font-body text-[13px] text-body-text">
          + Add your own
        </button>
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl bg-card p-3.5">
        <span className="text-lg leading-none">✨</span>
        <p className="font-body text-xs text-body-text">More your thing, less guesswork. You can change these anytime.</p>
      </div>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      <p className="text-center font-body text-xs text-body-text">Your choices appear on your profile when saved.</p>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add your own interest" description="Tell us what you're into and we'll add it to your picks.">
        <TextField placeholder="e.g. Karaoke nights" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={40} />
        <div className="flex gap-3">
          <Button type="button" variant="text" className="flex-1 border border-border" onClick={() => { setCustom(""); setAddOpen(false); }}>
            Cancel
          </Button>
          <Button type="button" variant="primary" className="flex-1" disabled={!custom.trim()} onClick={addCustom}>
            Add interest
          </Button>
        </div>
      </BottomSheet>
    </FlowScreen>
  );
}

export default function InvitePreferencesPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <InvitePreferencesContent />
      </RequireCountry>
    </RequireAuth>
  );
}
