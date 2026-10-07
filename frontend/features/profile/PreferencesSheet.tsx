"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { INTEREST_OPTIONS } from "./interests";
import { DRINK_PREFERENCE_LABEL, DrinkPreference } from "./types";

const MAX_INTERESTS = 10;

interface PreferencesSheetProps {
  open: boolean;
  drinkPreference: DrinkPreference;
  interests: string[];
  onClose: () => void;
  onDone: (value: { drinkPreference: DrinkPreference; interests: string[] }) => void;
}

function pill(selected: boolean) {
  return `rounded-pill px-4 py-2.5 font-body text-[13px] ${
    selected ? "border-2 border-ink bg-ink font-bold text-white" : "border border-border bg-card text-heading"
  }`;
}

// Edit-profile counterpart of the Taste Picker (same options and limits).
export function PreferencesSheet({ open, drinkPreference, interests, onClose, onDone }: PreferencesSheetProps) {
  const [drink, setDrink] = useState(drinkPreference);
  const [selected, setSelected] = useState(interests);
  const options = [...INTEREST_OPTIONS, ...interests.filter((t) => !INTEREST_OPTIONS.includes(t))];

  function toggle(tag: string) {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= MAX_INTERESTS ? prev : [...prev, tag],
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Drink preference & interests">
      <div className="flex gap-2">
        {(Object.keys(DRINK_PREFERENCE_LABEL) as DrinkPreference[]).map((value) => (
          <button key={value} type="button" onClick={() => setDrink(value)} className={`flex-1 ${pill(drink === value)}`}>
            {DRINK_PREFERENCE_LABEL[value]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => (
          <button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => toggle(tag)} className={pill(selected.includes(tag))}>
            {tag}
          </button>
        ))}
      </div>
      <Button type="button" variant="primary" onClick={() => onDone({ drinkPreference: drink, interests: selected })}>
        Done
      </Button>
    </BottomSheet>
  );
}
