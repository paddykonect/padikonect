import Image from "next/image";
import Link from "next/link";
import { NightModeButton } from "@/features/theme/NightModeButton";

const iconButton = "relative flex shrink-0 items-center justify-center rounded-full border border-border bg-card";

// Figma Home header row (node 590:8855): language picker (English only for
// now), night mode, scan and notifications.
export function HomeHeader({ hasUnread }: { hasUnread: boolean }) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="relative">
        <select
          aria-label="Language"
          defaultValue="en"
          className="h-10 appearance-none rounded-full border border-border bg-card pl-3.5 pr-8 font-body text-[12.5px] font-bold leading-[15px] text-heading outline-none"
        >
          <option value="en">English</option>
        </select>
        <Image src="/icons/home/chevron-down.svg" alt="" width={12} height={12} className="pointer-events-none absolute right-3 top-[15px]" />
      </div>

      <div className="flex items-center gap-2">
        <NightModeButton />
        <Link href="/scan" className={`${iconButton} size-[42px]`}>
          <Image src="/icons/home/scan.svg" alt="" width={19} height={19} className="dark-invert" />
          <span className="sr-only">Scan a padi</span>
        </Link>
        <Link href="/notifications" className={`${iconButton} size-[42px]`}>
          <Image src="/icons/home/bell.svg" alt="" width={18} height={18} />
          <span className="sr-only">{hasUnread ? "Notifications (unread)" : "Notifications"}</span>
          {hasUnread && <span className="absolute right-[7px] top-1.5 size-[13px] rounded-full border-2 border-card bg-accent" />}
        </Link>
      </div>
    </div>
  );
}
