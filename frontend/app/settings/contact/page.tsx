"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as settingsApi from "@/features/settings/api";
import { SupportTopic } from "@/features/settings/api";
import { SettingsScreen } from "@/features/settings/components";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/features/settings/content";
import { ApiError } from "@/lib/api/client";

const TOPICS: Array<{ id: SupportTopic; label: string }> = [
  { id: "HANGOUTS", label: "Hangouts" },
  { id: "REWARDS", label: "Rewards" },
  { id: "REPORT_PADI", label: "Report a padi" },
  { id: "OTHER", label: "Other" },
];
const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

function ChannelCard({ href, icon, title, hint }: { href?: string; icon: string; title: string; hint: string }) {
  const body = (
    <>
      <span className="flex size-8 items-center justify-center rounded-full bg-[rgba(215,230,0,0.35)]">
        <Image src={icon} alt="" width={16} height={16} />
      </span>
      <span className="font-body text-[13px] font-bold leading-[18px] text-heading">{title}</span>
      <span className="font-body text-xs leading-4 text-body-text">{hint}</span>
    </>
  );
  const className = "flex flex-1 flex-col items-start gap-2 rounded-xl bg-card p-3.5";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div aria-disabled className={`${className} opacity-60`}>
      {body}
    </div>
  );
}

// Figma "Contact us" (303:5455).
function ContactContent() {
  const { accessToken } = useAuth();
  const [topic, setTopic] = useState<SupportTopic>("HANGOUTS");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = message.trim().length < MIN_LENGTH;

  async function send() {
    if (!accessToken || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await settingsApi.sendSupportMessage(accessToken, { topic, message: message.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsScreen
      title="Contact us"
      footer={
        !sent && (
          <Button onClick={() => void send()} disabled={tooShort} loading={busy}>
            Send message
          </Button>
        )
      }
    >
      <div className="flex gap-2.5">
        <ChannelCard href={`mailto:${SUPPORT_EMAIL}`} icon="/icons/settings/mail.svg" title="Email support" hint="Replies in ~1 day" />
        <ChannelCard
          href={SUPPORT_WHATSAPP ? `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}` : undefined}
          icon="/icons/settings/whatsapp.svg"
          title="WhatsApp"
          hint={SUPPORT_WHATSAPP ? "Mon–Sat, 9am–7pm" : "Coming soon"}
        />
      </div>

      <hr className="border-divider" />

      {sent ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-card p-4" role="status">
          <p className="font-body text-[15px] font-bold leading-[22px] text-heading">Message sent 🎉</p>
          <p className="font-body text-[13px] leading-[18px] text-body-text">Thanks for reaching out. We&apos;ll reply to your email within about a day.</p>
        </div>
      ) : (
        <>
          <h2 className="font-body text-[15px] font-bold leading-[22px] text-heading">Or send us a message</h2>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-body text-sm font-medium leading-5 text-heading">What&apos;s this about?</legend>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={topic === t.id}
                  onClick={() => setTopic(t.id)}
                  className={`flex h-[37px] items-center rounded-full px-4 font-body text-[13px] ${
                    topic === t.id ? "border-2 border-ink bg-ink font-bold text-white" : "border border-border bg-card text-heading"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className="font-body text-sm font-medium leading-5 text-heading">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_LENGTH}
              placeholder="Tell us what's going on..."
              className="h-[124px] resize-none rounded-xl border border-[#ccd1cf] bg-card px-4 py-3 font-body text-[15px] leading-[22px] text-input-text outline-none placeholder:text-body-text-subtle focus:border-border-focus"
            />
            <span className="self-end font-body text-xs text-body-text">
              {message.length}/{MAX_LENGTH}
            </span>
          </label>
          {error && <p className="font-body text-sm text-danger">{error}</p>}
        </>
      )}
    </SettingsScreen>
  );
}

export default function ContactPage() {
  return (
    <RequireAuth>
      <ContactContent />
    </RequireAuth>
  );
}
