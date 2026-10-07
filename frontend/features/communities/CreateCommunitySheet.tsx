"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as communitiesApi from "./api";
import { Community } from "./types";

const EMOJIS = ["🍽️", "🎬", "🏙️", "⚽", "🎶", "📚", "🧘", "🎮", "🌳", "🍹", "💃", "🏖️"];

interface CreateCommunitySheetProps {
  open: boolean;
  accessToken: string;
  onClose: () => void;
  onCreated: (c: Community) => void;
}

export function CreateCommunitySheet({ open, accessToken, onClose, onCreated }: CreateCommunitySheetProps) {
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("99");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const min = Number(minAge);
  const max = Number(maxAge);
  const ageValid = Number.isInteger(min) && Number.isInteger(max) && min >= 18 && max <= 99 && min <= max;
  const valid = name.trim().length >= 3 && description.trim().length >= 10 && ageValid;

  async function handleCreate() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      onCreated(await communitiesApi.createCommunity(accessToken, { name: name.trim(), description: description.trim(), emoji, minAge: min, maxAge: max }));
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the community.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Start a community" description="Bring together padis who share your vibe.">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Community emoji">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            onClick={() => setEmoji(e)}
            className={`flex size-10 items-center justify-center rounded-xl text-xl ${emoji === e ? "border-2 border-heading bg-accent/35" : "border border-border bg-card"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <TextField placeholder="Community name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder="What's it about? (at least 10 characters)"
        className="w-full resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text focus:border-border-focus"
      />
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-body text-sm text-heading">Age</span>
        <div className="w-20">
          <TextField className="text-center" aria-label="Minimum age" inputMode="numeric" value={minAge} onChange={(e) => setMinAge(e.target.value.replace(/\D/g, ""))} maxLength={2} />
        </div>
        <span className="shrink-0 font-body text-sm text-body-text">to</span>
        <div className="w-20">
          <TextField className="text-center" aria-label="Maximum age" inputMode="numeric" value={maxAge} onChange={(e) => setMaxAge(e.target.value.replace(/\D/g, ""))} maxLength={2} />
        </div>
      </div>
      {!ageValid && <p className="font-body text-xs text-danger">Ages must be between 18 and 99, minimum first.</p>}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
      <Button type="button" variant="primary" disabled={!valid} loading={submitting} onClick={() => void handleCreate()}>
        Create community
      </Button>
    </BottomSheet>
  );
}
