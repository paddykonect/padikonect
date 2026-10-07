"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/features/auth/require-auth";
import { RequireCountry } from "@/features/profile/require-country";

// Matches Figma node 198:8589 ("location") and PRD Flow 1 step 7: "After the
// Taste Picker, request location permission (for PadiRadar). Whether
// permission is granted or denied, land on the Discover tab." PadiRadar
// itself isn't built yet, so this only requests the browser permission (for
// when PadiRadar lands) — the resulting coordinates aren't used yet.

function LocationContent() {
  const router = useRouter();

  function proceed() {
    router.push("/home");
  }

  function handleAllow() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(proceed, proceed);
    } else {
      proceed();
    }
  }

  return (
    <>
      <ProgressBar percent={90} />
      <div className="flex flex-1 flex-col justify-between gap-4 px-5 pb-4 pt-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-24 items-center justify-center rounded-full bg-ink">
            <Image src="/icons/location-pin.svg" alt="" width={40} height={40} />
          </div>
          <h1 className="font-heading text-xl font-bold leading-[28px] text-heading">Find padis and hangouts near you</h1>
          <p className="font-body text-sm leading-[21px] text-body-text">
            PadiRadar uses your location to show nearby hangouts, restaurants and lounges — and to help friends find you when
            you&apos;re headed to a hangout.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button type="button" variant="primary" onClick={handleAllow}>
            Allow location
          </Button>
          <Button type="button" variant="text" onClick={proceed}>
            Not now
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LocationPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <LocationContent />
      </RequireCountry>
    </RequireAuth>
  );
}
