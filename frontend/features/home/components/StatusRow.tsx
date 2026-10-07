import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { StatusGroup } from "@/features/padis/types";

// Figma ring styles: conic gradient = unseen status, solid lime = all seen.
const UNSEEN_RING =
  "conic-gradient(from 90deg, #d7e600 0%, #a8bb0b 12.5%, #799116 25%, #4a6620 37.5%, #335026 43.75%, #1b3b2b 50%, #335026 56.25%, #4a6620 62.5%, #799116 75%, #a8bb0b 87.5%, #d7e600 100%)";

interface StatusRowProps {
  me: { name: string; photoUrl: string | null };
  groups: StatusGroup[];
  onAdd: () => void;
  onOpen: (index: number) => void;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

// Figma node 590:8888: horizontally scrolling status bubbles. Bleeds 16px
// past the page padding on both sides like the design.
export function StatusRow({ me, groups, onAdd, onOpen }: StatusRowProps) {
  const myIndex = groups.findIndex((g) => g.isMe);
  const padiGroups = groups.map((g, i) => ({ g, i })).filter(({ g }) => !g.isMe);

  return (
    <div className="-mx-4 flex h-14 items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => (myIndex >= 0 ? onOpen(myIndex) : onAdd())}
          className="flex size-[50px] items-center justify-center rounded-full border-2 border-dashed border-accent p-0.5"
          aria-label={myIndex >= 0 ? "View your status" : "Add your status"}
        >
          <Avatar name={me.name} photoUrl={me.photoUrl} size={42} />
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add your status"
          className="absolute -bottom-0.5 -right-0.5 flex size-[22px] items-center justify-center rounded-full border-2 border-background bg-ink"
        >
          <Image src="/icons/home/plus.svg" alt="" width={9} height={9} />
        </button>
      </div>

      {padiGroups.map(({ g, i }) => (
        <button key={g.user.id} type="button" onClick={() => onOpen(i)} className="flex w-[46px] shrink-0 flex-col items-center gap-0.5">
          <span
            className="flex size-10 items-center justify-center rounded-full p-0.5"
            style={{ background: g.hasUnseen ? UNSEEN_RING : "#d7e600" }}
          >
            <Avatar name={g.user.displayName} photoUrl={g.user.photoUrl} size={36} />
          </span>
          <span className="max-w-full truncate font-body text-[8px] font-medium text-heading">{firstName(g.user.displayName)}</span>
        </button>
      ))}
    </div>
  );
}
