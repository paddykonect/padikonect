"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CameraIcon } from "@/features/hangouts/components/icons";
import { ApiError } from "@/lib/api/client";
import { cloudinaryDisplayUrl, uploadImageDetailed } from "@/lib/media/cloudinary";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPublicId, setCoverPublicId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vibe, setVibe] = useState<string[]>([]);
  const [vibeDraft, setVibeDraft] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("99");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const min = Number(minAge);
  const max = Number(maxAge);
  const ageValid = Number.isInteger(min) && Number.isInteger(max) && min >= 18 && max <= 99 && min <= max;
  const valid = name.trim().length >= 3 && description.trim().length >= 10 && ageValid;

  async function uploadCover(file: File) {
    setUploading(true);
    setError(null);
    try {
      const sig = await communitiesApi.getCoverUploadSignature(accessToken);
      const img = await uploadImageDetailed(file, sig);
      setCoverUrl(img.url);
      setCoverPublicId(img.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function addVibe() {
    const v = vibeDraft.trim();
    if (v && vibe.length < 8 && !vibe.includes(v)) setVibe((list) => [...list, v]);
    setVibeDraft("");
  }

  async function handleCreate() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const rules = rulesText.split("\n").map((r) => r.trim()).filter(Boolean).slice(0, 10);
    try {
      onCreated(
        await communitiesApi.createCommunity(accessToken, {
          name: name.trim(),
          description: description.trim(),
          emoji,
          minAge: min,
          maxAge: max,
          ...(coverUrl && { coverImageUrl: coverUrl, coverImagePublicId: coverPublicId ?? undefined }),
          ...(vibe.length && { vibe }),
          ...(rules.length && { rules }),
        }),
      );
      setName("");
      setDescription("");
      setCoverUrl(null);
      setCoverPublicId(null);
      setVibe([]);
      setRulesText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the community.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Start a community" description="Bring together padis who share your vibe.">
      <button type="button" onClick={() => fileRef.current?.click()} className="relative h-[120px] w-full overflow-hidden rounded-2xl border border-dashed border-body-text bg-[#eef3e9]">
        {coverUrl ? (
          <Image src={cloudinaryDisplayUrl(coverUrl, { width: 600 })} alt="Cover" fill sizes="430px" className="object-cover" unoptimized />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-body-text">
            <CameraIcon size={22} />
            <span className="font-body text-[13px]">{uploading ? "Uploading…" : "Add a cover photo"}</span>
          </span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ""; }} />

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

      <div className="flex flex-col gap-2">
        <span className="font-body text-sm font-medium text-heading">Vibe (optional)</span>
        <div className="flex gap-2">
          <TextField placeholder="e.g. Foodie meetups" value={vibeDraft} maxLength={40} onChange={(e) => setVibeDraft(e.target.value)} />
          <Button type="button" variant="text" className="w-auto border border-border px-4" onClick={addVibe}>Add</Button>
        </div>
        {vibe.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {vibe.map((v) => (
              <button key={v} type="button" onClick={() => setVibe((list) => list.filter((x) => x !== v))} className="flex items-center gap-1 rounded-full bg-toggle-bg px-3 py-1.5 font-body text-[13px] text-heading">
                {v} <span className="text-body-text">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-body text-sm font-medium text-heading">Rules (optional, one per line)</span>
        <textarea
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          rows={3}
          placeholder={"Be kind — no judgement\nRSVP only if you can show up"}
          className="w-full resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text focus:border-border-focus"
        />
      </div>

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
      <Button type="button" variant="primary" disabled={!valid || uploading} loading={submitting} onClick={() => void handleCreate()}>
        Create community
      </Button>
    </BottomSheet>
  );
}
