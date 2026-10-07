"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { padiLink, parsePadiCode } from "@/features/padis/padi-link";
import { QrScanner } from "@/features/padis/QrScanner";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";

type Mode = "scan" | "code";

// Figma node 360:915 ("Scan padi") plus a "My code" tab so there's a code to
// scan: each user's QR encodes a link to their padi profile.
function ScanContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useOwnProfile();
  const [mode, setMode] = useState<Mode>("scan");
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "code" || !user) return;
    QRCode.toDataURL(padiLink(user.id), { margin: 1, width: 560, color: { dark: "#1b3b2b", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [mode, user]);

  function handleCode(raw: string) {
    const id = parsePadiCode(raw);
    if (!id) {
      setMessage({ text: "That isn't a Padikonect code.", isError: true });
      return;
    }
    if (id === user?.id) {
      setMessage({ text: "That's your own code — scan a padi's instead.", isError: true });
      return;
    }
    router.push(`/padi/${id}`);
  }

  const name = profileName(profile, user?.fullName ?? "");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="flex items-center gap-3 px-5 py-4">
        <Link href="/home" aria-label="Back" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} className="dark-invert" />
        </Link>
        <h1 className="flex-1 font-heading text-xl font-bold text-heading">Scan padi</h1>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 pb-8 pt-1">
        <div role="tablist" className="flex rounded-full border border-border bg-toggle-bg p-1">
          {(["scan", "code"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setMessage(null);
              }}
              className={`flex h-9 flex-1 items-center justify-center rounded-full font-body text-[13px] font-bold ${
                mode === m ? "bg-ink text-white" : "text-body-text"
              }`}
            >
              {m === "scan" ? "Scan a code" : "My code"}
            </button>
          ))}
        </div>

        {mode === "scan" ? (
          <>
            <QrScanner onResult={handleCode} />
            <p className="text-center font-body text-[13px] leading-[18px] text-body-text">
              Point your camera at your padi&apos;s QR code to add them.
            </p>
            <div className="flex flex-col gap-2">
              <TextField placeholder="Or paste a padi link" value={manual} onChange={(e) => setManual(e.target.value)} />
              <Button type="button" variant="primary" disabled={!manual.trim()} onClick={() => handleCode(manual)}>
                Find padi
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-6">
            <Avatar name={name} photoUrl={profile?.photoUrl ?? null} size={56} />
            <p className="font-heading text-lg font-bold text-heading">{name}</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated data URL
              <img src={qr} alt="Your padi QR code" className="size-[240px] rounded-xl" />
            ) : (
              <div className="size-[240px] animate-pulse rounded-xl bg-border-subtle" />
            )}
            <p className="text-center font-body text-[13px] text-body-text">Let a padi scan this to add you.</p>
            {user && (
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  void navigator.clipboard?.writeText(padiLink(user.id));
                  setMessage({ text: "Link copied.", isError: false });
                }}
              >
                Copy my padi link
              </Button>
            )}
          </div>
        )}
        {message && <p className={`text-center font-body text-sm ${message.isError ? "text-danger" : "text-heading"}`}>{message.text}</p>}
      </main>
    </div>
  );
}

export default function ScanPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <ScanContent />
      </RequireCountry>
    </RequireAuth>
  );
}
