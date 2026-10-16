import type { Metadata } from "next";
import { Suspense } from "react";
import { env, googleEnabled } from "@/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const google = googleEnabled(env());
  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-muted">Use your school account.</p>
      <Suspense>
        <SignInForm google={google} />
      </Suspense>
    </>
  );
}
