import { LegalPage } from "@/features/settings/LegalPage";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/features/settings/content";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      footerNote="Questions about this policy? Reach us from Help & support."
    />
  );
}
