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
import { COUNTRIES, Country, NIGERIA } from "@/features/location/countries";
import { CountryFlag } from "@/features/location/CountryFlag";
import * as profileApi from "@/features/profile/api";
import { ApiError } from "@/lib/api/client";

// Figma-only onboarding sub-flow (nodes 48:50343, 88:6077, 208:4138) — not in
// the PRD, built at the user's explicit request. Country of residence ->
// citizenship-confirm sheet -> State of residence (skipped when the country
// has no states) -> Location. "No, I am not" returns to the list unsaved.

// Keyless Google Maps embed centred on the selected country; the label sits
// just above the embed's centre marker so it reads as the pin's callout.
function CountryMap({ country }: { country: Country }) {
  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-lg bg-border">
      <iframe
        title={`Map of ${country.name}`}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(country.name)}&z=5&output=embed`}
        className="pointer-events-none size-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[calc(100%+38px)] items-center gap-2 rounded-lg bg-card px-3 py-1.5 shadow-md">
        <CountryFlag code={country.code} size={20} />
        <span className="font-body text-sm font-semibold text-heading">{country.name}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-heading" aria-hidden>
          <path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </div>
    </div>
  );
}

function CountryContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<Country | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rest = COUNTRIES.filter((c) => c.code !== NIGERIA.code);
    if (!q) return rest;
    return rest.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  async function commit(country: string) {
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, {
        country,
        nationality: country,
      });
      router.push("/state");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProgressBar percent={60} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-4 pt-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full bg-card"
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {(!query.trim() || NIGERIA.name.toLowerCase().includes(query.trim().toLowerCase())) && (
            <>
              <p className="py-2 font-body text-base font-bold text-heading">Current location</p>
              <RadioListItem
                label={NIGERIA.name}
                icon={<CountryFlag code={NIGERIA.code} />}
                selected={(confirming ?? NIGERIA).code === NIGERIA.code}
                disabled={submitting}
                onClick={() => setConfirming(NIGERIA)}
              />
            </>
          )}

          <p className="py-2 pt-4 font-body text-base font-bold text-heading">Countries</p>
          {filtered.map((country) => (
            <RadioListItem
              key={country.code}
              label={country.name}
              icon={<CountryFlag code={country.code} />}
              selected={confirming?.code === country.code}
              disabled={submitting}
              onClick={() => setConfirming(country)}
            />
          ))}
        </div>
      </div>

      <BottomSheet
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={`Are you a citizen of ${confirming?.name ?? ""}?`}
        description="This saves you a step."
        align="center"
        media={confirming && <CountryMap country={confirming} />}
      >
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          onClick={() => confirming && commit(confirming.name)}
        >
          Yes, I am a citizen
        </Button>
        <Button type="button" variant="text" disabled={submitting} onClick={() => setConfirming(null)}>
          No, I am not
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
