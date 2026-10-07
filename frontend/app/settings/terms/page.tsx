import { LegalPage } from "@/features/settings/LegalPage";
import { TERMS_INTRO, TERMS_SECTIONS } from "@/features/settings/content";

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
      footerNote="Questions about these terms? Reach us from Help & support."
    />
  );
}
