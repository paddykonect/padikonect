"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RadioListItem } from "@/components/ui/RadioListItem";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { NIGERIA_STATES } from "@/features/location/nigeria-states";
import * as profileApi from "@/features/profile/api";
import { ApiError } from "@/lib/api/client";

// Figma node 208:4138 ("Select your state?"). Only reached when the Country
// screen's selection was Nigeria — see app/(auth)/country/page.tsx.

function StateContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NIGERIA_STATES;
    return NIGERIA_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  async function handleSelect(state: string) {
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, { state });
      router.push("/location");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProgressBar percent={75} />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full bg-white"
            aria-label="Close"
          >
            <Image src="/icons/close.svg" alt="" width={16} height={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">State of residence</h1>
          <p className="font-body text-sm text-body-text">Choose your state of residence to personalize your experience.</p>
        </div>

        <TextField
          placeholder="Search for your state"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Image src="/icons/search.svg" alt="" width={16} height={16} />}
        />

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        <div className="flex flex-1 flex-col overflow-y-auto">
          <p className="py-2 font-body text-base font-bold text-heading">Current location</p>
          <div className="flex items-center gap-2.5 border-b border-border py-4">
            <Image src="/icons/flag-nigeria.svg" alt="" width={28} height={28} className="rounded-full" />
            <span className="flex-1 font-body text-base text-input-text">Nigeria</span>
            <Image src="/icons/radio-selected.svg" alt="" width={24} height={24} />
          </div>

          <p className="py-2 pt-4 font-body text-base font-bold text-heading">Select state</p>
          {filtered.map((state) => (
            <RadioListItem
              key={state}
              label={state}
              selected={false}
              disabled={submitting}
              onClick={() => handleSelect(state)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default function StatePage() {
  return (
    <RequireAuth>
      <StateContent />
    </RequireAuth>
  );
}
