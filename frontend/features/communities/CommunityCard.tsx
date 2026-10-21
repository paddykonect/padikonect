import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PlusIcon } from "@/features/hangouts/components/icons";
import { cloudinaryDisplayUrl } from "@/lib/media/cloudinary";
import { Community } from "./types";

interface CommunityCardProps {
  community: Community;
  busy: boolean;
  onJoin: () => void;
  onToggleFavorite: () => void;
}

// Figma community card: cover photo, Age/city chips, a favourite heart, a
// Join/Joined control, then title · members · admin. The whole card links to
// the community; the heart + Join sit above the link so they stay tappable.
export function CommunityCard({ community: c, busy, onJoin, onToggleFavorite }: CommunityCardProps) {
  const chip = "rounded-full bg-white/92 px-[9px] py-[3px] font-body text-[11px] font-medium text-[#1b3b2b]";
  return (
    <article className="relative overflow-hidden rounded-2xl bg-card shadow-[0px_6px_20px_0px_rgba(23,62,50,0.06)]">
      <Link href={`/communities/${c.id}`} aria-label={c.name} className="absolute inset-0 z-[1]" />

      <div className="relative h-[150px] w-full bg-[#eef3e9]">
        {c.coverImageUrl ? (
          <Image src={cloudinaryDisplayUrl(c.coverImageUrl, { width: 600 })} alt="" fill sizes="430px" className="object-cover" unoptimized />
        ) : (
          <span className="flex size-full items-center justify-center text-4xl">{c.emoji}</span>
        )}
        <div className="absolute left-2.5 top-2.5 z-[2] flex gap-1.5">
          <span className={chip}>Age {c.minAge}-{c.maxAge}</span>
          <span className={chip}>{c.city}</span>
        </div>
        <button
          type="button"
          aria-pressed={c.isFavorite}
          aria-label={c.isFavorite ? `Remove ${c.name} from favourites` : `Add ${c.name} to favourites`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute bottom-2.5 left-2.5 z-[2] flex size-9 items-center justify-center rounded-full shadow ${c.isFavorite ? "bg-accent" : "bg-white/90"}`}
        >
          <Image src={c.isFavorite ? "/icons/home/heart-filled.svg" : "/icons/home/heart-outline.svg"} alt="" width={15} height={15} />
        </button>
        {c.isMember ? (
          <span className="absolute bottom-2.5 right-2.5 z-[2] rounded-full bg-accent px-3.5 py-1.5 font-body text-[13px] font-bold text-[#1b3b2b]">Joined</span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJoin();
            }}
            className="absolute bottom-2.5 right-2.5 z-[2] flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 font-body text-[13px] font-bold text-white disabled:opacity-60"
          >
            <PlusIcon size={14} />
            {busy ? "Joining…" : "Join"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3.5">
        <h3 className="font-heading text-base font-bold text-heading">
          {c.name}
          {c.emoji && c.coverImageUrl ? <span className="ml-1">{c.emoji}</span> : null}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {c.memberAvatars.length > 0 && (
              <span className="flex shrink-0 -space-x-2">
                {c.memberAvatars.slice(0, 4).map((m, i) => (
                  <span key={i} className="rounded-full ring-2 ring-card">
                    <Avatar name={m.displayName ?? "Member"} photoUrl={m.photoUrl} size={22} />
                  </span>
                ))}
              </span>
            )}
            <span className="truncate font-body text-xs text-body-text">
              {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
            </span>
          </span>
          {c.admin && (
            <span className="flex shrink-0 items-center gap-1.5">
              <Avatar name={c.admin.displayName ?? "Admin"} photoUrl={c.admin.photoUrl} size={22} />
              <span className="font-body text-xs text-body-text">{c.admin.displayName} Admin</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
