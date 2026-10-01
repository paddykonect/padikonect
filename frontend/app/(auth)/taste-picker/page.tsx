"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as profileApi from "@/features/profile/api";
import { DrinkPreference } from "@/features/profile/types";
import { ApiError } from "@/lib/api/client";

// Verified against Figma node 188:4283 ("Add interest (sheet)", which also
// contains the base Taste Picker content underneath the sheet overlay).

const DRINK_OPTIONS: { value: DrinkPreference; label: string }[] = [
  { value: "BOTH", label: "Both" },
  { value: "ALCOHOLIC", label: "Alcoholic" },
  { value: "NON_ALCOHOLIC", label: "Non-alcoholic" },
];

const INTEREST_OPTIONS = ["Live music", "Rooftop vibes", "Foodie", "Game nights", "Wellness", "Book club", "Afrobeats", "Outdoors"];

const MAX_INTERESTS = 10;

function Pill({ label, selected, onClick, fill = false }: { label: string; selected: boolean; onClick: () => void; fill?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${fill ? "flex-1" : "shrink-0"} rounded-pill border-2 px-4 py-2.5 font-body text-[13px] transition-colors ${
        selected ? "border-heading bg-heading font-bold text-white" : "border border-border bg-white font-normal text-heading"
      }`}
    >
      {label}
    </button>
  );
}

function TastePickerForm() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [drinkPreference, setDrinkPreference] = useState<DrinkPreference>("BOTH");
  const [interests, setInterests] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customInterest, setCustomInterest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleInterest(tag: string) {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, tag];
    });
  }

  function handleAddCustomInterest() {
    const tag = customInterest.trim();
    if (!tag || interests.includes(tag) || interests.length >= MAX_INTERESTS) return;
    setInterests((prev) => [...prev, tag]);
    setCustomInterest("");
    setSheetOpen(false);
  }

  // Custom-added tags that aren't in the curated list also render as pills,
  // matching the Figma pattern of interests appearing wherever selected.
  const extraInterests = interests.filter((tag) => !INTEREST_OPTIONS.includes(tag));

  async function handleContinue() {
    if (!accessToken || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, { drinkPreference, interests });
      router.push("/country");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ProgressBar percent={45} />
      <div className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <h1 className="font-heading text-2xl font-bold leading-[32px] text-heading">What&apos;s your vibe?</h1>
            <p className="font-body text-sm text-body-text">This helps us match you with the right hangouts.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="font-body text-sm font-bold text-heading">Drink preference</h2>
            <div className="flex gap-2">
              {DRINK_OPTIONS.map((opt) => (
                <Pill key={opt.value} label={opt.label} selected={drinkPreference === opt.value} onClick={() => setDrinkPreference(opt.value)} fill />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-body text-sm font-bold text-heading">Pick a few interests</h2>
              <span className="font-body text-xs text-body-text">{interests.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((tag) => (
                <Pill key={tag} label={tag} selected={interests.includes(tag)} onClick={() => toggleInterest(tag)} />
              ))}
              {extraInterests.map((tag) => (
                <Pill key={tag} label={tag} selected onClick={() => toggleInterest(tag)} />
              ))}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex h-[37px] shrink-0 items-center gap-1.5 rounded-pill border border-dashed border-body-text px-4 font-body text-[13px] text-body-text"
              >
                <Image src="/icons/plus.svg" alt="" width={13} height={13} />
                Add your own
              </button>
            </div>
          </div>

          {error && <p className="font-body text-sm text-danger">{error}</p>}
        </div>

        <Button type="button" variant="primary" loading={submitting} onClick={handleContinue}>
          Continue
        </Button>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add your own interest"
        description="Tell us what you're into and we'll add it to your picks."
      >
        <TextField placeholder="e.g. Karaoke nights" value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} />
        <Button type="button" variant="primary" disabled={!customInterest.trim()} onClick={handleAddCustomInterest}>
          Add interest
        </Button>
        <Button type="button" variant="text" onClick={() => setSheetOpen(false)}>
          Cancel
        </Button>
      </BottomSheet>
    </>
  );
}

export default function TastePickerPage() {
  return (
    <RequireAuth>
      <TastePickerForm />
    </RequireAuth>
  );
}
