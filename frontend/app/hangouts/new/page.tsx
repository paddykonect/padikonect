"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { DrinkCategory, EventMediaInput, EventPrivacy } from "@/features/events/types";
import { ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import {
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  PinIcon,
  SearchIcon,
  ShareIcon,
} from "@/features/hangouts/components/icons";
import { getGrantedPosition } from "@/features/hangouts/places";
import * as padisApi from "@/features/padis/api";
import { PadiUser } from "@/features/padis/types";
import { RequireCountry } from "@/features/profile/require-country";
import * as venuesApi from "@/features/venues/api";
import { VENUE_CATEGORY_LABEL, Venue } from "@/features/venues/types";
import { ApiError } from "@/lib/api/client";
import { cloudinaryDisplayUrl, uploadImageDetailed } from "@/lib/media/cloudinary";

const MapView = dynamic(() => import("@/features/home/components/GoogleMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});
const LocationPickerMap = dynamic(() => import("@/features/hangouts/components/GoogleLocationPicker"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

const DEFAULT_CENTER: [number, number] = [6.4281, 3.4219];
const AGE_MIN = 18;
const AGE_MAX = 99;

// "Customise" activity chips — text-only (Figma); each maps to a map-pin emoji.
const ACTIVITIES: Array<{ label: string; emoji: string }> = [
  { label: "Sport", emoji: "⚽" },
  { label: "Night out", emoji: "🌃" },
  { label: "Hobbies", emoji: "🎨" },
  { label: "Coffee", emoji: "☕" },
  { label: "Drinks", emoji: "🍻" },
  { label: "Food", emoji: "🍽️" },
  { label: "Music", emoji: "🎵" },
  { label: "Games", emoji: "🎮" },
  { label: "Movies", emoji: "🎬" },
  { label: "Outdoors", emoji: "🏖️" },
  { label: "Party", emoji: "💃" },
  { label: "Chill", emoji: "🧘" },
];
// "Choose inspiration" — ready-made activity ideas.
const INSPIRATION: Array<{ emoji: string; title: string; description: string; tag: string }> = [
  { emoji: "🌃", title: "Rooftop padi hangout", description: "Good music, snacks and sunset views. Come unwind, catch up, and enjoy the vibe!", tag: "Night out" },
  { emoji: "🎮", title: "Game night", description: "Board games, FIFA and plenty of trash talk. Bring your A-game.", tag: "Games" },
  { emoji: "🍽️", title: "Dinner & chats", description: "A relaxed dinner to meet new padis over good food.", tag: "Food" },
  { emoji: "⚽", title: "Sunday football", description: "5-a-side kickabout then drinks after. All levels welcome.", tag: "Sport" },
];
const LANGUAGES = ["English", "Pidgin", "Yoruba", "Igbo", "Hausa", "French", "Portuguese"];
const INTRO_SUGGESTIONS = [
  "Heyyy padi, so excited for this one — see you all there! 🎉",
  "What's good padis! Can't wait to link up, let's make it a good one 🙌",
  "Hey everyone, quick intro — I host these often, always good vibes. Turn up!",
  "Hi all! First time hosting this one, would love to meet everyone 😊",
];
// Suggested cover photos (placeholders — the host usually uploads their own).
const SUGGESTED_PHOTOS: EventMediaInput[] = [
  { url: "https://picsum.photos/seed/padi-rooftop/800/600", publicId: "suggested/rooftop" },
  { url: "https://picsum.photos/seed/padi-dinner/800/600", publicId: "suggested/dinner" },
  { url: "https://picsum.photos/seed/padi-games/800/600", publicId: "suggested/games" },
  { url: "https://picsum.photos/seed/padi-outdoors/800/600", publicId: "suggested/outdoors" },
];

const PRIVACY: Array<{ value: EventPrivacy; label: string }> = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVATE", label: "Private" },
  { value: "INVITE_ONLY", label: "Invite-only" },
];

// 7 numbered steps (Figma "N/7"); Review is the unnumbered final screen.
const STEPS = [
  "Create activity",
  "When?",
  "Where?",
  "Details",
  "Personalize",
  "Introduce yourself",
  "Invite padis",
  "Review & post",
] as const;

/** Where the hangout happens: a listed venue, or a pinned spot with a typed address. */
interface Spot {
  latitude: number;
  longitude: number;
  label: string;
  venue: Venue | null;
}

const fieldShell = "flex h-[46px] items-center gap-3 rounded-field border border-border bg-card px-4";

// Backend caps the hangout gallery at 6 (CreateEventDto @ArrayMaxSize(6)).
const MAX_PHOTOS = 6;
const inputClass = "min-w-0 flex-1 bg-transparent font-body text-[15px] leading-[22px] text-input-text placeholder:text-body-text outline-none";
const textareaClass = "min-h-[120px] w-full resize-none rounded-field border border-border bg-card p-4 font-body text-[15px] leading-[22px] text-input-text placeholder:text-body-text outline-none";
const cardClass = "flex flex-col gap-2 rounded-2xl bg-card p-4";

/** A dark pill/segmented or round toggle switch (Figma uses dark-green = on). */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ink" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** "YYYY-MM-DD" / "HH:mm" in local time, for the native pickers. */
function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeInput(d: Date) {
  return d.toTimeString().slice(0, 5);
}
function fmtDateShort(d: string) {
  if (!d) return "Date";
  return new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtTime12(t: string) {
  if (!t) return "--:--";
  const [h, m] = t.split(":").map(Number);
  const dt = new Date();
  dt.setHours(h, m);
  return dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtWeekday(d: string) {
  if (!d) return "";
  return new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Desktop browsers only focus a date/time input on click — showPicker() opens
// the native calendar/clock. Guarded: it throws without a user gesture and
// isn't in every browser.
function openPicker(e: SyntheticEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    el.showPicker?.();
  } catch {
    // Not user-activated or unsupported — the field still accepts keyboard entry.
  }
}

// Figma "Choose location" (377:354): search listed venues, or drag the map
// to drop the pin somewhere else and type its address.
function ChooseLocation({ initial, onClose, onConfirm }: { initial: Spot | null; onClose: () => void; onConfirm: (spot: Spot) => void }) {
  const { accessToken } = useAuth();
  const [center, setCenter] = useState<[number, number]>(initial ? [initial.latitude, initial.longitude] : DEFAULT_CENTER);
  const [venue, setVenue] = useState<Venue | null>(initial?.venue ?? null);
  const [query, setQuery] = useState(initial?.label ?? "");
  const [results, setResults] = useState<Venue[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (initial) return;
    void getGrantedPosition().then((p) => p && setCenter(p));
  }, [initial]);

  useEffect(() => {
    if (!accessToken || !showResults) return;
    const t = setTimeout(() => {
      venuesApi
        .listVenues(accessToken, { q: query.trim() || undefined })
        .then((page) => setResults(page.items.slice(0, 6)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [accessToken, query, showResults]);

  function pick(v: Venue) {
    setVenue(v);
    setQuery(v.name);
    setCenter([v.latitude, v.longitude]);
    setShowResults(false);
  }

  const label = venue ? venue.name : query.trim();

  return (
    <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col bg-background">
      <header className="flex items-center gap-3 px-5 py-4">
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/close.svg" alt="" width={16} height={16} className="dark-invert" />
        </button>
        <h1 className="font-heading text-xl font-bold text-heading">Choose location</h1>
      </header>
      <div className="relative z-10 px-5">
        <label className={`${fieldShell} border-transparent`}>
          <SearchIcon size={18} className="shrink-0 text-heading" />
          <input
            className={inputClass}
            placeholder="Search a location"
            value={query}
            onFocus={() => setShowResults(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setVenue(null);
              setShowResults(true);
            }}
          />
        </label>
        {showResults && results.length > 0 && (
          <ul className="absolute inset-x-5 top-[50px] overflow-hidden rounded-2xl bg-card shadow-lg">
            {results.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => pick(v)} className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-toggle-bg">
                  <span className="font-body text-sm font-bold text-heading">{v.name}</span>
                  <span className="font-body text-xs text-body-text">
                    {VENUE_CATEGORY_LABEL[v.category]} · {v.addressText}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mx-5 mt-3 flex-1 overflow-hidden rounded-2xl" onPointerDown={() => setShowResults(false)}>
        <LocationPickerMap
          center={center}
          onMove={(lat, lng) => {
            setCenter([lat, lng]);
            if (venue) {
              setVenue(null);
              setQuery("");
            }
          }}
        />
      </div>
      <div className="flex flex-col gap-2 px-5 pb-6 pt-4">
        {!venue && !query.trim() && <p className="text-center font-body text-xs text-body-text">Pick a venue, or type the address of the pinned spot.</p>}
        <Button disabled={!label} onClick={() => onConfirm({ latitude: center[0], longitude: center[1], label, venue })}>
          Set location
        </Button>
      </div>
    </div>
  );
}

// Figma "HOST A HANGOUT" (section 882:3365): an 8-screen wizard (7 numbered
// steps + Review). ?venueId= pre-picks a venue and locks Where; ?edit=<id>
// reopens a hangout the venue declined.
function HostHangoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const presetVenueId = params.get("venueId");
  const { accessToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(Boolean(editId || presetVenueId));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1 — Create activity
  const [emoji, setEmoji] = useState<string | null>(null);
  const [activityTag, setActivityTag] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityTab, setActivityTab] = useState<"customise" | "inspiration">("customise");

  // 2 — When
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endOn, setEndOn] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // 3 — Where
  const [spot, setSpot] = useState<Spot | null>(null);
  const [originalSpot, setOriginalSpot] = useState<Spot | null>(null);
  const [picking, setPicking] = useState(false);
  const venueLocked = Boolean(presetVenueId);

  // 4 — Details
  const [startingGroupSize, setStartingGroupSize] = useState(1);
  const [minJoiners, setMinJoiners] = useState(2);
  const [capacity, setCapacity] = useState(10);
  const [byob, setByob] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [membershipOn, setMembershipOn] = useState(false);
  const [minPadiPoints, setMinPadiPoints] = useState("");
  const [minAge, setMinAge] = useState(AGE_MIN);
  const [maxAge, setMaxAge] = useState(AGE_MAX);
  const [privacy, setPrivacy] = useState<EventPrivacy>("PUBLIC");
  const [justChecking, setJustChecking] = useState(false);

  // 5 — Personalize
  // Photo gallery; position 0 is the cover (mirrors the backend's EventMedia[]).
  const [gallery, setGallery] = useState<EventMediaInput[]>([]);
  const [coverDirty, setCoverDirty] = useState(false);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 6 — Introduce yourself
  const [hostIntro, setHostIntro] = useState("");
  const [introTab, setIntroTab] = useState<"customize" | "suggestions">("customize");

  // 7 — Invite padis
  const [padis, setPadis] = useState<PadiUser[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [padiQuery, setPadiQuery] = useState("");
  const [inviteExpanded, setInviteExpanded] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phones, setPhones] = useState<string[]>([]);

  // Shared — "Edit activity" modal (remounted via key so its draft re-seeds)
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    padisApi.listPadis(accessToken).then(setPadis).catch(() => undefined);
    if (editId) {
      eventsApi
        .getEvent(accessToken, editId)
        .then((e) => {
          setEmoji(e.emoji);
          setTitle(e.title);
          setDescription(e.description ?? "");
          const start = new Date(e.startAt);
          setDate(toDateInput(start));
          setTime(toTimeInput(start));
          if (e.endAt) {
            const end = new Date(e.endAt);
            setEndOn(true);
            setEndDate(toDateInput(end));
            setEndTime(toTimeInput(end));
          }
          setCapacity(e.capacity);
          setStartingGroupSize(e.startingGroupSize ?? 1);
          setMinJoiners(e.minJoiners ?? 2);
          setByob(e.drinkCategory !== "NON_ALCOHOLIC");
          setLanguage(e.language);
          if (e.minAge != null) setMinAge(e.minAge);
          if (e.maxAge != null) setMaxAge(e.maxAge);
          if (e.minPadiPoints != null) {
            setMembershipOn(true);
            setMinPadiPoints(String(e.minPadiPoints));
          }
          setPrivacy(e.privacy);
          setHostIntro(e.hostIntro ?? "");
          setExistingCoverUrl(e.coverImageUrl);
          if (e.media?.length) {
            setGallery(e.media.map((m) => ({ url: m.url, publicId: "", type: m.type, width: m.width ?? undefined, height: m.height ?? undefined })));
          }
          const loaded: Spot = {
            latitude: e.latitude,
            longitude: e.longitude,
            label: e.venue?.name ?? e.addressText,
            venue: e.venue ? { ...e.venue, latitude: e.latitude, longitude: e.longitude, isFavorite: false } : null,
          };
          setSpot(loaded);
          setOriginalSpot(loaded);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this hangout."))
        .finally(() => setLoading(false));
    } else if (presetVenueId) {
      venuesApi
        .getVenue(accessToken, presetVenueId)
        .then((v) => setSpot({ latitude: v.latitude, longitude: v.longitude, label: v.name, venue: v }))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  }, [accessToken, editId, presetVenueId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const startAt = useMemo(() => (date && time ? new Date(`${date}T${time}`) : null), [date, time]);
  const endAt = useMemo(() => (endOn && endDate && endTime ? new Date(`${endDate}T${endTime}`) : null), [endOn, endDate, endTime]);

  function stepProblem(s: number): string | null {
    switch (s) {
      case 0:
        return title.trim().length < 3 ? "Give your hangout a name (3+ characters)." : null;
      case 1:
        if (!startAt) return "Set the date and time.";
        if (startAt.getTime() <= Date.now()) return "The start time must be in the future.";
        if (endAt && endAt.getTime() <= startAt.getTime()) return "The end time must be after the start.";
        return null;
      case 2:
        return spot ? null : "Choose where it's happening.";
      case 3:
        if (startingGroupSize > capacity) return "Starting group can't exceed the maximum.";
        if (minJoiners > capacity) return "Minimum joiners can't exceed the maximum.";
        if (membershipOn && !(minPadiPoints && Number(minPadiPoints) >= 0)) return "Enter the padi points needed to join.";
        return null;
      default:
        return null;
    }
  }

  function goNext() {
    const problem = stepProblem(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step === 3) {
      setJustChecking(true);
      return;
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }
  function goBack() {
    setError(null);
    if (step > 0) setStep((s) => s - 1);
  }
  function close() {
    router.push("/home");
  }

  function pickActivity(a: { label: string; emoji: string }) {
    if (activityTag === a.label) {
      setActivityTag(null);
      setEmoji(null);
    } else {
      setActivityTag(a.label);
      setEmoji(a.emoji);
    }
  }
  function resetActivity() {
    setActivityTag(null);
    setEmoji(null);
    setTitle("");
    setDescription("");
  }

  async function addImage(file: File) {
    if (!accessToken) return;
    setUploading(true);
    setError(null);
    try {
      const sig = await eventsApi.getCoverUploadSignature(accessToken);
      const img = await uploadImageDetailed(file, sig);
      setGallery((g) => (g.length >= MAX_PHOTOS ? g : [...g, { url: img.url, publicId: img.publicId, width: img.width, height: img.height }]));
      setCoverDirty(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function toggleInvite(id: string) {
    setInvited((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }
  function addPhone() {
    const digits = phoneDraft.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Enter a 10-digit Nigerian number.");
      return;
    }
    const full = `+234${digits}`;
    if (!phones.includes(full)) setPhones((list) => [...list, full]);
    setPhoneDraft("");
    setError(null);
  }

  async function publish() {
    if (!accessToken || !spot || !startAt) return;
    for (let s = 0; s <= 3; s++) {
      const problem = stepProblem(s);
      if (problem) {
        setError(problem);
        setStep(s);
        return;
      }
    }
    setPublishing(true);
    setError(null);
    const location = {
      addressText: spot.venue ? spot.venue.addressText : spot.label,
      latitude: spot.latitude,
      longitude: spot.longitude,
      ...(spot.venue && { venueId: spot.venue.id }),
    };
    const pointsNumber = minPadiPoints ? Number(minPadiPoints) : null;
    const details = {
      title: title.trim(),
      ...(description.trim() && { description: description.trim() }),
      startAt: startAt.toISOString(),
      ...(endAt && { endAt: endAt.toISOString() }),
      capacity,
      startingGroupSize,
      minJoiners,
      drinkCategory: (byob ? "ALCOHOLIC" : "NON_ALCOHOLIC") as DrinkCategory,
      ...(emoji && { emoji }),
      ...(activityTag && { tags: [activityTag] }),
      ...(language && { language }),
      ...((minAge > AGE_MIN || maxAge < AGE_MAX) && { minAge, maxAge }),
      ...(membershipOn && pointsNumber != null && { minPadiPoints: pointsNumber }),
      ...(hostIntro.trim() && { hostIntro: hostIntro.trim() }),
    };
    const media = coverDirty ? { media: gallery } : {};
    try {
      const event = editId
        ? await eventsApi.updateEvent(accessToken, editId, {
            ...details,
            ...media,
            ...(spot === originalSpot ? {} : location),
          })
        : await eventsApi.createEvent(accessToken, { ...details, ...media, ...location, privacy });
      if (invited.length) await eventsApi.invitePadis(accessToken, event.id, invited).catch(() => undefined);
      if (phones.length) await eventsApi.setPhoneInvites(accessToken, event.id, phones).catch(() => undefined);
      router.replace(event.venueApproval === "PENDING" ? `/hangouts/${event.id}/venue` : `/hangouts/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish. Please try again.");
      setPublishing(false);
    }
  }

  if (loading) return <ScreenMessage text="Loading…" />;

  const isLast = step === STEPS.length - 1;
  const coverUrl = gallery[0]?.url ?? (coverDirty ? null : existingCoverUrl);
  const filteredPadis = padis.filter((p) => (p.displayName ?? "").toLowerCase().includes(padiQuery.trim().toLowerCase()));
  const nextLabel = isLast ? (publishing ? "Posting…" : editId ? "Resend" : "Post activity") : "Next";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      {/* Header: × close · centred title · N/7 counter */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background px-5 py-4">
        <button type="button" onClick={close} aria-label="Close" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
          <Image src="/icons/close.svg" alt="" width={15} height={15} className="dark-invert" />
        </button>
        <h1 className="font-heading text-lg font-bold text-heading">{editId ? "Modify request" : STEPS[step]}</h1>
        <span className="min-w-9 text-right font-body text-sm text-body-text">{isLast ? "" : `${step + 1}/7`}</span>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-6">
        {/* Activity recap + Edit (steps 1–5) */}
        {step >= 1 && step <= 5 && (
          <div className="flex flex-col gap-2.5">
            <div className={`${fieldShell}`}>
              <span className="truncate font-body text-[15px] text-input-text">
                {emoji && <span className="mr-1.5">{emoji}</span>}
                {title.trim() || "Your hangout"}
              </span>
            </div>
            {description.trim() && (
              <div className="rounded-field border border-border bg-card p-4">
                <p className="line-clamp-3 font-body text-[14px] leading-[20px] text-body-text">{description.trim()}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setEditKey((k) => k + 1);
                setEditOpen(true);
              }}
              className="self-start font-body text-[13px] font-bold text-heading underline underline-offset-2"
            >
              Edit
            </button>
          </div>
        )}

        {step === 0 && (
          <>
            {/* Underline tabs */}
            <div className="flex gap-6 border-b border-border">
              {(["customise", "inspiration"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityTab(t)}
                  className={`-mb-px border-b-2 pb-2.5 font-body text-sm ${activityTab === t ? "border-ink font-bold text-heading" : "border-transparent text-body-text"}`}
                >
                  {t === "customise" ? "Customise" : "Choose inspiration"}
                </button>
              ))}
            </div>

            {activityTab === "customise" ? (
              <>
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      aria-pressed={activityTag === a.label}
                      onClick={() => pickActivity(a)}
                      className={`h-[40px] shrink-0 rounded-full border px-5 font-body text-sm ${activityTag === a.label ? "border-ink bg-ink font-bold text-white" : "border-border bg-card text-heading"}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <TextField placeholder="What is your activity called?" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
                <textarea placeholder="Describe what you are inviting padi's to" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
                <button type="button" onClick={resetActivity} className="self-start font-body text-[13px] font-bold text-heading underline underline-offset-2">
                  Reset
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2.5">
                {INSPIRATION.map((idea) => (
                  <button
                    key={idea.title}
                    type="button"
                    onClick={() => {
                      setEmoji(idea.emoji);
                      setActivityTag(idea.tag);
                      setTitle(idea.title);
                      setDescription(idea.description);
                      setActivityTab("customise");
                    }}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left"
                  >
                    <span className="text-2xl">{idea.emoji}</span>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-heading text-base font-bold text-heading">{idea.title}</span>
                      <span className="font-body text-[13px] text-body-text">{idea.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeCard label="From" dateValue={date} timeValue={time} onDate={setDate} onTime={setTime} minDate={toDateInput(new Date())} />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[13px] text-body-text">Till (optional)</span>
                  <Toggle on={endOn} onChange={setEndOn} label="Add an end time" />
                </div>
                <DateTimeCard label="" dateValue={endDate} timeValue={endTime} onDate={setEndDate} onTime={setEndTime} minDate={date || toDateInput(new Date())} disabled={!endOn} />
              </div>
            </div>
            {startAt && <p className="font-body text-[13px] font-bold text-heading">{fmtWeekday(date)}</p>}
            <div className="flex items-start gap-3 rounded-2xl bg-card p-4">
              <span className="text-xl">🚀</span>
              <div>
                <p className="font-body text-sm font-bold text-heading">Tip</p>
                <p className="font-body text-[13px] text-body-text">Activities created 7 days in advance have the best show-up rate!</p>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <button
              type="button"
              onClick={() => !venueLocked && setPicking(true)}
              disabled={venueLocked}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-ink bg-card font-body text-sm font-bold text-heading"
            >
              <PinIcon size={18} className="text-heading" />
              {spot ? spot.label : "Set location"}
            </button>
            {spot && (
              <div className="relative h-[220px] w-full overflow-hidden rounded-2xl">
                <div className="pointer-events-none size-full">
                  <MapView
                    key={`${spot.latitude},${spot.longitude}`}
                    center={[spot.latitude, spot.longitude]}
                    pins={[{ id: "spot", latitude: spot.latitude, longitude: spot.longitude, emoji: emoji ?? "", dot: !emoji, label: spot.label }]}
                    selectedId={null}
                    onSelect={() => undefined}
                    resizeKey={0}
                    interactive={false}
                  />
                </div>
              </div>
            )}
            {venueLocked && <p className="font-body text-xs text-body-text">This hangout is at {spot?.label ?? "the venue"}, so the location is set.</p>}
            {spot?.venue && !editId && (
              <p className="rounded-xl bg-toggle-bg px-3 py-2 font-body text-xs text-body-text">{spot.venue.name} will need to confirm before your hangout goes live.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <SliderCard label="Starting group size" subtitle={`${startingGroupSize} ${startingGroupSize === 1 ? "person" : "people"} (including yourself)`} min={1} max={Math.max(capacity, 1)} value={startingGroupSize} onChange={setStartingGroupSize} />
            <SliderCard label="Minimum number of joiners" subtitle={`${minJoiners} total (including yourself)`} min={1} max={Math.max(capacity, 1)} value={minJoiners} onChange={setMinJoiners} />
            <SliderCard label="Maximum number of joiners" subtitle={`${capacity} total (including yourself)`} min={1} max={50} value={capacity} onChange={setCapacity} />
            <button type="button" onClick={() => setLanguageOpen(true)} className={`${cardClass} flex-row items-center justify-between`}>
              <span className="font-body text-sm font-bold text-heading">Which languages are spoken?</span>
              <span className="flex items-center gap-1 font-body text-[13px] text-body-text">
                {language ?? "All languages"}
                <ChevronRightIcon size={16} className="text-body-text" />
              </span>
            </button>
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm font-bold text-heading">BYOB</span>
                <Toggle on={byob} onChange={setByob} label="Bring your own booze" />
              </div>
              <p className="font-body text-xs text-body-text">Bring your own booze</p>
            </div>
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm font-bold text-heading">Membership-only</span>
                <Toggle on={membershipOn} onChange={setMembershipOn} label="Members only" />
              </div>
              {membershipOn ? (
                <>
                  <TextField type="number" inputMode="numeric" min={0} placeholder="Min padi points to join" value={minPadiPoints} onChange={(e) => setMinPadiPoints(e.target.value.replace(/\D/g, ""))} />
                  <p className="font-body text-xs text-body-text">Padi points are still rolling out, so a requirement will limit who can join for now.</p>
                </>
              ) : (
                <p className="font-body text-xs text-body-text">Only padis who meet your points threshold can join.</p>
              )}
            </div>
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm font-bold text-heading">Age</span>
                <span className="font-body text-sm text-body-text">{minAge} – {maxAge}</span>
              </div>
              <AgeRange min={minAge} max={maxAge} onChange={(lo, hi) => { setMinAge(lo); setMaxAge(hi); }} />
            </div>
            {!editId && (
              <div className={cardClass}>
                <span className="font-body text-sm font-bold text-heading">Privacy</span>
                <div className="flex flex-wrap gap-2">
                  {PRIVACY.map((p) => (
                    <button key={p.value} type="button" aria-pressed={privacy === p.value} onClick={() => setPrivacy(p.value)} className={`h-[37px] rounded-full border px-4 font-body text-[13px] ${privacy === p.value ? "border-ink bg-ink font-bold text-white" : "border-border bg-card text-heading"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p className="font-body text-sm text-body-text">Make your activity stand out with photos. The first one is your cover.</p>
            {gallery.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5">
                {gallery.map((m, i) => (
                  <div key={m.url} className="relative aspect-square overflow-hidden rounded-xl border-2 border-primary">
                    <Image src={cloudinaryDisplayUrl(m.url, { width: 240 })} alt="" fill sizes="120px" className="object-cover" unoptimized />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-ink/70 px-2 py-0.5 font-body text-[10px] font-bold text-white">Cover</span>}
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => { setGallery((g) => g.filter((x) => x.url !== m.url)); setCoverDirty(true); }}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink/70 text-sm text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {gallery.length < MAX_PHOTOS && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-body-text bg-[#eef3e9] text-body-text">
                    <CameraIcon size={22} />
                    <span className="font-body text-[11px]">{uploading ? "Uploading…" : "Add"}</span>
                  </button>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="relative h-[200px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-body-text bg-[#eef3e9]">
                <span className="flex size-full flex-col items-center justify-center gap-2 text-body-text">
                  <CameraIcon size={26} />
                  <span className="font-body text-[13px]">{uploading ? "Uploading…" : "Add photos"}</span>
                </span>
                <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-ink/70 text-white">
                  <CameraIcon size={16} />
                </span>
              </button>
            )}
            <p className="font-body text-sm text-body-text">Or choose from the following images</p>
            <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTED_PHOTOS.map((p) => {
                const selected = gallery.some((x) => x.url === p.url);
                return (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => {
                      setGallery((g) => (selected ? g.filter((x) => x.url !== p.url) : g.length >= MAX_PHOTOS ? g : [...g, p]));
                      setCoverDirty(true);
                    }}
                    className={`relative h-[72px] w-[90px] shrink-0 overflow-hidden rounded-xl border-2 ${selected ? "border-primary" : "border-transparent"}`}
                  >
                    <Image src={p.url} alt="" fill sizes="90px" className="object-cover" unoptimized />
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/30 text-white">
                        <CheckIcon size={18} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {editId && !coverDirty && existingCoverUrl && <p className="font-body text-xs text-body-text">Your current photos stay unless you change them.</p>}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - gallery.length); files.forEach((f) => void addImage(f)); e.target.value = ""; }} />
          </>
        )}

        {step === 5 && (
          <>
            <div className="flex rounded-full bg-toggle-bg p-1">
              {(["customize", "suggestions"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setIntroTab(t)} className={`h-10 flex-1 rounded-full font-body text-sm font-bold capitalize ${introTab === t ? "bg-ink text-white" : "text-body-text"}`}>
                  {t}
                </button>
              ))}
            </div>
            {introTab === "customize" ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-body-text">Your message in the group chat</span>
                  <span className="font-body text-xs text-body-text">{hostIntro.length} / 300</span>
                </div>
                <textarea placeholder="Say hi to the group" value={hostIntro} maxLength={300} onChange={(e) => setHostIntro(e.target.value)} className={textareaClass} />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {INTRO_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => { setHostIntro(s); setIntroTab("customize"); }} className="rounded-2xl border border-border bg-card px-4 py-3 text-left font-body text-sm text-heading">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <p className="font-body text-[13px] text-body-text">Invited padis get first access before the hangout goes public.</p>
            <label className={fieldShell}>
              <SearchIcon size={18} className="shrink-0 text-heading" />
              <input className={inputClass} placeholder="Search by name" value={padiQuery} onChange={(e) => setPadiQuery(e.target.value)} />
            </label>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm font-bold text-heading">{invited.length} selected</span>
              {padis.length > 0 && (
                <button type="button" onClick={() => setInvited(invited.length === padis.length ? [] : padis.map((p) => p.id))} className="flex items-center gap-2 font-body text-[13px] font-medium text-heading">
                  Select all
                  <span className={`flex size-6 items-center justify-center rounded-md border-2 ${invited.length === padis.length && padis.length > 0 ? "border-primary bg-primary text-ink" : "border-border"}`}>
                    {invited.length === padis.length && padis.length > 0 && <CheckIcon size={13} />}
                  </span>
                </button>
              )}
            </div>
            <div className="flex flex-col">
              {padis.length === 0 && <p className="py-2 font-body text-sm text-body-text">No padis yet — scan their code from Home to add them.</p>}
              {padis.length > 0 && filteredPadis.length === 0 && <p className="py-2 font-body text-sm text-body-text">No padis match &ldquo;{padiQuery}&rdquo;.</p>}
              {filteredPadis.map((p) => {
                const on = invited.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggleInvite(p.id)} className="flex items-center gap-3 py-2.5 text-left">
                    <Avatar name={p.displayName} photoUrl={p.photoUrl} size={44} />
                    <span className="flex-1 font-body text-sm font-medium text-heading">{p.displayName}</span>
                    <span className={`flex size-6 items-center justify-center rounded-md border-2 ${on ? "border-primary bg-primary text-ink" : "border-border"}`}>{on && <CheckIcon size={13} />}</span>
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={() => setInviteExpanded((v) => !v)} className="flex items-center gap-3 border-t border-border pt-4 text-left">
              <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-body-text">
                <ShareIcon size={16} className="text-heading" />
              </span>
              <span className="flex-1 font-body text-sm font-medium text-heading">Invite by phone number or share link</span>
              <ChevronRightIcon size={18} className={`text-heading transition-transform ${inviteExpanded ? "rotate-90" : ""}`} />
            </button>
            {inviteExpanded && (
              <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
                <span className="font-body text-sm font-bold text-heading">Invite by phone number</span>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PhoneField value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value.replace(/\D/g, ""))} placeholder="801 234 5678" />
                  </div>
                  <Button variant="text" className="w-auto border border-border px-5" onClick={addPhone}>Send</Button>
                </div>
                {phones.map((ph) => (
                  <div key={ph} className="flex items-center justify-between rounded-xl bg-toggle-bg px-3 py-2">
                    <span className="font-body text-sm text-heading">{ph}</span>
                    <button type="button" aria-label={`Remove ${ph}`} onClick={() => setPhones((list) => list.filter((x) => x !== ph))} className="font-body text-sm text-body-text">×</button>
                  </div>
                ))}
                {phones.length > 0 && <p className="font-body text-xs text-body-text">Each number gets a text with the invite link when you post.</p>}
                {editId && <ShareLinkRow eventId={editId} onToast={setToast} />}
              </div>
            )}
          </>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-3">
            {/* Title + description preview (Figma review top) */}
            <div className={fieldShell}>
              <span className="truncate font-body text-[15px] text-input-text">
                {emoji && <span className="mr-1.5">{emoji}</span>}
                {title.trim() || "Your hangout"}
              </span>
            </div>
            {description.trim() && (
              <div className="rounded-field border border-border bg-card p-4">
                <p className="font-body text-[14px] leading-[20px] text-body-text">{description.trim()}</p>
              </div>
            )}
            <div className="relative h-[190px] w-full overflow-hidden rounded-2xl bg-[#eef3e9]">
              {coverUrl ? (
                <Image src={cloudinaryDisplayUrl(coverUrl, { width: 760 })} alt="" fill sizes="430px" className="object-cover" unoptimized />
              ) : (
                <span className="flex size-full items-center justify-center text-5xl">{emoji || "🎉"}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
              <h2 className="font-heading text-lg font-bold text-heading">{title.trim() || "Untitled hangout"}</h2>
              <p className="flex items-center gap-2 font-body text-[13px] text-body-text">
                <Image src="/icons/hangout/calendar.svg" alt="" width={15} height={15} className="shrink-0" />
                {startAt ? `${fmtWeekday(date)}, ${fmtTime12(time)}` : "—"} · {spot?.label ?? "—"}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="rounded-full bg-toggle-bg px-3 py-1 font-body text-xs text-heading">{invited.length} padi{invited.length === 1 ? "" : "s"}</span>
                {startAt && (
                  <span className="rounded-full bg-primary px-3 py-1 font-body text-xs font-bold text-ink">{fmtWeekday(date)} by {fmtTime12(time)}</span>
                )}
              </div>
            </div>
            {hostIntro.trim() && (
              <div className="flex flex-col gap-1.5 rounded-2xl bg-card p-4">
                <span className="font-body text-sm font-bold text-heading">Your message to the group</span>
                <p className="font-body text-sm text-body-text">{hostIntro.trim()}</p>
              </div>
            )}
            {invited.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {padis.filter((p) => invited.includes(p.id)).slice(0, 8).map((p) => (
                  <Avatar key={p.id} name={p.displayName} photoUrl={p.photoUrl} size={40} />
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </main>

      {/* Footer: Previous + Next/Post */}
      <div className="sticky bottom-0 z-10 flex gap-3 bg-background px-5 pb-6 pt-3">
        {step > 0 && (
          <Button variant="text" className="flex-1 border border-border" onClick={goBack} disabled={publishing}>
            Previous
          </Button>
        )}
        <Button className="flex-1" onClick={() => (isLast ? void publish() : goNext())} disabled={publishing || uploading}>
          {nextLabel}
        </Button>
      </div>

      {picking && (
        <ChooseLocation
          initial={spot}
          onClose={() => setPicking(false)}
          onConfirm={(s) => {
            setSpot(s);
            setPicking(false);
          }}
        />
      )}

      <EditActivitySheet
        key={editKey}
        open={editOpen}
        title={title}
        description={description}
        onClose={() => setEditOpen(false)}
        onSave={(t, d) => {
          setTitle(t);
          setDescription(d);
          setEditOpen(false);
        }}
      />

      <BottomSheet open={languageOpen} onClose={() => setLanguageOpen(false)} title="Which languages are spoken?">
        <div className="flex flex-col">
          {["All languages", ...LANGUAGES].map((l) => {
            const selected = (l === "All languages" && !language) || l === language;
            return (
              <button key={l} type="button" onClick={() => { setLanguage(l === "All languages" ? null : l); setLanguageOpen(false); }} className="flex items-center justify-between py-3 text-left font-body text-sm text-heading">
                {l}
                {selected && <CheckIcon size={16} className="text-ink" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={justChecking} onClose={() => setJustChecking(false)} title="Just checking..">
        <div className="flex flex-col gap-3">
          <p className="-mt-2 font-body text-sm text-body-text">You told us this</p>
          <ul className="flex flex-col gap-2 rounded-2xl bg-[#f6f7d9] p-4">
            {[`Starting group of ${startingGroupSize}`, `Minimum ${minJoiners} joiners to lock it in`, `Max ${capacity} amigos`, ...(membershipOn && minPadiPoints ? [`Members only · ${minPadiPoints}+ padi points`] : [])].map((line) => (
              <li key={line} className="flex items-center gap-2 font-body text-sm text-heading">
                <CheckIcon size={16} className="shrink-0 text-ink" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button variant="text" className="flex-1 border border-border" onClick={() => setJustChecking(false)}>Back</Button>
            <Button className="flex-1" onClick={() => { setJustChecking(false); setStep(4); }}>This is correct</Button>
          </div>
        </div>
      </BottomSheet>

      <p aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        {toast && <span className="rounded-full bg-ink px-4 py-2 font-body text-[13px] text-white shadow-lg">{toast}</span>}
      </p>
    </div>
  );
}

// A From/Till date-time card: dark-green date header + white time body, each
// opening a native picker via an invisible overlaid input.
function DateTimeCard({ label, dateValue, timeValue, onDate, onTime, minDate, disabled }: { label: string; dateValue: string; timeValue: string; onDate: (v: string) => void; onTime: (v: string) => void; minDate: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="font-body text-[13px] text-body-text">{label}</span>}
      <div className={`overflow-hidden rounded-2xl border border-border ${disabled ? "opacity-50" : ""}`}>
        <label className="relative block bg-ink py-2.5 text-center">
          <span className="font-body text-sm font-bold text-white">{fmtDateShort(dateValue)}</span>
          <input type="date" aria-label="Date" min={minDate} value={dateValue} disabled={disabled} onClick={openPicker} onFocus={openPicker} onChange={(e) => onDate(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <label className="relative block bg-card py-3 text-center">
          <span className="font-body text-sm text-heading">{fmtTime12(timeValue)}</span>
          <input type="time" aria-label="Time" value={timeValue} disabled={disabled} onClick={openPicker} onFocus={openPicker} onChange={(e) => onTime(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function SliderCard({ label, subtitle, min, max, value, onChange }: { label: string; subtitle: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className={cardClass}>
      <span className="font-body text-sm font-bold text-heading">{label}</span>
      <span className="font-body text-[13px] text-body-text">{subtitle}</span>
      <input type="range" min={min} max={max} value={Math.min(Math.max(value, min), max)} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink" aria-label={label} />
    </div>
  );
}

// Dual-handle age slider (18–99). Both inputs overlap; .dual-range in
// globals.css makes only the thumbs clickable so each handle drags freely.
function AgeRange({ min, max, onChange }: { min: number; max: number; onChange: (lo: number, hi: number) => void }) {
  const pct = (v: number) => ((v - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
  return (
    <div className="relative h-6">
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
      <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
      <input type="range" min={AGE_MIN} max={AGE_MAX} value={min} aria-label="Minimum age" onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)} className="dual-range absolute inset-0 size-full" />
      <input type="range" min={AGE_MIN} max={AGE_MAX} value={max} aria-label="Maximum age" onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))} className="dual-range absolute inset-0 size-full" />
    </div>
  );
}

// Figma "Edit activity" modal — edits name + description on a draft so Cancel
// walks away cleanly. Parent remounts it (via key) each open to re-seed.
function EditActivitySheet({ open, title, description, onClose, onSave }: { open: boolean; title: string; description: string; onClose: () => void; onSave: (title: string, description: string) => void }) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);
  return (
    <BottomSheet open={open} onClose={onClose} title="Edit activity" description="Update your title and description.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-heading">Title</label>
          <TextField placeholder="Activity name" value={draftTitle} maxLength={100} onChange={(e) => setDraftTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-heading">Description</label>
          <textarea placeholder="Description" value={draftDescription} maxLength={2000} onChange={(e) => setDraftDescription(e.target.value)} className={textareaClass} />
        </div>
        <div className="flex gap-3">
          <Button variant="text" className="flex-1 border border-border" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={() => onSave(draftTitle, draftDescription)}>Save changes</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// The share link exists only once the hangout does (edit mode / the hangout page).
function ShareLinkRow({ eventId, onToast }: { eventId: string; onToast: (t: string) => void }) {
  const { accessToken } = useAuth();
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    if (!accessToken) return;
    eventsApi.getInviteLink(accessToken, eventId).then((r) => setPath(r.path)).catch(() => undefined);
  }, [accessToken, eventId]);
  if (!path) return null;
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${path}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      onToast("Invite link copied");
    } catch {
      onToast("Couldn't copy. Please try again.");
    }
  }
  async function shareVia() {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ url }).catch(() => undefined);
    } else {
      await copy();
    }
  }
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="font-body text-sm font-bold text-heading">Share invite link</span>
      <div className="flex items-center gap-2 rounded-xl bg-toggle-bg px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-body text-[13px] text-body-text">{url}</span>
        <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-body text-[13px] font-bold text-ink">
          <CopyIcon size={13} /> Copy
        </button>
      </div>
      <button type="button" onClick={() => void shareVia()} className="flex h-10 items-center justify-center gap-2 rounded-full border border-border font-body text-sm font-medium text-heading">
        <ShareIcon size={15} /> Share via…
      </button>
    </div>
  );
}

export default function HostHangoutPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        {/* useSearchParams needs a Suspense boundary. */}
        <Suspense fallback={<ScreenMessage text="Loading…" />}>
          <HostHangoutContent />
        </Suspense>
      </RequireCountry>
    </RequireAuth>
  );
}
