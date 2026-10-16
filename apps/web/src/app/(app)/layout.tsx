import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getStreak } from "@/server/services/learning";
import { unreadCount } from "@/server/services/notifications";

// Every page under (app) is per-user: never statically cache.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const [streak, unread] = await Promise.all([getStreak(deps(), actor), unreadCount(deps(), actor)]);
  return (
    <AppShell user={{ name: actor.name, role: actor.role }} streak={streak} unread={unread}>
      {children}
    </AppShell>
  );
}
