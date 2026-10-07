import { SettingsScreen } from "./components";
import { LEGAL_LAST_UPDATED, LegalSection } from "./content";

// Figma "Privacy policy" (301:5129) / "Terms of service" (301:5216).
export function LegalPage({ title, intro, sections, footerNote }: { title: string; intro: string; sections: LegalSection[]; footerNote: string }) {
  return (
    <SettingsScreen title={title}>
      <p className="font-body text-xs tracking-[0.024px] text-body-text">Last updated {LEGAL_LAST_UPDATED}</p>
      <p className="font-body text-[13px] leading-[18px] text-heading">{intro}</p>
      {sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-[5px]">
          <h2 className="font-body text-[15px] font-bold leading-[22px] text-heading">{s.heading}</h2>
          <p className="font-body text-[13px] leading-[18px] text-heading">{s.body}</p>
        </section>
      ))}
      <p className="pt-1 font-body text-xs tracking-[0.024px] text-body-text">{footerNote}</p>
    </SettingsScreen>
  );
}
