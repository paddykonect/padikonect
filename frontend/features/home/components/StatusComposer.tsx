"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import * as padisApi from "@/features/padis/api";
import { ApiError } from "@/lib/api/client";
import { uploadImage } from "@/lib/media/cloudinary";

interface StatusComposerProps {
  open: boolean;
  accessToken: string;
  onClose: () => void;
  onPosted: () => void;
}

export function StatusComposer({ open, accessToken, onClose, onPosted }: StatusComposerProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setText("");
    setFile(null);
    setError(null);
  }

  async function handlePost() {
    if (submitting || (!text.trim() && !file)) return;
    setSubmitting(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const params = await padisApi.getStatusUploadSignature(accessToken);
        imageUrl = await uploadImage(file, params);
      }
      await padisApi.createStatus(accessToken, { text: text.trim() || undefined, imageUrl });
      reset();
      onPosted();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Could not post your status.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add your status"
      description="Visible to your padis for 24 hours."
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={280}
        rows={3}
        placeholder="What's the vibe tonight?"
        className="w-full resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text focus:border-border-focus"
      />
      <label className="flex cursor-pointer items-center justify-between rounded-field border border-dashed border-border px-4 py-3 font-body text-sm text-body-text">
        <span className="truncate">{file ? file.name : "Add a photo (optional)"}</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <span className="font-bold text-heading">{file ? "Change" : "Choose"}</span>
      </label>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
      <Button type="button" variant="primary" disabled={!text.trim() && !file} loading={submitting} onClick={() => void handlePost()}>
        Post status
      </Button>
    </BottomSheet>
  );
}
