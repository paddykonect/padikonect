import Link from "next/link";
import { Community } from "./types";

// Figma's striped card covers (two-tone 45°/135° stripes), cycled by index.
const STRIPES = [
  ["#f1ede2", "#eef3e9", 45],
  ["#dce6d9", "#f1ede2", 135],
  ["#dce6d9", "#fbf6ec", 45],
  ["#eef3e9", "#dce6d9", 135],
] as const;

function stripes(index: number) {
  const [a, b, angle] = STRIPES[index % STRIPES.length];
  return `repeating-linear-gradient(${angle}deg, ${a} 0 10px, ${b} 10px 20px)`;
}

interface CommunityCardProps {
  community: Community;
  index: number;
  busy: boolean;
  onJoin: () => void;
}

export function CommunityCard({ community: c, index, busy, onJoin }: CommunityCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl bg-card">
      <div className="relative flex h-[108px] items-end p-2.5" style={{ backgroundImage: stripes(index) }}>
        <span className="text-[34px] leading-none">{c.emoji}</span>
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <span className="rounded-full bg-white/92 px-[9px] py-[3px] font-body text-[11px] font-medium text-[#1b3b2b]">
            Age {c.minAge}-{c.maxAge}
          </span>
          <span className="rounded-full bg-white/92 px-[9px] py-[3px] font-body text-[11px] font-medium text-[#1b3b2b]">{c.city}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-body text-sm font-bold text-heading">{c.name}</h3>
          <p className="line-clamp-2 font-body text-xs text-body-text">{c.description}</p>
          <p className="mt-1 font-body text-[11px] text-body-text">
            {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
          </p>
        </div>
        {c.isMember ? (
          c.conversationId ? (
            <Link href={`/chats/${c.conversationId}`} className="shrink-0 rounded-full border border-heading px-4 py-2 font-body text-[13px] font-bold text-heading">
              Open chat
            </Link>
          ) : (
            <span className="shrink-0 font-body text-[13px] font-bold text-heading">Joined</span>
          )
        ) : (
          <button type="button" disabled={busy} onClick={onJoin} className="shrink-0 rounded-full bg-ink px-4 py-2 font-body text-[13px] font-bold text-white disabled:opacity-60">
            {busy ? "Joining…" : "Join"}
          </button>
        )}
      </div>
    </article>
  );
}
