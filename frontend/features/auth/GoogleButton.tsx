"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { OrDivider } from "./OrDivider";

// Minimal typing for the slice of Google Identity Services we use.
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: "popup" }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large";
      shape?: "pill";
      text?: "signin_with" | "signup_with" | "continue_with";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleButtonProps {
  text: "signin_with" | "signup_with";
  onCredential: (idToken: string) => void;
}

// Google's own rendered button (required by Google's branding rules), preceded
// by an "or" divider. Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
export function GoogleButton({ text, onCredential }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== "undefined" && !!window.google?.accounts?.id,
  );

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const el = containerRef.current;
    const gsi = window.google?.accounts?.id;
    if (!CLIENT_ID || !scriptLoaded || !el || !gsi) return;
    gsi.initialize({
      client_id: CLIENT_ID,
      ux_mode: "popup",
      callback: (r) => onCredentialRef.current(r.credential),
    });
    // GSI only accepts a fixed pixel width (max 400).
    const width = Math.min(400, Math.max(200, Math.floor(el.clientWidth)));
    gsi.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "pill", text, logo_alignment: "center", width });
  }, [scriptLoaded, text]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <OrDivider />
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptLoaded(true)} />
      <div ref={containerRef} className="flex h-[44px] w-full justify-center" />
    </>
  );
}
