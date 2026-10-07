"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { DrinkCategory, EventPrivacy } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { CalendarIcon, CameraIcon, CheckIcon, ClockIcon, PlusIcon, SearchIcon } from "@/features/hangouts/components/icons";
import { getGrantedPosition } from "@/features/hangouts/places";
import * as padisApi from "@/features/padis/api";
import { PadiUser } from "@/features/padis/types";
import { RequireCountry } from "@/features/profile/require-country";
import * as venuesApi from "@/features/venues/api";
import { VENUE_CATEGORY_LABEL, Venue } from "@/features/venues/types";
import { ApiError } from "@/lib/api/client";
import { uploadImage } from "@/lib/media/cloudinary";

const LeafletMap = dynamic(() => import("@/features/home/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});
const LocationPickerMap = dynamic(() => import("@/features/hangouts/components/LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

const DEFAULT_CENTER: [number, number] = [6.4281, 3.4219];

const CATEGORIES: Array<{ value: DrinkCategory; label: string }> = [
  { value: "BOTH", label: "Both" },
  { value: "ALCOHOLIC", label: "Alcoholic" },
  { value: "NON_ALCOHOLIC", label: "Non-alcoholic" },
];
const PRIVACY: Array<{ value: EventPrivacy; label: string }> = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVATE", label: "Private" },
  { value: "INVITE_ONLY", label: "Invite-only" },
];

/** Where the hangout happens: a listed venue, or a pinned spot with a typed address. */
interface Spot {
  latitude: number;
  longitude: number;
  label: string;
  venue: Venue | null;
}

const fieldShell = "flex h-[46px] items-center gap-3 rounded-field border border-border bg-card px-4";
const inputClass = "min-w-0 flex-1 bg-transparent font-body text-[15px] leading-[22px] text-input-text placeholder:text-body-text outline-none";

function Chips<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-body text-sm font-medium text-heading">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-[37px] rounded-full border px-4 font-body text-[13px] ${
              value === o.value ? "border-ink bg-ink font-bold text-white" : "border-border bg-card text-heading"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
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
            placeholder="Search a venue or type an address"
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
            // Dragging off a venue makes it a custom spot.
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
          Confirm location
        </Button>
      </div>
    </div>
  );
}

// Figma "Create hangout" (360:1203). ?venueId= pre-picks a venue ("Host
// here"); ?edit=<id> reopens a hangout the venue declined ("Modify request").
function HostHangoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const presetVenueId = params.get("venueId");
  const { accessToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(Boolean(editId || presetVenueId));
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [spot, setSpot] = useState<Spot | null>(null);
  // In edit mode: the location as loaded, so unchanged spots aren't resent.
  const [originalSpot, setOriginalSpot] = useState<Spot | null>(null);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [category, setCategory] = useState<DrinkCategory>("BOTH");
  const [privacy, setPrivacy] = useState<EventPrivacy>("PUBLIC");
  const [padis, setPadis] = useState<PadiUser[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    padisApi.listPadis(accessToken).then(setPadis).catch(() => undefined);
    if (editId) {
      eventsApi
        .getEvent(accessToken, editId)
        .then((e) => {
          setTitle(e.title);
          setCoverUrl(e.coverImageUrl);
          const start = new Date(e.startAt);
          setDate(toDateInput(start));
          setTime(toTimeInput(start));
          setCapacity(String(e.capacity));
          setCategory(e.drinkCategory);
          setPrivacy(e.privacy);
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

  const startAt = useMemo(() => (date && time ? new Date(`${date}T${time}`) : null), [date, time]);
  const capacityNumber = Number(capacity);
  // Checked on Publish (it reads the clock, so not during render).
  const firstProblem = () =>
    [
      title.trim().length < 3 && "Add a title (3+ characters)",
      !spot && "Choose a location",
      !startAt && "Pick a date and time",
      startAt && startAt.getTime() <= Date.now() && "The start time must be in the future",
      !(Number.isInteger(capacityNumber) && capacityNumber >= 1 && capacityNumber <= 1000) && "Enter a capacity between 1 and 1000",
    ].find(Boolean) || null;

  async function handleCover(file: File) {
    if (!accessToken) return;
    setUploading(true);
    setError(null);
    try {
      const signature = await eventsApi.getCoverUploadSignature(accessToken);
      setCoverUrl(await uploadImage(file, signature));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!accessToken || !spot || !startAt) return;
    const problem = firstProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setPublishing(true);
    setError(null);
    const location = {
      addressText: spot.venue ? spot.venue.addressText : spot.label,
      latitude: spot.latitude,
      longitude: spot.longitude,
      ...(spot.venue && { venueId: spot.venue.id }),
    };
    const details = {
      title: title.trim(),
      startAt: startAt.toISOString(),
      capacity: capacityNumber,
      drinkCategory: category,
      ...(coverUrl && { coverImageUrl: coverUrl }),
    };
    try {
      const event = editId
        ? // Unchanged location isn't resent (it would overwrite the venue's stored address).
          await eventsApi.updateEvent(accessToken, editId, spot === originalSpot ? details : { ...details, ...location })
        : await eventsApi.createEvent(accessToken, { ...details, ...location, privacy });
      if (invited.length) await eventsApi.invitePadis(accessToken, event.id, invited).catch(() => undefined);
      router.replace(event.venueApproval === "PENDING" ? `/hangouts/${event.id}/venue` : `/hangouts/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish. Please try again.");
      setPublishing(false);
    }
  }

  if (loading) return <ScreenMessage text="Loading…" />;

  const invitedPadis = padis.filter((p) => invited.includes(p.id));

  return (
    <>
      <FlowScreen
        title={editId ? "Modify request" : "Host a hangout"}
        backHref="/home"
        action={
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing || uploading}
            className="h-9 rounded-full bg-accent px-4 font-body text-[13px] font-bold text-[#1b3b2b] disabled:opacity-50"
          >
            {publishing ? "Publishing…" : editId ? "Resend" : "Publish"}
          </button>
        }
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-[128px] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-body-text text-body-text"
        >
          {coverUrl ? (
            <Image src={coverUrl} alt="Cover photo" fill sizes="430px" className="object-cover" unoptimized />
          ) : (
            <>
              <CameraIcon size={24} />
              <span className="font-body text-[13px]">{uploading ? "Uploading…" : "Add a cover photo"}</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleCover(file);
            e.target.value = "";
          }}
        />

        <TextField placeholder="Enter hangout title e.g Roof padi hangout" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />

        <button type="button" onClick={() => setPicking(true)} className="relative isolate h-[196px] w-full overflow-hidden rounded-2xl text-left" aria-label="Choose location">
          <div className="pointer-events-none size-full">
            <LeafletMap
              key={spot ? `${spot.latitude},${spot.longitude}` : "none"}
              center={spot ? [spot.latitude, spot.longitude] : DEFAULT_CENTER}
              pins={spot ? [{ id: "spot", latitude: spot.latitude, longitude: spot.longitude, emoji: "", dot: true, label: spot.label }] : []}
              selectedId={null}
              onSelect={() => undefined}
              resizeKey={0}
              interactive={false}
            />
          </div>
          <span className="absolute inset-x-3 bottom-3 z-[500] truncate rounded-full bg-card px-4 py-2 font-body text-[13px] text-heading shadow">
            {spot ? spot.label : "Tap to choose a location"}
          </span>
        </button>

        <div className="flex gap-2.5">
          <label className={`${fieldShell} relative flex-1`}>
            <input type="date" aria-label="Date" min={toDateInput(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} ${date ? "" : "text-transparent focus:text-input-text"} [&::-webkit-calendar-picker-indicator]:opacity-0`} />
            {!date && <span className="pointer-events-none absolute left-4 font-body text-[15px] text-body-text">Enter date</span>}
            <CalendarIcon size={22} className="pointer-events-none absolute right-4 text-heading" />
          </label>
          <label className={`${fieldShell} relative flex-1`}>
            <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} ${time ? "" : "text-transparent focus:text-input-text"} [&::-webkit-calendar-picker-indicator]:opacity-0`} />
            {!time && <span className="pointer-events-none absolute left-4 font-body text-[15px] text-body-text">0:00</span>}
            <ClockIcon size={22} className="pointer-events-none absolute right-4 text-heading" />
          </label>
        </div>

        <TextField type="number" inputMode="numeric" min={1} max={1000} placeholder="Enter capacity e.g. 15 padis" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} />

        <Chips label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
        {/* Privacy is fixed once published (see UpdateEventDto). */}
        {!editId && <Chips label="Privacy" options={PRIVACY} value={privacy} onChange={setPrivacy} />}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-sm font-medium text-heading">Invite padis</h2>
            <span className="font-body text-[13px] text-body-text">
              {invited.length} padi{invited.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {invitedPadis.map((p) => (
              <span key={p.id} className="relative">
                <Avatar name={p.displayName} photoUrl={p.photoUrl} size={44} />
                <button
                  type="button"
                  aria-label={`Remove ${p.displayName}`}
                  onClick={() => setInvited((list) => list.filter((id) => id !== p.id))}
                  className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-ink text-[11px] leading-none text-white"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label="Invite padis"
              onClick={() => setInviteOpen(true)}
              className="flex size-[44px] items-center justify-center rounded-full border border-dashed border-body-text text-heading"
            >
              <PlusIcon size={18} />
            </button>
          </div>
          <p className="font-body text-xs text-body-text">Invited padis get first access before the hangout goes public.</p>
        </section>

        {spot?.venue && !editId && (
          <p className="rounded-xl bg-toggle-bg px-3 py-2 font-body text-xs text-body-text">
            {spot.venue.name} will need to confirm before your hangout goes live.
          </p>
        )}
        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </FlowScreen>

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

      <BottomSheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite padis">
        <div className="flex max-h-[50dvh] flex-col overflow-y-auto">
          {padis.length === 0 && <p className="py-4 font-body text-sm text-body-text">Add padis first — scan their code from Home.</p>}
          {padis.map((p) => {
            const on = invited.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setInvited((list) => (on ? list.filter((id) => id !== p.id) : [...list, p.id]))}
                className="flex items-center gap-3 py-2.5 text-left"
              >
                <Avatar name={p.displayName} photoUrl={p.photoUrl} size={44} />
                <span className="flex-1 font-body text-sm font-medium text-heading">{p.displayName}</span>
                <span className={`flex size-7 items-center justify-center rounded-full border ${on ? "border-ink bg-ink text-white" : "border-border"}`}>
                  {on && <CheckIcon size={14} />}
                </span>
              </button>
            );
          })}
        </div>
        <Button className="mt-3" onClick={() => setInviteOpen(false)}>
          Done
        </Button>
      </BottomSheet>
    </>
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
