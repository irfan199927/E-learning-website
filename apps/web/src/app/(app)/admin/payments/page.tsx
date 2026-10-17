import { formatInZone, formatRupees } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getPaymentSettings, listPayments } from "@/server/services/payments";
import { DecidePayment } from "./decide-payment";
import { QrEditor } from "./qr-editor";
import { PaymentSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Payments" };

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";
const TABS = [
  { status: "PENDING", label: "To check" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const actor = await requirePageActor(["ADMIN"]);
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.status === raw)?.status ?? "PENDING";
  const [settings, payments] = await Promise.all([
    getPaymentSettings(deps()),
    listPayments(deps(), actor, { status }),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-muted">
          Students pay for courses straight to your UPI, then send the payment reference. Check it in your
          bank or UPI app, then approve to give them the course.
        </p>
      </header>

      <section aria-labelledby="list-h" className={card}>
        <h2 id="list-h" className="mb-3 font-display text-xl font-bold">
          Reported payments
        </h2>
        <nav aria-label="Payment status" className="mb-4">
          <ul className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <li key={t.status}>
                <Link
                  href={t.status === "PENDING" ? "/admin/payments" : `/admin/payments?status=${t.status}`}
                  aria-current={t.status === status ? "page" : undefined}
                  className={`inline-flex h-11 items-center rounded-full border px-5 text-[15px] font-medium ${
                    t.status === status
                      ? "border-ink bg-ink text-surface"
                      : "border-line-strong bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {payments.length === 0 ? (
          <p className="text-muted">
            {status === "PENDING" ? "Nothing to check. New payments show up here." : "None yet."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
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
                    UPI reference <span className="font-mono font-semibold">{p.reference}</span> · reported{" "}
                    {formatInZone(p.createdAt, actor.timezone)}
                  </p>
                  {p.note && <p className="text-sm">Note: {p.note}</p>}
                  {p.hasProof && (
                    <a
                      href={`/api/v1/admin/payments/${p.id}/proof`}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-semibold text-primary-fg"
                    >
                      View screenshot
                    </a>
                  )}
                  {p.decidedAt && (
                    <p className="text-sm text-muted">
                      {p.status === "APPROVED" ? "Approved" : "Rejected"} by {p.decidedBy ?? "an admin"} on{" "}
                      {formatInZone(p.decidedAt, actor.timezone)}
                      {p.decisionNote ? `: ${p.decisionNote}` : ""}
                    </p>
                  )}
                </div>
                {p.status === "PENDING" && <DecidePayment paymentId={p.id} student={p.student.name} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="upi-h" className={card}>
        <h2 id="upi-h" className="mb-1 font-display text-xl font-bold">
          Where students pay
        </h2>
        <p className="mb-4 text-sm text-muted">
          {settings.ready
            ? "Students see these details on a paid course's payment page."
            : "Add a UPI ID or a phone number so students can pay. Until then, paid courses can't be bought."}{" "}
          Set a course&apos;s price on its Edit course page.
        </p>
        <PaymentSettingsForm settings={settings} />
      </section>

      <section aria-labelledby="qr-h" className={card}>
        <h2 id="qr-h" className="mb-3 font-display text-xl font-bold">
          QR code
        </h2>
        <QrEditor qrVersion={settings.qrVersion} />
      </section>
    </div>
  );
}
