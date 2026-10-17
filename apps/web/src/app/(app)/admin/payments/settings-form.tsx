"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

interface Settings {
  upiId: string | null;
  payeeName: string | null;
  phone: string | null;
  instructions: string | null;
}

/** The UPI ID / number students pay to. Saved as a whole. */
export function PaymentSettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    upiId: settings.upiId ?? "",
    payeeName: settings.payeeName ?? "",
    phone: settings.phone ?? "",
    instructions: settings.instructions ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setFieldErrors({});
    try {
      await api("/api/v1/admin/payment-settings", { method: "PUT", json: form });
      setNote({ tone: "success", text: "Saved. Students see these details when they pay for a course." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        setNote({ tone: "error", text: err.message });
      } else setNote({ tone: "error", text: "That didn't work. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} aria-label="UPI details" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="UPI ID"
          id="upi-id"
          value={form.upiId}
          onChange={set("upiId")}
          placeholder="school@okaxis"
          autoComplete="off"
          error={fieldErrors.upiId}
        />
        <Field
          label="UPI number (phone)"
          id="upi-phone"
          value={form.phone}
          onChange={set("phone")}
          inputMode="tel"
          placeholder="98765 43210"
          error={fieldErrors.phone}
        />
        <Field
          label="Name students will see"
          id="upi-name"
          value={form.payeeName}
          onChange={set("payeeName")}
          placeholder="Sunrise School"
          error={fieldErrors.payeeName}
        />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Instructions (optional)
        <textarea
          value={form.instructions}
          onChange={set("instructions")}
          rows={3}
          maxLength={1000}
          placeholder="For example: write your name and course in the payment note."
          className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px] font-normal"
        />
      </label>
      <div aria-live="polite">{note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}</div>
      <Button type="submit" disabled={busy} className="w-fit">
        {busy ? "Saving…" : "Save UPI details"}
      </Button>
    </form>
  );
}
