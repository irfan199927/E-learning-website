import { ERASURE_GRACE_DAYS } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAccount } from "@/server/services/account";
import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "Account" };

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";

export default async function AccountPage() {
  const actor = await requirePageActor();
  const account = await getAccount(deps(), actor);
  const signIn = [account.signIn.google && "Google", account.signIn.password && "email and password"].filter(
    Boolean,
  );
  const day = new Intl.DateTimeFormat("en-IN", { timeZone: actor.timezone, dateStyle: "long" });
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Account</h1>

      <section aria-labelledby="me-h" className={card}>
        <h2 id="me-h" className="mb-3 font-display text-xl font-bold">
          Your details
        </h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">Name</dt>
          <dd className="font-semibold">{account.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="font-semibold break-all">{account.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd className="font-semibold capitalize">{account.role.toLowerCase()}</dd>
          <dt className="text-muted">Signs in with</dt>
          <dd className="font-semibold">{signIn.length ? signIn.join(" or ") : "An invite not used yet"}</dd>
          <dt className="text-muted">Joined</dt>
          <dd className="font-semibold">{day.format(account.createdAt)}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted">Ask a school admin to change your name or email.</p>
      </section>

      {account.role === "STUDENT" && (
        <section aria-labelledby="rec-h" className={card}>
          <h2 id="rec-h" className="mb-1 font-display text-xl font-bold">
            Class recordings
          </h2>
          <p className="text-muted">
            See the recording notice, or agree to it or withdraw.{" "}
            <Link href="/recording-consent" className="font-semibold text-primary-fg">
              Class recordings
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="delete-h" className={card}>
        <h2 id="delete-h" className="mb-1 font-display text-xl font-bold">
          Delete my account
        </h2>
        {account.canDelete ? (
          <>
            <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-muted">
              <li>You're signed out everywhere at once and can't sign in again.</li>
              <li>
                After {ERASURE_GRACE_DAYS} days your account and its data are deleted for good: your progress,
                {account.role === "STUDENT"
                  ? " submissions, quiz answers, grades,"
                  : " links to your children,"}{" "}
                notifications and agreements.
              </li>
              <li>Until then, a school admin can cancel it if you change your mind.</li>
              <li>You may still appear in class recordings. Ask your school if you want one removed.</li>
            </ul>
            <DeleteAccount />
          </>
        ) : (
          <p className="text-muted">
            Teachers and admins own courses and classes, so a school admin deletes these accounts after
            handing them over.
          </p>
        )}
      </section>
    </div>
  );
}
