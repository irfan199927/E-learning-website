import { formatInZone, formatRupees, utcToZonedInput } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { countPendingPayments, getPaymentSettings, listPayments } from "@/server/services/payments";
import { DecidePayment } from "./decide-payment";
import { PaymentsExportForm } from "./export-form";
import { QrEditor } from "./qr-editor";
import { PaymentSettingsForm } from "./settings-form";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("AdminPayments"))("title") };
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";
const TABS = [
  { status: "PENDING", label: "tabPending" },
  { status: "APPROVED", label: "tabApproved" },
  { status: "REJECTED", label: "tabRejected" },
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const actor = await requirePageActor(["ADMIN"]);
  const { status: raw } = await searchParams;
  const status = TABS.find((tab) => tab.status === raw)?.status ?? "PENDING";
  const [settings, payments, pending, t, locale] = await Promise.all([
    getPaymentSettings(deps()),
    listPayments(deps(), actor, { status }),
    countPendingPayments(deps(), actor),
    getTranslations("AdminPayments"),
    getLocale(),
  ]);
  const when = (d: Date) => formatInZone(d, actor.timezone, intlLocale(locale));

  // Default export range: this month so far, in the admin's time zone.
  const today = utcToZonedInput(new Date(), actor.timezone).slice(0, 10);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader icon="rupee" title={t("title")} intro={t("intro")} />

      <section aria-labelledby="list-h" className={card}>
        <h2 id="list-h" className="mb-3 font-display text-xl font-bold">
          {t("reportedHeading")}
        </h2>
        <nav aria-label={t("statusNav")} className="mb-4">
          <ul className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <li key={tab.status}>
                <Link
                  href={tab.status === "PENDING" ? "/admin/payments" : `/admin/payments?status=${tab.status}`}
                  aria-current={tab.status === status ? "page" : undefined}
                  className={`inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[15px] font-medium ${
                    tab.status === status
                      ? "border-ink bg-ink text-surface"
                      : "border-line-strong bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {t(tab.label)}
                  {tab.status === "PENDING" && pending > 0 && (
                    <span className="rounded-full bg-live px-2 text-xs font-bold tabular-nums text-white">
                      <span className="sr-only">: </span>
                      {pending}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {payments.length === 0 ? (
          <p className="text-muted">{status === "PENDING" ? t("emptyPending") : t("emptyOther")}</p>
        ) : (
          <ul className="stagger flex flex-col divide-y divide-line">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.student.name} · {formatRupees(p.amountInPaise)}
                  </p>
                  <p className="text-sm text-muted">
                    {p.student.email} · {p.course.title}
                  </p>
                  <p className="text-sm">
                    {t.rich("reference", {
                      reference: p.reference,
                      date: when(p.createdAt),
                      ref: (chunks) => <span className="font-mono font-semibold">{chunks}</span>,
                    })}
                  </p>
                  {p.note && <p className="text-sm">{t("note", { note: p.note })}</p>}
                  {p.hasProof && (
                    <a
                      href={`/api/v1/admin/payments/${p.id}/proof`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-semibold text-primary-fg"
                    >
                      {t("viewProof")}
                    </a>
                  )}
                  {p.decidedAt && (
                    <p className="text-sm text-muted">
                      {t(p.decisionNote ? "decidedNote" : "decided", {
                        status: p.status,
                        by: p.decidedBy ?? t("anAdmin"),
                        date: when(p.decidedAt),
                        note: p.decisionNote ?? "",
                      })}
                    </p>
                  )}
                </div>
                {p.status === "PENDING" && <DecidePayment paymentId={p.id} student={p.student.name} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="export-h" className={card}>
        <h2 id="export-h" className="mb-1 font-display text-xl font-bold">
          {t("exportHeading")}
        </h2>
        <p className="mb-4 text-sm text-muted">{t("exportHelp")}</p>
        <PaymentsExportForm defaultFrom={`${today.slice(0, 8)}01`} defaultTo={today} />
      </section>

      <section aria-labelledby="upi-h" className={card}>
        <h2 id="upi-h" className="mb-1 font-display text-xl font-bold">
          {t("upiHeading")}
        </h2>
        <p className="mb-4 text-sm text-muted">
          {settings.ready ? t("upiReady") : t("upiNotReady")} {t("priceHint")}
        </p>
        <PaymentSettingsForm settings={settings} />
      </section>

      <section aria-labelledby="qr-h" className={card}>
        <h2 id="qr-h" className="mb-3 font-display text-xl font-bold">
          {t("qrHeading")}
        </h2>
        <QrEditor qrVersion={settings.qrVersion} />
      </section>
    </div>
  );
}
