"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { applyTheme, readTheme, saveTheme, Theme } from "./theme";

// Figma "Button - Toggle night mode" (e.g. node 590:8863).
export function NightModeButton() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Theme lives in localStorage/the DOM, which only exist client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to night mode"}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card"
    >
      <Image src="/icons/home/night-mode.svg" alt="" width={17} height={17} className="dark-invert" />
    </button>
  );
}
