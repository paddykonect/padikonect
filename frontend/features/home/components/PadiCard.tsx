"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { RadarPadi } from "@/features/radar/api";

interface PadiCardProps {
  padi: RadarPadi;
  distanceKm: number | null;
  busy: boolean;
  onToggleHide: () => void;
  onAddPadi: () => void;
}

// Open eye / eye with a slash, for the "hide yourself from this padi" toggle.
function EyeIcon({ off }: { off: boolean }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  return off ? (
    <svg {...common}>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// A single padi in the map carousel (Figma "Padis nearby" card). Mirrors the
// hangout preview card.
export function PadiCard({ padi, distanceKm, busy, onToggleHide, onAddPadi }: PadiCardProps) {
  const { user } = padi;
  const distance = distanceKm != null ? `${distanceKm.toFixed(1)}km away` : "Nearby";

  return (
    <div className="flex w-[300px] flex-col gap-3 rounded-2xl bg-card p-4 shadow-[0px_6px_8px_rgba(0,0,0,0.12)]">
      <div className="flex items-start gap-3">
        <Avatar name={user.displayName} photoUrl={user.photoUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold text-heading">{user.displayName}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 font-body text-xs text-body-text">
            <span>{distance}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${user.online ? "bg-live" : "bg-border"}`} />
              {user.online ? "Online" : "Offline"}
            </span>
            {padi.ratingCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>★ {padi.ratingAvg?.toFixed(1)}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleHide}
          disabled={busy}
          aria-pressed={padi.hiddenFromThem}
          aria-label={padi.hiddenFromThem ? `Show yourself to ${user.displayName}` : `Hide yourself from ${user.displayName}`}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-60 ${
            padi.hiddenFromThem ? "bg-ink text-white" : "border border-border text-body-text"
          }`}
        >
          <EyeIcon off={padi.hiddenFromThem} />
        </button>
      </div>

      {user.wantsToBeInvitedFor && (
        <p className="rounded-xl bg-background px-3 py-2 font-body text-[13px] text-heading">{user.wantsToBeInvitedFor}</p>
      )}

      <div className="flex gap-2">
        <Link
          href={`/padi/${user.id}`}
          className="flex h-10 flex-1 items-center justify-center rounded-full border border-heading font-body text-[13px] font-bold text-heading"
        >
          View profile
        </Link>
        {padi.isPadi ? (
          <span className="flex h-10 flex-1 items-center justify-center rounded-full bg-accent/35 font-body text-[13px] font-bold text-heading">
            ✓ Padis
          </span>
        ) : (
          <button
            type="button"
            onClick={onAddPadi}
            disabled={busy}
            className="h-10 flex-1 rounded-full bg-accent font-body text-[13px] font-bold text-[#1b3b2b] disabled:opacity-60"
          >
            Add padi
          </button>
        )}
      </div>
    </div>
  );
}
