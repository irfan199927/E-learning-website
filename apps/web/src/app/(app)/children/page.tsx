import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChildCard, NoChildren } from "@/components/child-card";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { listChildren } from "@/server/services/parents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Children"))("title") };
}

export default async function ChildrenPage() {
  const actor = await requirePageActor(["PARENT"]);
  const [children, t] = await Promise.all([listChildren(deps(), actor), getTranslations("Children")]);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted">{t("intro")}</p>
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
