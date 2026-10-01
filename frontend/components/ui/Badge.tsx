import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  met?: boolean;
}

// Matches Figma's password-rule badges: filled dark-green when satisfied,
// outlined white when not.
export function Badge({ children, met = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-sm ${
        met ? "bg-heading text-white" : "border-[0.5px] border-border bg-white text-heading"
      }`}
    >
      {children}
      <CheckIcon />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7l2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
