"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
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
      <h1 className="mb-1 font-display text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      {sent ? (
        <FormAlert tone="success">
          If that email has an account, a reset link is on its way. It expires in 1 hour.
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/sign-in" className="mt-5 inline-block text-sm font-semibold text-primary">
        Back to sign in
      </Link>
    </>
  );
}
