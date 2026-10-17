import type { Metadata } from "next";
import { Suspense } from "react";
import { FormAlert } from "@/components/form";
import { env, googleEnabled } from "@/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string | string[] }>;
}) {
  const google = googleEnabled(env());
  const { deleted } = await searchParams;
  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-muted">Use your school account.</p>
      {deleted === "1" && (
        <div className="mb-6">
          <FormAlert tone="success">
            Your account will be deleted. You've been signed out, and we've emailed you the date.
          </FormAlert>
        </div>
      )}
      <Suspense>
        <SignInForm google={google} />
      </Suspense>
    </>
  );
}
