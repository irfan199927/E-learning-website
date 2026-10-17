import { formatInZone, formatRupees, isAppError, upiPayLink } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/form";
import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getCoursePayment } from "@/server/services/payments";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Pay for a course" };

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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/courses#find-h"
        className="flex w-fit items-center gap-1 text-sm font-semibold text-primary-fg"
      >
        <Icon name="chevronLeft" size={16} />
        Find a course
      </Link>
      <header>
        <p className="text-sm font-semibold text-muted">Pay to join</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{course.title}</h1>
        <p className="mt-1 font-display text-2xl font-bold">{amount}</p>
      </header>

      {page.enrolled ? (
        <section className={card}>
          <p className="mb-3 font-semibold">You&apos;re in this course.</p>
          <Link href={`/courses/${course.id}`} className={buttonClasses("primary")}>
            Open the course
          </Link>
        </section>
      ) : !settings.ready ? (
        <section className={card}>
          <p>Payments aren&apos;t set up yet. Ask your school how to pay for this course.</p>
        </section>
      ) : (
        <>
          {latest?.status === "REJECTED" && (
            <FormAlert>
              The school couldn&apos;t confirm your payment (reference {latest.reference})
              {latest.decisionNote ? `: ${latest.decisionNote}` : "."} Check the details and report it again.
            </FormAlert>
          )}

          <section aria-labelledby="pay-h" className={`flex flex-col gap-4 ${card}`}>
            <h2 id="pay-h" className="font-display text-xl font-bold">
              1. Pay {amount} by UPI
            </h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {settings.upiId && (
                <>
                  <dt className="text-muted">UPI ID</dt>
                  <dd className="break-all font-mono text-lg font-semibold">{settings.upiId}</dd>
                </>
              )}
              {settings.phone && (
                <>
                  <dt className="text-muted">UPI number</dt>
                  <dd className="font-mono text-lg font-semibold">{settings.phone}</dd>
                </>
              )}
              {settings.payeeName && (
                <>
                  <dt className="text-muted">Name</dt>
                  <dd className="font-semibold">{settings.payeeName}</dd>
                </>
              )}
              <dt className="text-muted">Amount</dt>
              <dd className="font-semibold">{amount}</dd>
            </dl>
            {settings.qrVersion && (
              // eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect
              <img
                src={`/api/v1/payment-qr?v=${settings.qrVersion}`}
                alt={`UPI QR code for ${settings.payeeName ?? settings.upiId ?? "the school"}`}
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
                Open my UPI app
              </a>
            )}
            {settings.instructions && <p className="whitespace-pre-line text-sm">{settings.instructions}</p>}
          </section>

          <section aria-labelledby="report-h" className={`flex flex-col gap-3 ${card}`}>
            <h2 id="report-h" className="font-display text-xl font-bold">
              2. Tell us the payment reference
            </h2>
            {pending ? (
              <p>
                Payment reported on {formatInZone(latest.createdAt, actor.timezone)} (reference{" "}
                <span className="font-mono">{latest.reference}</span>). The school checks it and you&apos;ll
                get a notification. The course opens as soon as it&apos;s confirmed.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">
                  After paying, your UPI app shows a 12-digit reference (UTR or UPI transaction ID). Enter it
                  here so the school can find your payment. A screenshot helps but isn&apos;t required.
                </p>
                <PayForm courseId={course.id} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
