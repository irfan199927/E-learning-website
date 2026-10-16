import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getStreak } from "@/server/services/learning";

// Every page under (app) is per-user: never statically cache.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const streak = await getStreak(deps(), actor);
  return (
    <AppShell user={{ name: actor.name, role: actor.role }} streak={streak}>
      {children}
    </AppShell>
  );
}
