import { ERASURE_GRACE_DAYS } from "@elearner/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguagePicker } from "@/components/language-picker";
import { intlLocale } from "@/i18n/locales";
import { requirePageActor } from "@/lib/session";
import { deps } from "@/server/container";
import { getAccount } from "@/server/services/account";
import { DeleteAccount } from "./delete-account";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Account"))("title") };
}

const card = "rounded-[var(--radius-card)] border border-line bg-surface p-5";

export default async function AccountPage() {
  const actor = await requirePageActor();
  const [account, t, roles, language, locale] = await Promise.all([
    getAccount(deps(), actor),
    getTranslations("Account"),
    getTranslations("Roles"),
    getTranslations("Language"),
    getLocale(),
  ]);
  const { google, password } = account.signIn;
  const signIn =
    google && password
      ? t("signInBoth")
      : google
        ? t("signInGoogle")
        : password
          ? t("signInPassword")
          : t("signInNone");
  const day = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: actor.timezone, dateStyle: "long" });
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>

      <section aria-labelledby="me-h" className={card}>
        <h2 id="me-h" className="mb-3 font-display text-xl font-bold">
          {t("details")}
        </h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">{t("name")}</dt>
          <dd className="font-semibold">{account.name}</dd>
          <dt className="text-muted">{t("email")}</dt>
          <dd className="font-semibold break-all">{account.email}</dd>
          <dt className="text-muted">{t("role")}</dt>
          <dd className="font-semibold">{roles(account.role)}</dd>
          <dt className="text-muted">{t("signsInWith")}</dt>
          <dd className="font-semibold">{signIn}</dd>
          <dt className="text-muted">{t("joined")}</dt>
          <dd className="font-semibold">{day.format(account.createdAt)}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted">{t("changeDetails")}</p>
      </section>

      <section className={card}>
        <LanguagePicker current={locale} />
        <p className="mt-2 text-sm text-muted">{language("help")}</p>
      </section>

      {account.role === "STUDENT" && (
        <section aria-labelledby="rec-h" className={card}>
          <h2 id="rec-h" className="mb-1 font-display text-xl font-bold">
            {t("recordings")}
          </h2>
          <p className="text-muted">
            {t("recordingsText")}{" "}
            <Link href="/recording-consent" className="font-semibold text-primary-fg">
              {t("recordings")}
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="delete-h" className={card}>
        <h2 id="delete-h" className="mb-1 font-display text-xl font-bold">
          {t("delete")}
        </h2>
        {account.canDelete ? (
          <>
            <ul className="mb-4 flex list-disc flex-col gap-1 pl-5 text-muted">
              <li>{t("deleteSignedOut")}</li>
              <li>{t("deleteAfter", { days: ERASURE_GRACE_DAYS, role: account.role })}</li>
              <li>{t("deleteCancel")}</li>
              <li>{t("deleteRecordings")}</li>
            </ul>
            <DeleteAccount />
          </>
        ) : (
          <p className="text-muted">{t("deleteStaff")}</p>
        )}
      </section>
    </div>
  );
}
