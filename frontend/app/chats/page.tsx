"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TabScreen } from "@/components/navigation/TabScreen";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as chatApi from "@/features/chat/api";
import { ChatImage } from "@/features/chat/ChatImage";
import { Conversation } from "@/features/chat/types";
import { useChatSocket } from "@/features/chat/use-chat-socket";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { NightModeButton } from "@/features/theme/NightModeButton";
import { formatRelativeShort } from "@/lib/format/time";

// Figma node 379:666 ("Chats").
function ChatsContent() {
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const [chats, setChats] = useState<Conversation[] | null>(null);

  const load = useCallback(
    (onError?: () => void) => {
      if (!accessToken) return;
      chatApi
        .listConversations(accessToken)
        .then(setChats)
        .catch(() => onError?.());
    },
    [accessToken],
  );

  useEffect(() => {
    load(() => setChats([]));
  }, [load]);

  // Any new message re-sorts the list and updates previews/unread dots.
  useChatSocket(accessToken, () => load());

  return (
    <TabScreen active="chat" user={{ name: profileName(profile, user?.fullName ?? ""), photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold leading-8 text-heading">Chats</h1>
        <NightModeButton />
      </div>

      {chats === null ? (
        <p className="font-body text-sm text-body-text">Loading…</p>
      ) : chats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-heading text-lg font-bold text-heading">No chats yet</p>
          <p className="font-body text-[13px] text-body-text">Join a hangout to chat with the group, or message a padi from their profile.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 pb-3">
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={`/chats/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-2.5">
                <ChatImage chat={c} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate font-body text-sm text-heading ${c.unread ? "font-bold" : "font-medium"}`}>{c.title}</span>
                  <span className="truncate font-body text-[13px] text-body-text">
                    {c.lastMessage ? `${c.lastMessage.senderId === user?.id ? "You: " : ""}${c.lastMessage.body}` : "Say hi 👋"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {c.lastMessage && <span className="font-body text-[11px] text-body-text">{formatRelativeShort(c.lastMessage.createdAt)}</span>}
                  {c.unread && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
