"use client";

import { ReactNode } from "react";
import { BottomNav, Tab } from "./BottomNav";

interface TabScreenProps {
  active: Tab;
  user: { name: string; photoUrl: string | null };
  children: ReactNode;
}

// Shared shell for the bottom-nav screens: 430px mobile column with the nav
// pinned to the bottom over a fade.
export function TabScreen({ active, user, children }: TabScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <main className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-4">{children}</main>
      <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background via-background/90 to-transparent px-5 pb-3 pt-2">
        <BottomNav active={active} user={user} />
      </div>
    </div>
  );
}
