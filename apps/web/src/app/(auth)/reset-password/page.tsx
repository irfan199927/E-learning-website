"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function ResetForm() {
  const t = useTranslations("Auth");
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!token) return <FormAlert>{t("invalid")}</FormAlert>;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError(t("mismatch"));
    if (password.length < 10) return setError(t("tooShort"));
    setError(null);
    setState("pending");
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    if (error) {
      setState("idle");
      return setError(t("invalid"));
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <FormAlert tone="success">
        {t.rich("updated", {
          link: (chunks) => (
            <Link href="/sign-in" className="font-semibold underline">
              {chunks}
            </Link>
          ),
        })}
      </FormAlert>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        id="password"
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        hint={t("hint")}
        required
      />
      <Field
        id="confirm"
        name="confirm"
        type="password"
        label={t("confirm")}
        autoComplete="new-password"
        required
      />
      <Button type="submit" disabled={state === "pending"}>
        {state === "pending" ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold">{t("resetTitle")}</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
