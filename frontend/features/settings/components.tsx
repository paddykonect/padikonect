"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

interface SettingsScreenProps {
  title: string;
  children: ReactNode;
  /** Pinned to the bottom, e.g. the screen's primary button. */
  footer?: ReactNode;
  /** Where Back goes when there's no history (e.g. a deep link). */
  backHref?: string;
}

// Shared Settings shell (Figma page 284:6845): back button + Baloo title, then
// the screen's content with an optional bottom action.
export function SettingsScreen({ title, children, footer, backHref = "/settings" }: SettingsScreenProps) {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background px-5 py-4">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref))}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card"
        >
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
        </button>
        <h1 className="font-heading text-xl font-bold text-heading">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-1">{children}</main>
      {footer && <div className="sticky bottom-0 flex flex-col gap-3 bg-background px-5 pb-6 pt-2">{footer}</div>}
    </div>
  );
}

/** Uppercase section label above a card of rows. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">{title}</h2>}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
        {children}
      </div>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  hint?: string;
  /** Current value shown before the chevron, e.g. "Padis only". */
  value?: string;
  href?: string;
  onClick?: () => void;
  /** A control on the right (switch, segmented toggle, select) instead of a chevron. */
  control?: ReactNode;
}

export function SettingsRow({ label, hint, value, href, onClick, control }: SettingsRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-body text-sm text-heading">{label}</span>
        {hint && <span className="font-body text-xs text-body-text">{hint}</span>}
      </span>
      {control ?? (
        <span className="flex shrink-0 items-center gap-1.5">
          {value && <span className="font-body text-[13px] text-body-text">{value}</span>}
          <Image src="/icons/profile/chevron-right.svg" alt="" width={16} height={16} />
        </span>
      )}
    </>
  );
  const className = "flex w-full items-center justify-between gap-3 p-3.5 text-left";
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

/** Figma "Button - Push notifications" switch (284:9370). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full border border-border p-0.5 transition-colors disabled:opacity-60 ${
        checked ? "justify-end bg-ink" : "justify-start bg-toggle-bg"
      }`}
    >
      <span className="size-5 rounded-full bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.2)]" />
    </button>
  );
}

/** Initials avatar used across Settings (lime circle, Baloo initials). */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
