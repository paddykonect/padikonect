"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { phoneError } from "@/features/auth/validation";
import * as profileApi from "@/features/profile/api";
import { PreferencesSheet } from "@/features/profile/PreferencesSheet";
import { RequireCountry } from "@/features/profile/require-country";
import { DRINK_PREFERENCE_LABEL, DrinkPreference } from "@/features/profile/types";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { ApiError } from "@/lib/api/client";
import { uploadImage } from "@/lib/media/cloudinary";

// Figma node 379:1489 ("Edit profile"). Email is the login identity, so it's
// read-only here; location is set by the onboarding Country/State steps.
function EditProfileContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile, setProfile } = useOwnProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [drink, setDrink] = useState<DrinkPreference>("BOTH");
  const [interests, setInterests] = useState<string[]>([]);
  const [wants, setWants] = useState("");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once the profile arrives.
  useEffect(() => {
    if (!profile || loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(profileName(profile));
    setPhoneLocal(profile.phone?.replace(/^\+234/, "") ?? "");
    setDrink(profile.drinkPreference);
    setInterests(profile.interests);
    setWants(profile.wantsToBeInvitedFor ?? "");
    setLoaded(true);
  }, [profile, loaded]);

  const phoneInvalid = phoneLocal !== "" && phoneError(phoneLocal) !== null;
  const location = [profile?.state, profile?.country].filter(Boolean).join(", ");

  async function handlePhoto(file: File) {
    if (!accessToken) return;
    setUploading(true);
    setError(null);
    try {
      const params = await profileApi.getAvatarUploadSignature(accessToken);
      const url = await uploadImage(file, params);
      // Same public_id is overwritten each time; bust caches with a version.
      setProfile(await profileApi.updateAvatar(accessToken, `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your photo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!accessToken || !profile || saving || phoneInvalid || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, {
        displayName: name.trim(),
        drinkPreference: drink,
        interests,
        ...(wants.trim() !== (profile.wantsToBeInvitedFor ?? "") && { wantsToBeInvitedFor: wants.trim() }),
        ...(phoneLocal && `+234${phoneLocal}` !== profile.phone && { phone: `+234${phoneLocal}` }),
      });
      router.push("/profile");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your changes.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="flex items-center gap-3 px-5 py-4">
        <Link href="/profile" aria-label="Back" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} className="dark-invert" />
        </Link>
        <h1 className="flex-1 font-heading text-xl font-bold text-heading">Edit profile</h1>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-1">
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative size-[88px]">
            {profile?.photoUrl ? (
              <Avatar name={name} photoUrl={profile.photoUrl} size={88} />
            ) : (
              <span className="flex size-[88px] items-center justify-center rounded-full bg-accent/35 font-heading text-[28px] font-bold text-heading">
                {name
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : ""))
                  .join("")
                  .toUpperCase()}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
              className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-ink"
            >
              <Image src="/icons/profile/camera.svg" alt="" width={14} height={14} />
            </button>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="font-body text-[13px] font-bold text-heading">
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handlePhoto(file);
            }}
          />
        </div>

        <TextField aria-label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="name" />
        <PhoneField
          aria-label="Phone number"
          placeholder="Enter phone number"
          value={phoneLocal}
          onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
          error={phoneInvalid ? (phoneError(phoneLocal) ?? undefined) : undefined}
          autoComplete="tel-national"
        />
        <TextField aria-label="Email" value={profile?.email ?? ""} readOnly disabled icon={<Image src="/icons/profile/mail.svg" alt="" width={24} height={24} className="dark-invert" />} />
        <div className="flex h-[46px] items-center gap-3 rounded-field border border-border-subtle bg-card px-[15px]" title="Set during onboarding">
          <span className="flex-1 font-body text-sm text-heading">{location || "Location not set"}</span>
          <Link href="/country" aria-label="Change location">
            <Image src="/icons/profile/info.svg" alt="" width={16} height={16} className="dark-invert" />
          </Link>
        </div>

        <button type="button" onClick={() => setPrefsOpen(true)} className="flex items-center justify-between rounded-field bg-card p-3.5 text-left">
          <span className="flex flex-col gap-0.5">
            <span className="font-body text-sm font-medium text-heading">Drink preference &amp; interests</span>
            <span className="font-body text-[12.5px] text-body-text">
              {DRINK_PREFERENCE_LABEL[drink]} · {interests.length} interest{interests.length === 1 ? "" : "s"} selected
            </span>
          </span>
          <Image src="/icons/profile/chevron-right.svg" alt="" width={16} height={16} className="dark-invert" />
        </button>

        <label className="flex flex-col gap-1.5">
          <span className="font-body text-[13px] font-medium text-heading">Wants to be invited for</span>
          <TextField
            placeholder="e.g. Anything – surprise me"
            value={wants}
            onChange={(e) => setWants(e.target.value)}
            maxLength={80}
          />
        </label>

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        <div className="mt-auto">
          <Button type="button" variant="primary" loading={saving} disabled={!profile || phoneInvalid || !name.trim()} onClick={() => void handleSave()}>
            Save changes
          </Button>
        </div>
      </main>

      {prefsOpen && (
        <PreferencesSheet
          open
          drinkPreference={drink}
          interests={interests}
          onClose={() => setPrefsOpen(false)}
          onDone={(v) => {
            setDrink(v.drinkPreference);
            setInterests(v.interests);
            setPrefsOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <EditProfileContent />
      </RequireCountry>
    </RequireAuth>
  );
}
