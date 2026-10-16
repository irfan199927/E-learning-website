import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getConsentState } from "@/server/services/consent";
import { getStreak } from "@/server/services/learning";

// Every page under (app) is per-user: never statically cache.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  // Students tell us their date of birth once (DPDP: under-18s need a parent's consent).
  if (actor.role === "STUDENT" && (await getConsentState(deps(), actor.id)).kind === "needs-dob")
    redirect("/welcome");
  const streak = await getStreak(deps(), actor);
  return (
    <AppShell user={{ name: actor.name, role: actor.role }} streak={streak}>
      {children}
    </AppShell>
  );
}
