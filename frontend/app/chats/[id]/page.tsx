"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as chatApi from "@/features/chat/api";
import { ChatImage } from "@/features/chat/ChatImage";
import { ChatMessage, Conversation } from "@/features/chat/types";
import { useChatSocket } from "@/features/chat/use-chat-socket";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatClock } from "@/lib/format/time";

// A message as shown in the thread: server-confirmed, or an optimistic local
// copy that's still sending / failed (Figma's "Not delivered · tap to retry").
type ThreadMessage = ChatMessage & { state: "sent" | "sending" | "failed" };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Figma node 379:973 ("Chat thread").
function ThreadContent() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const [chat, setChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([chatApi.getConversation(accessToken, id), chatApi.listMessages(accessToken, id)])
      .then(([c, page]) => {
        setChat(c);
        setMessages(page.items.map((m) => ({ ...m, state: "sent" })));
        setHasMore(page.hasMore);
        void chatApi.markRead(accessToken, id).catch(() => undefined);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't open this chat."));
  }, [accessToken, id]);

  useLayoutEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const upsert = useCallback((incoming: ThreadMessage) => {
    setMessages((prev) => {
      const i = prev.findIndex((m) => m.clientId === incoming.clientId && m.sender.id === incoming.sender.id);
      if (i === -1) return [...prev, incoming];
      const next = prev.slice();
      next[i] = incoming;
      return next;
    });
  }, []);

  useChatSocket(accessToken, (m) => {
    if (m.conversationId !== id) return;
    stickToBottom.current = true;
    upsert({ ...m, state: "sent" });
    if (accessToken && m.sender.id !== user?.id) void chatApi.markRead(accessToken, id).catch(() => undefined);
  });

  async function deliver(message: ThreadMessage) {
    if (!accessToken) return;
    upsert({ ...message, state: "sending" });
    try {
      const saved = await chatApi.sendMessage(accessToken, id, message.body, message.clientId);
      upsert({ ...saved, state: "sent" });
    } catch {
      upsert({ ...message, state: "failed" });
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !user) return;
    setDraft("");
    stickToBottom.current = true;
    void deliver({
      id: `local-${crypto.randomUUID()}`,
      clientId: crypto.randomUUID(),
      conversationId: id,
      body,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, displayName: user.fullName, photoUrl: null, online: true, wantsToBeInvitedFor: null },
      state: "sending",
    });
  }

  async function loadOlder() {
    if (!accessToken || messages.length === 0) return;
    stickToBottom.current = false;
    const page = await chatApi.listMessages(accessToken, id, messages[0].id);
    setMessages((prev) => [...page.items.map((m) => ({ ...m, state: "sent" as const })), ...prev]);
    setHasMore(page.hasMore);
  }

  const isGroup = chat?.type === "EVENT" || chat?.type === "COMMUNITY";
  const infoHref = chat?.type === "DIRECT" && chat.otherUserId ? `/padi/${chat.otherUserId}` : null;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="flex items-center gap-2.5 border-b border-border-subtle bg-card px-4 pb-[15px] pt-3.5">
        <Link href="/chats" aria-label="Back" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <Image src="/icons/chat/back.svg" alt="" width={16} height={16} className="dark-invert" />
        </Link>
        {chat && (
          <>
            <ChatImage chat={chat} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-[15px] font-bold text-heading">{chat.title}</p>
              <p className="truncate font-body text-xs text-body-text">{chat.subtitle}</p>
            </div>
            {infoHref && (
              <Link href={infoHref} aria-label="Padi profile" className="flex size-8 items-center justify-center">
                <Image src="/icons/chat/info.svg" alt="" width={18} height={18} className="dark-invert" />
              </Link>
            )}
          </>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {hasMore && (
          <button type="button" onClick={() => void loadOlder()} className="self-center rounded-full bg-card px-3 py-1 font-body text-xs text-body-text">
            Load earlier messages
          </button>
        )}
        {chat && messages.length === 0 && (
          <p className="mt-10 text-center font-body text-[13px] text-body-text">
            {isGroup ? "Say hi to the group 👋" : `Start your chat with ${chat.title} 👋`}
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender.id === user?.id;
          const prev = messages[i - 1];
          const showDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m.id} className="flex flex-col gap-5">
              {showDay && (
                <span className="self-center rounded-full bg-card px-3 py-1 font-body text-xs text-body-text">{dayLabel(m.createdAt)}</span>
              )}
              {mine ? (
                <div className="flex max-w-[280px] flex-col items-end gap-1 self-end">
                  <button
                    type="button"
                    disabled={m.state !== "failed"}
                    onClick={() => void deliver(m)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    {m.state === "failed" && <Image src="/icons/chat/warning.svg" alt="" width={16} height={16} />}
                    <span className={`whitespace-pre-wrap break-words rounded-xl rounded-br-[4px] bg-ink px-3 py-2 font-body text-sm leading-[19.6px] text-white ${m.state === "sent" ? "" : "opacity-60"}`}>
                      {m.body}
                    </span>
                  </button>
                  <span className={`pr-0.5 font-body text-[10.5px] ${m.state === "failed" ? "text-[#b3261e]" : "text-body-text"}`}>
                    {m.state === "failed" ? "Not delivered · tap to retry" : m.state === "sending" ? "Sending…" : formatClock(m.createdAt)}
                  </span>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/35 font-body text-[11px] font-bold text-heading">
                    {initials(m.sender.displayName)}
                  </span>
                  <div className="flex max-w-[258px] flex-col gap-1">
                    {isGroup && <span className="pl-0.5 font-body text-[11.5px] text-body-text">{m.sender.displayName.split(" ")[0]}</span>}
                    <span className="whitespace-pre-wrap break-words rounded-xl rounded-bl-[4px] bg-card px-3 py-2 font-body text-sm leading-[19.6px] text-heading">{m.body}</span>
                    <span className="pl-0.5 font-body text-[10.5px] text-body-text">{formatClock(m.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-subtle bg-card px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-[11px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder={isGroup ? "Message the group" : chat ? `Message ${chat.title.split(" ")[0]}` : "Message"}
          aria-label="Message"
          className="h-[42px] min-w-0 flex-1 rounded-full border border-border bg-card px-[17px] font-body text-sm text-heading outline-none placeholder:text-body-text focus:border-border-focus"
        />
        <button type="submit" disabled={!draft.trim() || !chat} aria-label="Send" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent disabled:opacity-50">
          <Image src="/icons/chat/send.svg" alt="" width={16} height={16} />
        </button>
      </form>
    </div>
  );
}

export default function ChatThreadPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <ThreadContent />
      </RequireCountry>
    </RequireAuth>
  );
}
