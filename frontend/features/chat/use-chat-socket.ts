"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { ChatMessage } from "./types";

// Socket.IO lives at the API origin (no /api/v1 prefix), namespace /chat.
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/api\/v\d+\/?$/, "");

/** Live `message:new` events for the signed-in user; reconnects when the token rotates. */
export function useChatSocket(accessToken: string | null, onMessage: (m: ChatMessage) => void) {
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = io(`${SOCKET_URL}/chat`, { auth: { token: accessToken }, transports: ["websocket"] });
    socket.on("message:new", (m: ChatMessage) => handlerRef.current(m));
    return () => {
      socket.close();
    };
  }, [accessToken]);
}
