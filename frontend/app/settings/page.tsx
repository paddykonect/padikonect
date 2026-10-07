"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import * as authApi from "@/features/auth/api";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as profileApi from "@/features/profile/api";
import { PreferencesSheet } from "@/features/profile/PreferencesSheet";
import { DRINK_PREFERENCE_LABEL, OwnProfile, UpdateProfileInput } from "@/features/profile/types";
import { SettingsGroup, SettingsRow, SettingsScreen, Switch, initialsOf } from "@/features/settings/components";
import { APP_NAME, APP_VERSION, INVITE_POLICY_LABEL } from "@/features/settings/content";
import { applyTheme, readTheme, saveTheme, Theme } from "@/features/theme/theme";
import { ApiError } from "@/lib/api/client";

function AppearanceToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    // Theme lives in localStorage/the DOM, which only exist client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
  }, []);
  function choose(next: Theme) {
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  }
  // The sun is white (it only shows on the dark selected pill or the night
  // card); the dark moon is inverted at night, when it sits on the pill.
  const option = (value: Theme, icon: string, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={theme === value}
      onClick={() => choose(value)}
      className={`flex h-7 items-center gap-[5px] rounded-full px-3 font-body text-xs ${theme === value ? "bg-ink text-white" : "text-heading"}`}
    >
      <Image src={icon} alt="" width={13} height={13} className={value === "dark" ? "dark-invert" : ""} />
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex shrink-0 gap-[3px] rounded-full border border-border bg-card p-[3px]">
      {option("light", "/icons/settings/sun.svg", "Light")}
      {option("dark", "/icons/settings/moon.svg", "Dark")}
    </div>
  );
}

// Figma "setting" (284:9136).
function SettingsContent() {
  const router = useRouter();
  const { accessToken, user, logout } = useAuth();
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    profileApi.getOwnProfile(accessToken).then(setProfile).catch(() => setError("Couldn't load your settings."));
  }, [accessToken]);

  // Optimistic: flip the setting now, roll back if the save fails.
  async function save(input: UpdateProfileInput) {
    if (!accessToken || !profile) return;
    const previous = profile;
    setProfile({ ...profile, ...input });
    setError(null);
    try {
      setProfile(await profileApi.updateOwnProfile(accessToken, input));
    } catch (err) {
      setProfile(previous);
      setError(err instanceof ApiError ? err.message : "Couldn't save that change. Please try again.");
    }
  }

  const name = profile?.displayName ?? profile?.fullName ?? "";

  return (
    <SettingsScreen title="Settings" backHref="/profile">
      <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
        {profile?.photoUrl ? (
          <Avatar name={name} photoUrl={profile.photoUrl} size={52} />
        ) : (
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-accent font-heading text-lg font-bold text-[#1b3b2b]">
            {initialsOf(name)}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate font-body text-[15px] font-bold text-heading">{name || " "}</p>
          <p className="truncate font-body text-[12.5px] text-body-text">{profile?.email}</p>
        </div>
        <Link href="/profile/edit" className="flex h-[34px] shrink-0 items-center rounded-full border border-border bg-card px-[15px] font-body text-[12.5px] font-medium text-heading">
          Edit
        </Link>
      </div>

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      <SettingsGroup title="Account">
        <SettingsRow label="Phone & email" href="/settings/phone-email" />
        <SettingsRow label="Change password" href="/settings/password" />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow
          label="Language"
          hint="App display language"
          control={
            <span className="relative shrink-0">
              {/* English is the only language for now. */}
              <select
                aria-label="App display language"
                defaultValue="en"
                className="h-9 appearance-none rounded-full border border-border bg-card pl-3 pr-8 font-body text-[12.5px] font-bold leading-[15px] text-heading outline-none"
              >
                <option value="en">English</option>
              </select>
              <Image src="/icons/settings/chevron-down.svg" alt="" width={16} height={16} className="pointer-events-none absolute right-3 top-2.5" />
            </span>
          }
        />
        <SettingsRow label="Appearance" hint="Switch between day and night mode" control={<AppearanceToggle />} />
        <SettingsRow
          label="Drink preference"
          value={profile ? DRINK_PREFERENCE_LABEL[profile.drinkPreference] : undefined}
          onClick={() => setPrefsOpen(true)}
        />
        <SettingsRow label="Interests" value={profile ? `${profile.interests.length} selected` : undefined} onClick={() => setPrefsOpen(true)} />
        <SettingsRow
          label="Push notifications"
          hint="Invites, requests & reminders"
          control={
            <Switch
              label="Push notifications"
              checked={profile?.pushNotifications ?? true}
              disabled={!profile}
              onChange={(v) => void save({ pushNotifications: v })}
            />
          }
        />
        <SettingsRow
          label="Location services"
          hint="Powers PadiRadar & nearby discovery"
          control={
            <Switch
              label="Location services"
              checked={profile?.locationServices ?? true}
              disabled={!profile}
              onChange={(v) => void save({ locationServices: v })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy & safety">
        <SettingsRow label="Who can invite me" value={profile ? INVITE_POLICY_LABEL[profile.invitePolicy] : undefined} href="/settings/invites" />
        <SettingsRow label="Blocked padis" href="/settings/blocked" />
        <SettingsRow label="Privacy policy" href="/settings/privacy" />
      </SettingsGroup>

      <SettingsGroup title="Support">
        <SettingsRow label="Help center" href="/settings/help" />
        <SettingsRow label="Contact us" href="/settings/contact" />
        <SettingsRow label="Terms of service" href="/settings/terms" />
      </SettingsGroup>

      {user?.role === "ADMIN" && (
        <SettingsGroup title="Admin">
          <SettingsRow label="Venue requests" hint="Confirm or decline hangouts on behalf of venues" href="/admin/venue-requests" />
        </SettingsGroup>
      )}

      {/* Not in the Figma hub: the old Settings sheet's Log out, and the Delete
          account screen (304:5726) needs an entry point. */}
      <SettingsGroup>
        <SettingsRow
          label="Log out"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          control={<span />}
        />
        <SettingsRow label="Log out of all devices" hint="Signs you out everywhere, including here" onClick={() => setLogoutAllOpen(true)} control={<span />} />
        <Link href="/settings/delete" className="p-3.5 font-body text-sm text-error">
          Delete account
        </Link>
      </SettingsGroup>

      <BottomSheet open={logoutAllOpen} onClose={() => setLogoutAllOpen(false)} title="Log out of all devices?" description="You'll need to log in again on every phone and browser, including this one.">
        <div className="flex flex-col gap-2">
          <Button
            loading={loggingOutAll}
            onClick={async () => {
              if (!accessToken) return;
              setLoggingOutAll(true);
              try {
                await authApi.logoutAll(accessToken);
              } catch {
                setError("Couldn't log out of other devices. Please try again.");
                setLoggingOutAll(false);
                setLogoutAllOpen(false);
                return;
              }
              await logout();
              router.push("/");
            }}
          >
            Log out everywhere
          </Button>
          <Button variant="text" onClick={() => setLogoutAllOpen(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>

      <p className="pb-2 pt-1 text-center font-body text-xs text-body-text">
        {APP_NAME} v{APP_VERSION}
      </p>

      {profile && (
        <PreferencesSheet
          key={String(prefsOpen)}
          open={prefsOpen}
          drinkPreference={profile.drinkPreference}
          interests={profile.interests}
          onClose={() => setPrefsOpen(false)}
          onDone={(value) => {
            setPrefsOpen(false);
            void save(value);
          }}
        />
      )}
    </SettingsScreen>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
