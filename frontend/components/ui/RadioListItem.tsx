import Image from "next/image";
import { ReactNode } from "react";

interface RadioListItemProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

// Matches Figma's country/state picker row pattern (radio + label, full-width
// tap target, bottom border) — shared by the Country and State onboarding screens.
export function RadioListItem({ label, selected, onClick, disabled, icon }: RadioListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 border-b border-border py-4 text-left disabled:opacity-60"
    >
      {icon}
      <span className="flex-1 font-body text-base text-input-text">{label}</span>
      <Image src={selected ? "/icons/radio-selected.svg" : "/icons/radio-normal.svg"} alt="" width={24} height={24} />
    </button>
  );
}
