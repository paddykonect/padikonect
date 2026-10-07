import Image from "next/image";
import Link from "next/link";

export type HomeFilter = "walkingDistance" | "tonight" | "today" | "underTwoK" | "nonAlcoholic" | "restaurants" | "lounges" | "rooftops";

// Quick filters, then interest tags (hangout tags) like the design's pills.
export const FILTERS: Array<{ id: HomeFilter; label: string }> = [
  { id: "walkingDistance", label: "Walking distance" },
  { id: "today", label: "Today" },
  { id: "tonight", label: "Tonight" },
  { id: "restaurants", label: "Restaurants" },
  { id: "nonAlcoholic", label: "Non-alcoholic" },
  { id: "underTwoK", label: "Under ₦2k" },
  { id: "lounges", label: "Lounges" },
  { id: "rooftops", label: "Rooftop vibes" },
];

interface FilterPillsProps {
  active: Set<HomeFilter>;
  onToggle: (id: HomeFilter) => void;
  interests: string[];
  activeInterests: Set<string>;
  onToggleInterest: (tag: string) => void;
  onClear: () => void;
}

function pillClass(on: boolean) {
  return `flex h-[37px] shrink-0 items-center rounded-full px-4 font-body text-[13px] leading-[18px] ${
    on ? "border-2 border-ink bg-ink font-bold text-white" : "border border-border bg-card text-heading"
  }`;
}

// Figma pills row (node 590:8997). The leading square button opens the search &
// filter screen (Figma "Hangout search", 304:29535).
export function FilterPills({ active, onToggle, interests, activeInterests, onToggleInterest, onClear }: FilterPillsProps) {
  const hasActive = active.size > 0 || activeInterests.size > 0;
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
      <Link
        href="/hangouts/search"
        aria-label="Search and filter hangouts"
        className="flex size-[37px] shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-card"
      >
        <Image src="/icons/home/filter.svg" alt="" width={16} height={16} />
      </Link>
      {hasActive && (
        <button
          type="button"
          onClick={onClear}
          className="flex h-[37px] shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 font-body text-[13px] text-heading"
        >
          Clear
          <span aria-hidden>✕</span>
        </button>
      )}
      {FILTERS.map((f) => {
        const on = active.has(f.id);
        return (
          <button key={f.id} type="button" aria-pressed={on} onClick={() => onToggle(f.id)} className={pillClass(on)}>
            {f.label}
          </button>
        );
      })}
      {interests.map((tag) => {
        const on = activeInterests.has(tag);
        return (
          <button key={`tag:${tag}`} type="button" aria-pressed={on} onClick={() => onToggleInterest(tag)} className={pillClass(on)}>
            {tag}
          </button>
        );
      })}
    </div>
  );
}
