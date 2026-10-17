import { useTranslations } from "next-intl";

/**
 * Course "thumbnail": the uploaded cover image when there is one (`cover` = the course id and cover version),
 * else a generated cover in the course's colour, so every course has artwork. Decorative — the card's heading
 * carries the name.
 */
export function CourseTile({
  title,
  grade,
  color,
  cover,
  className = "",
}: {
  title: string;
  grade: string | null;
  color: string;
  cover?: { courseId: string; version: string | null } | null;
  className?: string;
}) {
  const t = useTranslations("Courses");
  const [subject] = title.split("·");
  if (cover?.version)
    return (
      <div aria-hidden="true" className={`relative shrink-0 overflow-hidden rounded-xl bg-line ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect; next/image can't optimise it */}
        <img
          src={`/api/v1/courses/${cover.courseId}/cover?v=${cover.version}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl p-4 text-white ${className}`}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #0b0d14) 100%)`,
      }}
    >
      <span className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <span className="absolute -bottom-10 right-8 size-28 rounded-full bg-white/5" />
      <span className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">
        E-learner
      </span>
      <span className="relative font-display text-xl font-bold uppercase leading-tight">
        {subject?.trim()}
      </span>
      {grade && (
        <span className="relative w-fit rounded-full border border-white/60 px-2 py-0.5 text-[11px] font-semibold">
          {t("grade", { grade })}
        </span>
      )}
    </div>
  );
}
