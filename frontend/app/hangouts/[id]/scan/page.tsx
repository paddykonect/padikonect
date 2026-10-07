"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { CheckInResult, EventDetail } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { QrScanner } from "@/features/padis/QrScanner";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatClock, formatDayTime } from "@/lib/format/time";

// Figma "Scan padi" (360:915), host side: scan a guest's entry pass at the
// door to check them in.
function ScanPassContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Bumped to restart the camera for the next guest.
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    eventsApi
      .getEvent(accessToken, id)
      .then(setEvent)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this hangout."));
  }, [accessToken, id]);

  async function checkIn(raw: string) {
    if (!accessToken || checking) return;
    const code = raw.trim().toUpperCase();
    if (!/^PADI-[A-Z0-9]{6}$/.test(code)) {
      setError("That isn't a Padikonect entry pass.");
      setScanKey((k) => k + 1);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      setResult(await eventsApi.checkInPass(accessToken, id, code));
      setManual("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check this pass. Please try again.");
      setScanKey((k) => k + 1);
    } finally {
      setChecking(false);
    }
  }

  function next() {
    setResult(null);
    setError(null);
    setScanKey((k) => k + 1);
  }

  if (!event) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;
  if (!event.isHost) return <ScreenMessage text="Only the host can check guests in." onBack={() => router.back()} />;

  const guest = result?.user.displayName ?? "Padi";

  return (
    <FlowScreen title="Scan padi" backHref={`/hangouts/${id}`}>
      <p className="text-center font-body text-[13px] text-body-text">
        {event.title} · {formatDayTime(event.startAt)}
      </p>
      {result ? (
        <section className="flex flex-col items-center gap-3 rounded-[20px] bg-card p-6 text-center">
          <Avatar name={guest} photoUrl={result.user.photoUrl} size={64} />
          <p className="font-heading text-xl font-bold text-heading">{guest}</p>
          <p className={`rounded-full px-4 py-1.5 font-body text-[13px] font-bold ${result.alreadyCheckedIn ? "bg-toggle-bg text-heading" : "bg-ink text-white"}`}>
            {result.alreadyCheckedIn ? `Already checked in at ${formatClock(result.checkedInAt)}` : "Checked in ✓"}
          </p>
          <Button onClick={next}>Scan next padi</Button>
        </section>
      ) : (
        <>
          <QrScanner key={scanKey} onResult={(text) => void checkIn(text)} fallbackLabel="the pass code" />
          <p className="text-center font-body text-[13px] leading-[18px] text-body-text">Point your camera at the padi&apos;s QR code to verify their entry.</p>
          <div className="flex flex-col gap-2">
            <TextField placeholder="Or type the code, e.g. PADI-7X3K9Q" value={manual} autoCapitalize="characters" onChange={(e) => setManual(e.target.value)} />
            <Button variant="primary" disabled={!manual.trim()} loading={checking} onClick={() => void checkIn(manual)}>
              Check in
            </Button>
          </div>
        </>
      )}
      {error && <p className="text-center font-body text-sm text-danger">{error}</p>}
    </FlowScreen>
  );
}

export default function ScanPassPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <ScanPassContent />
      </RequireCountry>
    </RequireAuth>
  );
}
