"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TabScreen } from "@/components/navigation/TabScreen";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as chatApi from "@/features/chat/api";
import { ChatImage } from "@/features/chat/ChatImage";
import { Conversation } from "@/features/chat/types";
import { useChatSocket } from "@/features/chat/use-chat-socket";
import { CheckIcon, SearchIcon } from "@/features/hangouts/components/icons";
import * as padisApi from "@/features/padis/api";
import { PadiListItem } from "@/features/padis/types";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { formatRelativeShort } from "@/lib/format/time";

type ChatTab = "all" | "hangouts" | "communities";
const TABS: [ChatTab, string][] = [
  ["all", "All"],
  ["hangouts", "Hangouts"],
  ["communities", "Communities"],
];
const TAB_TYPE: Record<Exclude<ChatTab, "all">, Conversation["type"]> = {
  hangouts: "EVENT",
  communities: "COMMUNITY",
};

// Figma node 379:666 ("Chats").
function ChatsContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [tab, setTab] = useState<ChatTab>("all");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [padiList, setPadiList] = useState<PadiListItem[] | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);

  const load = useCallback(
    (onError?: () => void) => {
      if (!accessToken) return;
      chatApi.listConversations(accessToken).then(setChats).catch(() => onError?.());
    },
    [accessToken],
  );

  useEffect(() => {
    load(() => setChats([]));
  }, [load]);

  // Any new message re-sorts the list and updates previews/unread dots.
  useChatSocket(accessToken, () => load());

  const markChatsRead = useCallback(
    async (ids: string[]) => {
      if (!accessToken || ids.length === 0) return;
      setChats((prev) => prev && prev.map((c) => (ids.includes(c.id) ? { ...c, unread: false } : c)));
      await Promise.all(ids.map((cid) => chatApi.markRead(accessToken, cid).catch(() => undefined)));
    },
    [accessToken],
  );

  function readAll() {
    setMenuOpen(false);
    void markChatsRead((chats ?? []).filter((c) => c.unread).map((c) => c.id));
  }

  function enterSelect() {
    setMenuOpen(false);
    setSelected(new Set());
    setSelectMode(true);
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markSelectedRead() {
    void markChatsRead([...selected]);
    exitSelect();
  }

  function openCompose() {
    setComposeOpen(true);
    if (!padiList && accessToken) {
      padisApi.listPadiDirectory(accessToken).then(setPadiList).catch(() => setPadiList([]));
    }
  }

  async function startDirect(userId: string) {
    if (!accessToken || composeBusy) return;
    setComposeBusy(true);
    try {
      const convo = await chatApi.openDirect(accessToken, userId);
      setComposeOpen(false);
      router.push(`/chats/${convo.id}`);
    } catch {
      setComposeBusy(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (chats ?? [])
      .filter((c) => tab === "all" || c.type === TAB_TYPE[tab])
      .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.lastMessage?.body ?? "").toLowerCase().includes(q));
  }, [chats, tab, query]);

  return (
    <TabScreen active="chat" user={{ name: profileName(profile, user?.fullName ?? ""), photoUrl: profile?.photoUrl ?? null }}>
      {/* Top actions: ⋯ menu (left) + new chat (right) — or the select-mode bar. */}
      {selectMode ? (
        <div className="flex items-center justify-between">
          <button type="button" onClick={exitSelect} className="font-body text-sm font-medium text-heading">
            Cancel
          </button>
          <span className="font-body text-sm font-bold text-heading">{selected.size} selected</span>
          <button type="button" onClick={markSelectedRead} disabled={selected.size === 0} className="font-body text-sm font-bold text-heading disabled:opacity-40">
            Mark read
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              type="button"
              aria-label="Chat options"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-card text-xl font-bold leading-none text-heading"
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-11 z-20 w-44 overflow-hidden rounded-2xl bg-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
                  <button type="button" onClick={enterSelect} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 font-body text-sm text-heading hover:bg-toggle-bg">
                    <span className="flex size-[18px] items-center justify-center rounded-full border-2 border-heading">
                      <CheckIcon size={11} />
                    </span>
                    Select chat
                  </button>
                  <button type="button" onClick={readAll} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 font-body text-sm text-heading hover:bg-toggle-bg">
                    <span className="flex w-[18px] shrink-0 justify-center text-heading">
                      <CheckIcon size={13} />
                    </span>
                    Read all
                  </button>
                </div>
              </>
            )}
          </div>
          <button type="button" aria-label="New chat" onClick={openCompose} className="flex size-10 items-center justify-center rounded-full bg-accent">
            <Image src="/icons/plus.svg" alt="" width={16} height={16} />
          </button>
        </div>
      )}

      {/* Search */}
      <label className="flex h-11 items-center gap-2.5 rounded-full border border-border bg-card px-4">
        <SearchIcon size={18} className="shrink-0 text-body-text" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, hangouts, lounges..."
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent font-body text-sm text-heading outline-none placeholder:text-body-text"
        />
      </label>

      <h1 className="font-heading text-2xl font-bold leading-8 text-heading">Chats</h1>

      {/* Filter tabs */}
      <div className="flex gap-2.5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`h-9 rounded-full px-4 font-body text-[13px] font-medium ${
              tab === id ? "bg-ink text-white" : "border border-border bg-card text-heading"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {chats === null ? (
        <p className="font-body text-sm text-body-text">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-heading text-lg font-bold text-heading">{query.trim() || tab !== "all" ? "No chats match" : "No chats yet"}</p>
          <p className="font-body text-[13px] text-body-text">
            {query.trim() || tab !== "all"
              ? "Try another search or filter."
              : "Join a hangout to chat with the group, or message a padi from their profile."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 pb-3">
          {visible.map((c) => {
            const preview = c.lastMessage ? `${c.lastMessage.senderId === user?.id ? "You: " : ""}${c.lastMessage.body}` : "Say hi 👋";
            const rowInner = (
              <>
                {selectMode && (
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected.has(c.id) ? "border-primary bg-primary text-ink" : "border-border"}`}>
                    {selected.has(c.id) && <CheckIcon size={13} />}
                  </span>
                )}
                <ChatImage chat={c} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate font-body text-sm text-heading ${c.unread ? "font-bold" : "font-medium"}`}>{c.title}</span>
                  <span className="truncate font-body text-[13px] text-body-text">{preview}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {c.lastMessage && <span className="font-body text-[11px] text-body-text">{formatRelativeShort(c.lastMessage.createdAt)}</span>}
                  {c.unread && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                </span>
              </>
            );
            return (
              <li key={c.id}>
                {selectMode ? (
                  <button type="button" onClick={() => toggleSelected(c.id)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left">
                    {rowInner}
                  </button>
                ) : (
                  <Link href={`/chats/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-2.5">
                    {rowInner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <BottomSheet open={composeOpen} onClose={() => setComposeOpen(false)} title="New chat" description="Start a direct chat with one of your padis.">
        {padiList === null ? (
          <p className="py-4 font-body text-sm text-body-text">Loading padis…</p>
        ) : padiList.length === 0 ? (
          <p className="py-4 font-body text-sm text-body-text">No padis yet — add padis to start a chat.</p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {padiList.map((p) => (
              <li key={p.user.id}>
                <button type="button" disabled={composeBusy} onClick={() => void startDirect(p.user.id)} className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50">
                  <Avatar name={p.user.displayName} photoUrl={p.user.photoUrl} size={44} />
                  <span className="min-w-0 flex-1 truncate font-body text-sm font-medium text-heading">{p.user.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </TabScreen>
  );
}

export default function ChatsPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <ChatsContent />
      </RequireCountry>
    </RequireAuth>
  );
}
