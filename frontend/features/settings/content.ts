import packageJson from "../../package.json";
import { InvitePolicy } from "@/features/profile/types";

// Figma spells the brand "Padikonect"; the rest of the app (and backend
// emails) use "Paddykonect" — kept in one place until that's settled.
export const APP_NAME = "Paddykonect";
export const APP_VERSION = packageJson.version;

export const SUPPORT_EMAIL = "support@paddykonect.com";
// WhatsApp support line isn't decided yet; the card falls back to email until it is.
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";

export const INVITE_POLICY_LABEL: Record<InvitePolicy, string> = {
  EVERYONE: "Everyone",
  PADIS_ONLY: "Padis only",
  NO_ONE: "No one",
};

export interface LegalSection {
  heading: string;
  body: string;
}

export const LEGAL_LAST_UPDATED = "1 September 2026";

// Figma "Privacy policy" (301:5129).
export const PRIVACY_INTRO = `${APP_NAME} exists to help you plan hangouts and discover places with people you trust. This policy explains what we collect and how it's used.`;
export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Information we collect",
    body: "Your profile details, the hangouts you create or join, your approximate location when PadiRadar is on, and messages you send through the app.",
  },
  {
    heading: "How we use it",
    body: "To match you with nearby hangouts and padis, track progress toward Padi Rewards, keep the community safe, and improve recommendations.",
  },
  {
    heading: "Who can see your information",
    body: "Your name and photo are visible to other padis. Your exact location is never shown to anyone — only your general area on the map.",
  },
  {
    heading: "Registered lounges & rewards",
    body: "When you redeem a Padi Reward, we share your name and reward status with the registered lounge so they can honor it.",
  },
  {
    heading: "Your choices",
    body: "You can turn off location services, control who can invite you, block other users, or delete your account at any time from Settings.",
  },
];

// Figma "Terms of service" (301:5216).
export const TERMS_INTRO = `By using ${APP_NAME}, you agree to these terms. Please read them alongside our Privacy Policy.`;
export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Eligibility",
    body: "You must be 18 or older to create an account, host a hangout, or claim a reward involving alcoholic venues.",
  },
  {
    heading: "2. Hosting & attending hangouts",
    body: `Hosts are responsible for the accuracy of hangout details. ${APP_NAME} doesn't guarantee attendance, venue availability, or the conduct of other users.`,
  },
  {
    heading: "3. Padi Rewards",
    body: "Rewards are earned after hosting 10 completed hangouts and are redeemable only at registered lounges, subject to each lounge's availability.",
  },
  {
    heading: "4. Community conduct",
    body: "Harassment, fake hangouts, or unsafe behavior may result in suspension. Report a padi from any hangout or chat if something feels off.",
  },
  {
    heading: "5. Termination",
    body: "You can delete your account at any time from Settings. We may suspend accounts that violate these terms.",
  },
];

export type HelpTopic = "hosting" | "rewards" | "account";

export interface Faq {
  question: string;
  answer: string;
  topic: HelpTopic;
}

// Figma "Help center" (301:5276).
export const HELP_TOPICS: Array<{ id: HelpTopic; label: string; icon: string }> = [
  { id: "hosting", label: "Hosting hangouts", icon: "/icons/settings/add.svg" },
  { id: "rewards", label: "Padi Rewards", icon: "/icons/settings/trophy.svg" },
  { id: "account", label: "Account & safety", icon: "/icons/settings/user.svg" },
];

export const FAQS: Faq[] = [
  {
    topic: "rewards",
    question: "How do Padi Rewards work?",
    answer: "Host 10 hangouts to unlock a free round redeemable at any registered lounge.",
  },
  {
    topic: "hosting",
    question: "Can I cancel a hangout I'm hosting?",
    answer: "Yes, from the hangout's detail page. Everyone going will be notified right away.",
  },
  {
    topic: "account",
    question: "How do I stop someone from inviting me?",
    answer: "Block them from their profile, or limit invites to padis only in Settings.",
  },
  {
    topic: "account",
    question: "Is my location shared with other users?",
    answer: "Only your general area is shown on the map — never your exact location.",
  },
];
