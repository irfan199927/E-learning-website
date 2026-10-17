import { formatInZone, formatRupees, isAppError, upiPayLink } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getCoursePayment } from "@/server/services/payments";
import { PayForm } from "./pay-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Pay"))("title") };
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";

export default async function PayPage({ params }: { params: Promise<{ courseId: string }> }) {
  const actor = await requirePageActor(["STUDENT"]);
  const { courseId } = await params;
  const page = await getCoursePayment(deps(), actor, courseId).catch((err) => {
    if (isAppError(err) && err.status === 404) notFound();
    throw err;
  });
  const { course, settings, latest } = page;
  const amount = formatRupees(course.priceInPaise);
  const pending = latest?.status === "PENDING";
  const [t, locale] = await Promise.all([getTranslations("Pay"), getLocale()]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/courses#find-h"
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        {t("findCourse")}
      </Link>
      <header>
        <p className="text-sm font-semibold text-muted">{t("payToJoin")}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{course.title}</h1>
        <p className="mt-1 font-display text-2xl font-bold">{amount}</p>
      </header>

      {page.enrolled ? (
        <section className={card}>
          <p className="mb-3 font-semibold">{t("enrolled")}</p>
          <Link href={`/courses/${course.id}`} className={buttonClasses("primary")}>
            {t("openCourse")}
          </Link>
        </section>
      ) : !settings.ready ? (
        <section className={card}>
          <p>{t("notSetUp")}</p>
        </section>
      ) : (
        <>
          {latest?.status === "REJECTED" && (
            <FormAlert>
              {latest.decisionNote
                ? t("rejectedNote", { reference: latest.reference, note: latest.decisionNote })
                : t("rejected", { reference: latest.reference })}
            </FormAlert>
          )}

          <section aria-labelledby="pay-h" className={`flex flex-col gap-4 ${card}`}>
            <h2 id="pay-h" className="font-display text-xl font-bold">
              {t("step1", { amount })}
            </h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {settings.upiId && (
                <>
                  <dt className="text-muted">{t("upiId")}</dt>
                  <dd className="break-all font-mono text-lg font-semibold">{settings.upiId}</dd>
                </>
              )}
              {settings.phone && (
                <>
                  <dt className="text-muted">{t("upiNumber")}</dt>
                  <dd className="font-mono text-lg font-semibold">{settings.phone}</dd>
                </>
              )}
              {settings.payeeName && (
                <>
                  <dt className="text-muted">{t("name")}</dt>
                  <dd className="font-semibold">{settings.payeeName}</dd>
                </>
              )}
              <dt className="text-muted">{t("amount")}</dt>
              <dd className="font-semibold">{amount}</dd>
            </dl>
            {settings.qrVersion && (
              // eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect
              <img
                src={`/api/v1/payment-qr?v=${settings.qrVersion}`}
                alt={t("qrAlt", { name: settings.payeeName ?? settings.upiId ?? t("theSchool") })}
                className="size-56 rounded-xl border border-line bg-white object-contain p-2"
              />
            )}
            {settings.upiId && (
              <a
                href={upiPayLink({
                  upiId: settings.upiId,
                  payeeName: settings.payeeName,
                  amountInPaise: course.priceInPaise,
                  note: course.title,
                })}
                className={`${buttonClasses("secondary")} w-fit`}
              >
                {t("openUpi")}
              </a>
            )}
            {settings.instructions && <p className="whitespace-pre-line text-sm">{settings.instructions}</p>}
          </section>

          <section aria-labelledby="report-h" className={`flex flex-col gap-3 ${card}`}>
            <h2 id="report-h" className="font-display text-xl font-bold">
              {t("step2")}
            </h2>
            {pending ? (
              <p>
                {t.rich("reported", {
                  date: formatInZone(latest.createdAt, actor.timezone, intlLocale(locale)),
                  reference: latest.reference,
                  ref: (chunks) => <span className="font-mono">{chunks}</span>,
                })}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">{t("help")}</p>
                <PayForm courseId={course.id} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
