"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";

// Placeholder landing page — the real Discover/PadiFeed screen is the next
// frontend vertical slice. This exists only so the Auth flow (signup →
// verify → taste picker → here, and login → here) has somewhere real to
// land instead of a dead end.
function DiscoverContent() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center">
      <h1 className="font-heading text-2xl font-bold text-heading">
        {user ? `You're in, ${user.fullName.split(" ")[0]}!` : "You're in!"}
      </h1>
      <p className="max-w-xs font-body text-sm text-body-text">
        PadiFeed and Padi Board are coming next. Your account is fully set up.
      </p>
      <div className="w-full max-w-xs">
        <Button type="button" variant="text" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <RequireAuth>
      <DiscoverContent />
    </RequireAuth>
  );
}
