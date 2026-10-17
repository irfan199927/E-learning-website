import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FormAlert } from "@/components/form";
import { env, googleEnabled } from "@/env";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("SignIn"))("title") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const t = await getTranslations("SignIn");
  const google = googleEnabled(env());
  const { deleted } = await searchParams;
  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted">{t("intro")}</p>
      {deleted === "1" && (
        <div className="mb-6">
          <FormAlert tone="success">{t("deleted")}</FormAlert>
        </div>
      )}
      <Suspense>
        <SignInForm google={google} />
      </Suspense>
    </>
  );
}
