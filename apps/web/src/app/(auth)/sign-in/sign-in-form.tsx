"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Only same-site paths are allowed as post-login destinations. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/** `google` is false when the server has no Google credentials (e.g. a LAN-only UAT): password sign-in only. */
export function SignInForm({ google }: { google: boolean }) {
  const t = useTranslations("SignIn");
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setError(error.status === 403 ? t("confirmEmail") : error.status === 429 ? t("tooMany") : t("wrong"));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {google && (
        <>
          <Button
            variant="secondary"
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: next,
                errorCallbackURL: "/sign-in?error=google",
              })
            }
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            {t("google")}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {params.get("error") === "google" && <FormAlert>{t("googleFailed")}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <Field id="email" name="email" type="email" label={t("email")} autoComplete="email" required />
        <Field
          id="password"
          name="password"
          type="password"
          label={t("password")}
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>
      <Link href="/forgot-password" className="text-sm font-semibold text-primary-fg">
        {t("forgot")}
      </Link>
    </div>
  );
}
