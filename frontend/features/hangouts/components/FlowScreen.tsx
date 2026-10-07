"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

interface FlowScreenProps {
  title?: string;
  /** Shown under the title (e.g. "Rooftop padi hangout · Fri, 8:00 PM"). */
  subtitle?: string;
  /** Title sits on its own line under the back button (Figma "Invite padis", "Hangout Request"). */
  largeTitle?: boolean;
  /** Right side of the header row, e.g. "Publish" or "2 padis selected". */
  action?: ReactNode;
  /** "close" shows an × instead of the back chevron. */
  backIcon?: "back" | "close";
  /** Where Back goes when there's no history (deep link). */
  backHref: string;
  onBack?: () => void;
  /** Pinned to the bottom, e.g. the screen's primary button. */
  footer?: ReactNode;
  children: ReactNode;
}

// Shell for the Host-a-hangout / Requests screens (Figma 360:1203, 360:1041,
// 406:4046 …): round back button, Baloo title, content, sticky footer.
export function FlowScreen({ title, subtitle, largeTitle, action, backIcon = "back", backHref, onBack, footer, children }: FlowScreenProps) {
  const router = useRouter();
  const back = onBack ?? (() => (window.history.length > 1 ? router.back() : router.push(backHref)));
  const heading = title && (
    <h1 className={`font-heading font-bold text-heading ${largeTitle ? "text-2xl leading-8" : "text-xl leading-7"}`}>{title}</h1>
  );
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-background px-5 py-4">
        <button type="button" onClick={back} aria-label={backIcon === "close" ? "Close" : "Back"} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
          <Image src={backIcon === "close" ? "/icons/close.svg" : "/icons/chevron-left.svg"} alt="" width={16} height={16} className="dark-invert" />
        </button>
        <div className="min-w-0 flex-1 truncate">{!largeTitle && heading}</div>
        {action}
      </header>
      {/* Large titles scroll away with the content; only the back row sticks. */}
      {largeTitle && (heading || subtitle) && (
        <div className="flex flex-col gap-0.5 px-5 pb-4">
          {heading}
          {subtitle && <p className="font-body text-[13px] leading-[18px] text-body-text">{subtitle}</p>}
        </div>
      )}
      <main className="flex flex-1 flex-col gap-4 px-5 pb-6">{children}</main>
      {footer && <div className="sticky bottom-0 z-10 flex flex-col gap-2 bg-background px-5 pb-6 pt-3">{footer}</div>}
    </div>
  );
}

/** The white rounded card used throughout these screens. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-col rounded-2xl bg-card p-4 ${className}`}>{children}</section>;
}

/** Small uppercase card label ("YOUR REQUEST", "WANTS TO JOIN"). */
export function CardLabel({ children }: { children: ReactNode }) {
  return <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">{children}</h2>;
}

/** Centered loading / error placeholder for a whole screen. */
export function ScreenMessage({ text, onBack }: { text: string; onBack?: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-background px-5">
      <p className="text-center font-body text-sm text-body-text">{text}</p>
      {onBack && (
        <button type="button" onClick={onBack} className="font-body text-sm font-bold text-heading underline">
          Go back
        </button>
      )}
    </div>
  );
}
