"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function ResetForm() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!token) return <FormAlert>This reset link is invalid or has expired. Request a new one.</FormAlert>;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("The two passwords don't match.");
    if (password.length < 10) return setError("Use at least 10 characters.");
    setError(null);
    setState("pending");
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    if (error) {
      setState("idle");
      return setError("This reset link is invalid or has expired. Request a new one.");
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <FormAlert tone="success">
        Password updated. You&apos;ve been signed out everywhere else.{" "}
        <Link href="/sign-in" className="font-semibold underline">
          Sign in
        </Link>
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
        label="New password"
        autoComplete="new-password"
        hint="At least 10 characters."
        required
      />
      <Field
        id="confirm"
        name="confirm"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
      />
      <Button type="submit" disabled={state === "pending"}>
        {state === "pending" ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold">Choose a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
