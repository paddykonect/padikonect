"use client";

import { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  // Optional visual above the title (e.g. the country-confirm map).
  media?: ReactNode;
  align?: "left" | "center";
  children: ReactNode;
}

// Matches Figma's "Add interest (sheet)" pattern: dark overlay + white sheet
// sliding up from the bottom, rounded top corners, drag handle.
export function BottomSheet({ open, onClose, title, description, media, align = "left", children }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(26,26,26,0.45)]"
      />
      <div className="relative z-10 w-full max-w-[430px] rounded-t-2xl bg-card px-5 pb-6 pt-3 shadow-[0px_-8px_12px_rgba(0,0,0,0.18)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-border" />
        {media && <div className="mb-5">{media}</div>}
        <div className={align === "center" ? "text-center" : undefined}>
          <h2 className="font-heading text-[19px] font-bold leading-[26px] text-heading">{title}</h2>
          {description && <p className="mt-1 font-body text-[13px] leading-[18px] text-body-text">{description}</p>}
        </div>
        <div className="mt-3 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
