import { AppShell } from "@/components/app-shell";
import { requirePageActor } from "@/lib/session";

// Every page under (app) is per-user: never statically cache.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  return <AppShell user={{ name: actor.name, role: actor.role }}>{children}</AppShell>;
}
