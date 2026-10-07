import { redirect } from "next/navigation";

// The post-login landing screen is now Home (Figma node 590:8834); kept so
// old links and bookmarks to /discover still work.
export default function DiscoverPage() {
  redirect("/home");
}
