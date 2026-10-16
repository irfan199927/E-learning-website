import type { Metadata } from "next";
import { ChildCard, NoChildren } from "@/components/child-card";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listChildren } from "@/server/services/parents";

export const metadata: Metadata = { title: "My children" };

export default async function ChildrenPage() {
  const actor = await requirePageActor(["PARENT"]);
  const children = await listChildren(deps(), actor);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">My children</h1>
        <p className="mt-1 text-muted">See how each child is getting on. This view is read-only.</p>
      </header>
      {children.length === 0 ? (
        <NoChildren />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {children.map((c) => (
            <ChildCard key={c.id} child={c} />
          ))}
        </div>
      )}
    </div>
  );
}
