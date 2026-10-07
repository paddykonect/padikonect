"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as chatApi from "@/features/chat/api";
import { ApiError } from "@/lib/api/client";

// Entry point for "Message" on a padi profile: finds or creates the one-to-one
// chat, then swaps itself out of history for the thread.
function OpenDirectChat() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    chatApi
      .openDirect(accessToken, userId)
      .then((c) => router.replace(`/chats/${c.id}`))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't open this chat."));
  }, [accessToken, userId, router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      {error ? (
        <>
          <p className="font-body text-sm text-danger">{error}</p>
          <Link href={`/padi/${userId}`} className="font-body text-sm font-bold text-heading underline">
            Back to their profile
          </Link>
        </>
      ) : (
        <p className="font-body text-sm text-body-text">Opening chat…</p>
      )}
    </div>
  );
}

export default function OpenDirectChatPage() {
  return (
    <RequireAuth>
      <OpenDirectChat />
    </RequireAuth>
  );
}
