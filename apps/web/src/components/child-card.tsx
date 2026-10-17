import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import type { ChildSummary } from "@/server/services/parents";

/** One linked child on a parent's Overview and on /children. */
export function ChildCard({ child }: { child: ChildSummary }) {
  const t = useTranslations("Children");
  const minutes = Math.floor(child.todaySeconds / 60);
  return (
    <article
      aria-labelledby={`child-${child.id}`}
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft font-bold text-[#0C6447]"
          aria-hidden="true"
        >
          {child.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()}
        </span>
        <h3 id={`child-${child.id}`} className="font-display text-lg font-bold">
          {child.name}
        </h3>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">{t("streak")}</dt>
          <dd className="flex items-center gap-1 text-xl font-bold">
            <Icon name="flame" size={20} />
            {t("days", { count: child.streak })}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("today")}</dt>
          <dd className="text-xl font-bold">{t("minutes", { minutes })}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("lessonsDone")}</dt>
          <dd className="text-xl font-bold">{child.lessonsCompleted}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("courses")}</dt>
          <dd className="text-xl font-bold">{child.courseCount}</dd>
        </div>
      </dl>
      <Link
        href={`/children/${child.id}`}
        className={buttonClasses("secondary", "w-fit")}
        aria-label={t("seeProgressLabel", { name: child.name })}
      >
        {t("seeProgress")}
        <Icon name="arrowRight" size={18} />
      </Link>
    </article>
  );
}

export function NoChildren() {
  const t = useTranslations("Children");
  return (
    <p className="rounded-[var(--radius-card)] border border-line bg-surface p-5 text-muted">{t("none")}</p>
  );
}
