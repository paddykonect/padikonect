"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import { phoneError } from "@/features/auth/validation";
import * as profileApi from "@/features/profile/api";
import { INTEREST_OPTIONS } from "@/features/profile/interests";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { ApiError } from "@/lib/api/client";
import { cloudinaryDisplayUrl, uploadImageDetailed } from "@/lib/media/cloudinary";

const MAX_PHOTOS = 12;
const VIBE_OPTIONS = ["Easygoing", "Coffee person", "Curious explorer", "Night owl", "Foodie", "Adventurer", "Homebody", "Social butterfly"];

type GalleryItem = { url: string; publicId?: string };

function inviteLabel(plans: string[], wants: string | null): string {
  if (plans.length) return plans.join(" · ");
  return wants?.trim() || "Anything — Surprise me";
}

// Figma node 379:1489 ("Edit profile").
function EditProfileContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile, setProfile } = useOwnProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [vibe, setVibe] = useState<string[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [showAge, setShowAge] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [interestSheet, setInterestSheet] = useState(false);
  const [vibeSheet, setVibeSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || loaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(profileName(profile));
    setPhoneLocal(profile.phone?.replace(/^\+234/, "") ?? "");
    setBio(profile.bio ?? "");
    setInterests(profile.interests);
    setVibe(profile.vibe);
    setGallery(profile.photos.map((p) => ({ url: p.url, publicId: p.publicId ?? undefined })));
    setShowAge(profile.showAge);
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
      const img = await uploadImageDetailed(file, params);
      setProfile(await profileApi.updateAvatar(accessToken, `${img.url}${img.url.includes("?") ? "&" : "?"}v=${Date.now()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your photo.");
    } finally {
      setUploading(false);
    }
  }

  async function addGalleryPhoto(file: File) {
    if (!accessToken) return;
    setGalleryUploading(true);
    setError(null);
    try {
      const params = await profileApi.getPhotoUploadSignature(accessToken);
      const img = await uploadImageDetailed(file, params);
      setGallery((g) => (g.length >= MAX_PHOTOS ? g : [...g, { url: img.url, publicId: img.publicId }]));
      setGalleryDirty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that photo.");
    } finally {
      setGalleryUploading(false);
    }
  }

  function removeGalleryPhoto(url: string) {
    setGallery((g) => g.filter((p) => p.url !== url));
    setGalleryDirty(true);
  }

  function addTag(list: string[], set: (v: string[]) => void, tag: string) {
    const t = tag.trim();
    if (!t || list.includes(t) || list.length >= 10) return;
    set([...list, t]);
  }

  async function handleSave() {
    if (!accessToken || !profile || saving || phoneInvalid || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await profileApi.updateOwnProfile(accessToken, {
        displayName: name.trim(),
        bio: bio.trim(),
        interests,
        vibe,
        showAge,
        ...(galleryDirty && { photos: gallery }),
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
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative size-[88px]">
            <Avatar name={name} photoUrl={profile?.photoUrl ?? null} size={88} className="!bg-accent/35" />
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
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handlePhoto(f); }} />
        </div>

        {/* About you */}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-bold text-heading">About you</h2>
          <TextField aria-label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="name" />
          <PhoneField
            aria-label="Phone number"
            placeholder="Enter phone number"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
            error={phoneInvalid ? (phoneError(phoneLocal) ?? undefined) : undefined}
            autoComplete="tel-national"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-[13px] font-medium text-heading">Age</span>
              <TextField aria-label="Age" value={profile?.age != null ? String(profile.age) : "—"} readOnly disabled />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-[13px] font-medium text-heading">Location</span>
              <div className="flex h-[46px] items-center gap-2 rounded-field border border-border-subtle bg-card px-[13px]" title="Set during onboarding">
                <span className="min-w-0 flex-1 truncate font-body text-sm text-heading">{location || "Not set"}</span>
                <Link href="/country" aria-label="Change location">
                  <Image src="/icons/notif-location.svg" alt="" width={16} height={16} className="dark-invert" />
                </Link>
              </div>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-[13px] font-medium text-heading">Short bio</span>
            <TextField placeholder="e.g. Rooftop lover" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} />
          </label>
        </section>

        {/* Profile fotos */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-heading">Profile fotos</h2>
            <span className="font-body text-[13px] text-body-text">Manage all {gallery.length}</span>
          </div>
          <p className="font-body text-xs text-body-text">Add, remove or choose a new cover photo.</p>
          {gallery.length > 0 && (
            <div className="relative aspect-[345/220] w-full overflow-hidden rounded-2xl bg-border-subtle">
              <Image src={cloudinaryDisplayUrl(gallery[0].url, { width: 760 })} alt="" fill sizes="430px" className="object-cover" unoptimized />
              <button type="button" aria-label="Remove cover photo" onClick={() => removeGalleryPhoto(gallery[0].url)} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white">×</button>
              <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 font-body text-[10px] font-bold text-white">Cover</span>
            </div>
          )}
          {gallery.length > 1 && (
            <div className="grid grid-cols-3 gap-2.5">
              {gallery.slice(1).map((p) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-border-subtle">
                  <Image src={cloudinaryDisplayUrl(p.url, { width: 240 })} alt="" fill sizes="120px" className="object-cover" unoptimized />
                  <button type="button" aria-label="Remove photo" onClick={() => removeGalleryPhoto(p.url)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/70 text-sm text-white">×</button>
                </div>
              ))}
            </div>
          )}
          {gallery.length < MAX_PHOTOS && (
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-field border border-dashed border-body-text font-body text-sm font-medium text-heading">
              <Image src="/icons/plus.svg" alt="" width={14} height={14} />
              {galleryUploading ? "Uploading…" : "Add photos"}
            </button>
          )}
          <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - gallery.length); e.target.value = ""; files.forEach((f) => void addGalleryPhoto(f)); }} />
        </section>

        {/* Interests */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-heading">Interests</h2>
            <button type="button" onClick={() => setInterestSheet(true)} className="font-body text-[13px] font-bold text-heading">Add interests +</button>
          </div>
          <p className="font-body text-xs text-body-text">The things you love doing with your padis.</p>
          <div className="flex flex-wrap gap-2">
            {interests.map((tag) => (
              <button key={tag} type="button" onClick={() => setInterests((p) => p.filter((t) => t !== tag))} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border-subtle bg-card px-[13px] font-body text-xs text-heading">
                {tag} <span className="text-body-text">×</span>
              </button>
            ))}
            {interests.length === 0 && <span className="font-body text-xs text-body-text">None yet — add a few.</span>}
          </div>
        </section>

        {/* Your vibe */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-heading">Your vibe</h2>
            <button type="button" onClick={() => setVibeSheet(true)} className="font-body text-[13px] font-bold text-heading">Add vibe +</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {vibe.map((tag) => (
              <button key={tag} type="button" onClick={() => setVibe((p) => p.filter((t) => t !== tag))} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border-subtle bg-card px-[13px] font-body text-xs text-heading">
                <span className="size-1.5 rounded-full bg-accent" />
                {tag} <span className="text-body-text">×</span>
              </button>
            ))}
            {vibe.length === 0 && <span className="font-body text-xs text-body-text">None yet — add a few.</span>}
          </div>
        </section>

        {/* Profile preferences */}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-bold text-heading">Profile preferences</h2>
          <Link href="/profile/invite-preferences" className="flex items-center gap-3 rounded-field bg-card p-3.5">
            <span className="text-xl leading-none">🎉</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-body text-[11px] font-bold uppercase tracking-wide text-heading/60">Wants to be invited for</span>
              <span className="truncate font-body text-sm font-medium text-heading">{inviteLabel(profile?.invitePlans ?? [], profile?.wantsToBeInvitedFor ?? null)}</span>
            </span>
            <Image src="/icons/profile/chevron-right.svg" alt="" width={16} height={16} className="dark-invert" />
          </Link>
          <div className="flex items-center justify-between">
            <span className="flex flex-col">
              <span className="font-body text-sm font-medium text-heading">Show age on your profile</span>
              <span className="font-body text-xs text-body-text">{profile?.age != null ? `Your profile currently shows ${profile.age}.` : "Add your date of birth to show your age."}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showAge}
              aria-label="Show age on your profile"
              onClick={() => setShowAge((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${showAge ? "bg-ink" : "bg-border"}`}
            >
              <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${showAge ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </section>

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        <div className="mt-auto pt-2">
          <Button type="button" variant="primary" loading={saving} disabled={!profile || phoneInvalid || !name.trim()} onClick={() => void handleSave()}>
            Save changes
          </Button>
        </div>
      </main>

      <TagPickerSheet
        open={interestSheet}
        title="Add interests"
        description="Pick what you love doing, or add your own."
        options={INTEREST_OPTIONS}
        selected={interests}
        onToggle={(t) => setInterests((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 10 ? p : [...p, t]))}
        onAddCustom={(t) => addTag(interests, setInterests, t)}
        onClose={() => setInterestSheet(false)}
      />
      <TagPickerSheet
        open={vibeSheet}
        title="Add vibe"
        description="A few words that describe you."
        options={VIBE_OPTIONS}
        selected={vibe}
        onToggle={(t) => setVibe((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 10 ? p : [...p, t]))}
        onAddCustom={(t) => addTag(vibe, setVibe, t)}
        onClose={() => setVibeSheet(false)}
      />
    </div>
  );
}

function TagPickerSheet({
  open,
  title,
  description,
  options,
  selected,
  onToggle,
  onAddCustom,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
  onAddCustom: (tag: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`rounded-full border-2 px-4 py-2.5 font-body text-[13px] ${on ? "border-heading bg-ink font-bold text-white" : "border border-border bg-card text-heading"}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <TextField placeholder="Add your own" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={30} />
        </div>
        <Button
          type="button"
          variant="text"
          className="w-auto border border-border px-5"
          disabled={!custom.trim()}
          onClick={() => {
            onAddCustom(custom);
            setCustom("");
          }}
        >
          Add
        </Button>
      </div>
      <Button type="button" variant="primary" onClick={onClose}>
        Done
      </Button>
    </BottomSheet>
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
