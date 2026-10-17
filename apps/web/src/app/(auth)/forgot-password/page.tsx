"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const email = String(new FormData(e.currentTarget).get("email"));
    // Same message whether or not the account exists (no account enumeration).
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    setSent(true);
  }

  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">{t("forgotTitle")}</h1>
      <p className="mb-6 text-sm text-muted">{t("forgotIntro")}</p>
      {sent ? (
        <FormAlert tone="success">{t("sent")}</FormAlert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field id="email" name="email" type="email" label={t("email")} autoComplete="email" required />
          <Button type="submit" disabled={pending}>
            {pending ? t("sending") : t("send")}
          </Button>
        </form>
      )}
      <Link href="/sign-in" className="mt-5 inline-block text-sm font-semibold text-primary-fg">
        {t("back")}
      </Link>
    </>
  );
}
