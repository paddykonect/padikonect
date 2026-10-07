"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SettingsScreen } from "@/features/settings/components";
import { FAQS, HELP_TOPICS, HelpTopic } from "@/features/settings/content";

// Figma "Help center" (301:5276). Topic cards filter the FAQ list; search
// matches questions and answers.
export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<HelpTopic | null>(null);

  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter(
      (f) => (!topic || f.topic === topic) && (!q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)),
    );
  }, [query, topic]);

  return (
    <SettingsScreen title="Help center">
      <label className="flex h-[46px] items-center gap-2 rounded-lg border border-[#f4f4f4] bg-card px-3">
        <Image src="/icons/hangout/search-field.svg" alt="" width={16} height={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help"
          aria-label="Search help"
          className="min-w-0 flex-1 bg-transparent py-2 font-body text-[15px] leading-[22px] text-input-text outline-none placeholder:text-[#7c7c7c]"
        />
      </label>

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">Popular topics</h2>
        <div className="flex gap-2.5">
          {HELP_TOPICS.map((t) => {
            const on = topic === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTopic(on ? null : t.id)}
                className={`flex flex-1 flex-col items-start gap-1.5 rounded-xl p-3 text-left ${on ? "bg-ink" : "bg-card"}`}
              >
                <Image src={t.icon} alt="" width={16} height={16} className={on ? "invert" : ""} />
                <span className={`font-body text-xs font-medium leading-4 ${on ? "text-white" : "text-heading"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">Frequently asked</h2>
        <div className="flex flex-col overflow-hidden rounded-2xl bg-card [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
          {faqs.map((f) => (
            <div key={f.question} className="flex flex-col gap-1 p-3.5">
              <p className="font-body text-sm font-medium leading-5 text-heading">{f.question}</p>
              <p className="font-body text-[13px] leading-[18px] text-body-text">{f.answer}</p>
            </div>
          ))}
          {faqs.length === 0 && <p className="p-3.5 font-body text-[13px] text-body-text">No answers match that yet — ask us below.</p>}
        </div>
      </section>

      <Link href="/settings/contact" className="flex items-center justify-between rounded-2xl bg-ink p-4">
        <span className="flex flex-col gap-0.5">
          <span className="font-body text-sm font-bold leading-5 text-white">Still need help?</span>
          <span className="font-body text-xs leading-4 tracking-[0.024px] text-border">Get in touch with our support team</span>
        </span>
        <Image src="/icons/settings/chevron-light.svg" alt="" width={16} height={16} />
      </Link>
    </SettingsScreen>
  );
}
