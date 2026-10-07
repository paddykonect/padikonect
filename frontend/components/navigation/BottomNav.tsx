"use client";

import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";

export type Tab = "home" | "community" | "chat" | "you";

const TABS: Array<{ id: Tab; label: string; href: string | null; icon: string; activeIcon: string; iconWidth: number }> = [
  { id: "home", label: "Home", href: "/home", icon: "/icons/home/nav-home.svg", activeIcon: "/icons/home/nav-home-active.svg", iconWidth: 24 },
  { id: "community", label: "Community", href: "/communities", icon: "/icons/home/nav-community.svg", activeIcon: "/icons/home/nav-community-active.svg", iconWidth: 30 },
  { id: "chat", label: "Chat", href: "/chats", icon: "/icons/home/nav-chat.svg", activeIcon: "/icons/home/nav-chat-active.svg", iconWidth: 24 },
];

interface BottomNavProps {
  active: Tab;
  user: { name: string; photoUrl: string | null };
}

// Figma "Navigation bar" (node 590:8778): dark pill, active tab expands into a
// lime pill with its label.
export function BottomNav({ active, user }: BottomNavProps) {
  return (
    <nav className="flex h-16 w-full items-center justify-between rounded-[32px] bg-ink p-3.5 shadow-[0px_12px_12px_rgba(0,0,0,0.22),0px_2px_3px_rgba(0,0,0,0.12)]">
      {TABS.map((tab) => (
        <NavItem key={tab.id} label={tab.label} href={tab.href} active={active === tab.id}>
          {active === tab.id ? (
            <Image src={tab.activeIcon} alt="" width={tab.iconWidth} height={24} />
          ) : tab.id === "home" ? (
            <span className="flex size-6 items-center justify-center">
              <Image src={tab.icon} alt="" width={18} height={18} />
            </span>
          ) : (
            <Image src={tab.icon} alt="" width={tab.iconWidth} height={24} />
          )}
        </NavItem>
      ))}
      <NavItem label="You" href="/profile" active={active === "you"}>
        <span className="relative flex size-6">
          <Avatar name={user.name} photoUrl={user.photoUrl} size={24} />
          <Image src="/icons/home/status-away.svg" alt="" width={9} height={9} className="absolute -right-0.5 bottom-0" />
        </span>
      </NavItem>
    </nav>
  );
}

function NavItem({
  label,
  href,
  active,
  onClick,
  children,
}: {
  label: string;
  href: string | null;
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = active
    ? "flex items-center gap-1 rounded-[43px] bg-nav-active py-1.5 pl-4 pr-[19px]"
    : "flex h-6 w-[30px] items-center justify-center";
  const content = (
    <>
      {children}
      {active ? <span className="font-body text-sm font-medium leading-5 text-heading">{label}</span> : <span className="sr-only">{label}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <button type="button" className={`${className} cursor-not-allowed`} aria-disabled title={`${label} — coming soon`}>
      {content}
    </button>
  );
}
