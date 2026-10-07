"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import * as padisApi from "@/features/padis/api";
import { StatusGroup } from "@/features/padis/types";
import { cloudinaryDisplayUrl } from "@/lib/media/cloudinary";

const AUTO_ADVANCE_MS = 5000;

interface StatusViewerProps {
  groups: StatusGroup[];
  startIndex: number;
  accessToken: string;
  onClose: () => void;
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// Full-screen story viewer: tap right/left to move, auto-advances, marks each
// padi status viewed as it's shown.
export function StatusViewer({ groups, startIndex, accessToken, onClose }: StatusViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [itemIndex, setItemIndex] = useState(() => {
    const first = groups[startIndex].statuses.findIndex((s) => !s.viewed);
    return first >= 0 ? first : 0;
  });

  // Own statuses can be deleted; auto-advance pauses while confirming.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Photo load state, tracked by status id so it resets for free when the
  // shown status changes. Auto-advance waits for the image so slow/large
  // photos aren't skipped, and a failed one shows a message, not a blank screen.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const group = groups[groupIndex];
  const status = group.statuses[itemIndex];
  const imgLoaded = loadedId === status.id;
  const imgError = errorId === status.id;

  async function deleteStatus() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await padisApi.deleteStatus(accessToken, status.id);
      onClose(); // the parent reloads the status feed on close
    } catch {
      setDeleteError("Couldn't delete this status. Please try again.");
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!group.isMe && !status.viewed) {
      void padisApi.markStatusViewed(accessToken, status.id).catch(() => undefined);
    }
  }, [accessToken, group.isMe, status.id, status.viewed]);

  function next() {
    if (itemIndex < group.statuses.length - 1) setItemIndex(itemIndex + 1);
    else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setItemIndex(0);
    } else onClose();
  }

  function prev() {
    if (itemIndex > 0) setItemIndex(itemIndex - 1);
    else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setItemIndex(0);
    }
  }

  useEffect(() => {
    if (confirmDelete) return;
    // Hold the timer until a photo has loaded (or failed) so it isn't skipped.
    if (status.imageUrl && !imgLoaded && !imgError) return;
    const timer = setTimeout(next, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[430px] flex-col bg-ink">
        <div className="flex gap-1 px-3 pt-3">
          {group.statuses.map((s, i) => (
            <span key={s.id} className={`h-0.5 flex-1 rounded-full ${i <= itemIndex ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <Avatar name={group.user.displayName} photoUrl={group.user.photoUrl} size={32} />
          <div className="flex-1">
            <p className="font-body text-sm font-bold text-white">{group.isMe ? "Your status" : group.user.displayName}</p>
            <p className="font-body text-xs text-white/70">{timeAgo(status.createdAt)}</p>
          </div>
          {group.isMe && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full px-3 py-1 font-body text-xs font-bold text-white/90 ring-1 ring-white/40">
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-white">
            ×
          </button>
        </div>
        {confirmDelete && (
          <div className="relative z-10 mx-4 flex flex-col gap-2 rounded-2xl bg-white/10 p-3">
            <p className="font-body text-sm text-white">Delete this status? Padis won&apos;t see it any more.</p>
            {deleteError && <p className="font-body text-xs text-[#ffb4ab]">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 flex-1 rounded-full font-body text-[13px] font-bold text-white ring-1 ring-white/40">
                Keep
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteStatus()}
                className="h-9 flex-1 rounded-full bg-[#b3261e] font-body text-[13px] font-bold text-white disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}

        <div className="relative flex flex-1 items-center justify-center px-6">
          {status.imageUrl && !imgError && (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary URL, natural aspect ratio
            <img
              src={cloudinaryDisplayUrl(status.imageUrl, { width: 1080 })}
              alt=""
              className={`max-h-full max-w-full object-contain transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoadedId(status.id)}
              onError={() => setErrorId(status.id)}
            />
          )}
          {status.imageUrl && !imgLoaded && !imgError && (
            <span className="absolute size-9 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Loading photo" />
          )}
          {status.imageUrl && imgError && (
            <p className="px-8 text-center font-body text-sm text-white/80">Couldn&apos;t load this photo.</p>
          )}
          {status.text && (
            <p className={`text-center font-heading text-2xl font-bold text-white ${status.imageUrl ? "absolute inset-x-6 bottom-10 rounded-xl bg-black/40 p-3 text-lg" : ""}`}>
              {status.text}
            </p>
          )}
          <button type="button" aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
          <button type="button" aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 w-2/3" />
        </div>
      </div>
    </div>
  );
}
