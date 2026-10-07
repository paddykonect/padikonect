"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RadioListItem } from "@/components/ui/RadioListItem";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { RequireCountry } from "@/features/profile/require-country";
import * as locationApi from "@/features/location/api";
import { COUNTRIES, Country } from "@/features/location/countries";
import { CountryFlag } from "@/features/location/CountryFlag";
import * as profileApi from "@/features/profile/api";
import { ApiError } from "@/lib/api/client";

// Figma node 208:4138 ("Select your state?"). States for the user's country of
// residence are fetched from the API; countries without any subdivisions in
// the dataset skip straight to Location.

function StateContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [country, setCountry] = useState<Country | null>(null);
  const [states, setStates] = useState<locationApi.StateOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await profileApi.getOwnProfile(accessToken);
        const match = COUNTRIES.find((c) => c.name === profile.country);
        if (!match) {
          router.replace("/country");
          return;
        }
        const list = await locationApi.getStates(accessToken, match.code);
        if (cancelled) return;
        if (list.length === 0) {
          router.replace("/location");
          return;
        }
        setCountry(match);
        setStates(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load states. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, router, loadAttempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!states || !q) return states ?? [];
    return states.filter((s) => s.name.toLowerCase().includes(q));
  }, [states, query]);

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

  function retry() {
    setError(null);
    setLoadAttempt((n) => n + 1);
  }

  return (
    <>
      <ProgressBar percent={75} />
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
          <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">State of residence</h1>
          <p className="font-body text-sm text-body-text">Choose your state of residence to personalize your experience.</p>
        </div>

        <TextField
          placeholder="Search for your state"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Image src="/icons/search.svg" alt="" width={16} height={16} />}
        />

        {error && (
          <p className="font-body text-sm text-danger">
            {error}{" "}
            {!states && (
              <button type="button" onClick={retry} className="font-bold underline">
                Retry
              </button>
            )}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {country && (
            <>
              <p className="py-2 font-body text-base font-bold text-heading">Current location</p>
              <div className="flex items-center gap-2.5 border-b border-border py-4">
                <CountryFlag code={country.code} />
                <span className="flex-1 font-body text-base text-input-text">{country.name}</span>
                <Image src="/icons/radio-selected.svg" alt="" width={24} height={24} />
              </div>
            </>
          )}

          {!states && !error && <p className="py-6 text-center font-body text-sm text-body-text">Loading states…</p>}

          {states && (
            <>
              <p className="py-2 pt-4 font-body text-base font-bold text-heading">Select state</p>
              {filtered.map((state) => (
                <RadioListItem
                  key={state.code}
                  label={state.name}
                  selected={false}
                  disabled={submitting}
                  onClick={() => handleSelect(state.name)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="py-6 text-center font-body text-sm text-body-text">No states match “{query.trim()}”.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function StatePage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <StateContent />
      </RequireCountry>
    </RequireAuth>
  );
}
