import { AppShell } from "@/components/app-shell";
import { RecordingBanner } from "@/components/recording-banner";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getStreak } from "@/server/services/learning";
import { unreadCount } from "@/server/services/notifications";
import { getRecordingConsent } from "@/server/services/recording-consent";

// Every page under (app) is per-user: never statically cache.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const [streak, unread, recording] = await Promise.all([
    getStreak(deps(), actor),
    unreadCount(deps(), actor),
    actor.role === "STUDENT" ? getRecordingConsent(deps(), actor) : null,
  ]);
  const ask = recording?.status === "none" || recording?.status === "outdated";
  return (
    <AppShell user={{ name: actor.name, role: actor.role }} streak={streak} unread={unread}>
      {ask && recording && <RecordingBanner outdated={recording.status === "outdated"} />}
      {children}
    </AppShell>
  );
}
