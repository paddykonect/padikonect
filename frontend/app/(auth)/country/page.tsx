"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RadioListItem } from "@/components/ui/RadioListItem";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { COUNTRIES } from "@/features/location/countries";
import * as profileApi from "@/features/profile/api";
import { ApiError } from "@/lib/api/client";

// Figma-only onboarding sub-flow (nodes 48:50343, 88:6077, 208:4138) — not in
// the PRD, built at the user's explicit request. Country of residence ->
// nationality-confirm sheet -> (State of residence, Nigeria only) -> Location.

function CountryContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  async function commit(country: string, nationality: string | null) {
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, {
        country,
        ...(nationality ? { nationality } : {}),
      });
      router.push(country === "Nigeria" ? "/state" : "/location");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProgressBar percent={60} />
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
          <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">Country of residence</h1>
          <p className="font-body text-sm text-body-text">Choose your country to personalize your experience.</p>
        </div>

        <TextField
          placeholder="Search for your country"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Image src="/icons/search.svg" alt="" width={16} height={16} />}
        />

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        <div className="flex flex-1 flex-col overflow-y-auto">
          {filtered.map((country) => (
            <RadioListItem
              key={country}
              label={country}
              selected={false}
              disabled={submitting}
              onClick={() => setConfirming(country)}
            />
          ))}
        </div>
      </div>

      <BottomSheet
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={`Would you like to use ${confirming ?? ""} as your nationality too?`}
        description="This saves you a step."
      >
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          onClick={() => confirming && commit(confirming, confirming)}
        >
          {`Yes, use ${confirming ?? ""}`}
        </Button>
        <Button type="button" variant="text" onClick={() => confirming && commit(confirming, null)}>
          No, skip this
        </Button>
      </BottomSheet>
    </>
  );
}

export default function CountryPage() {
  return (
    <RequireAuth>
      <CountryContent />
    </RequireAuth>
  );
}
