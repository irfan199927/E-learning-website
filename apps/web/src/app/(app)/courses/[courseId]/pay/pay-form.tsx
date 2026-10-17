"use client";

import { PROOF_MAX_BYTES } from "@elearner/core/payments";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The UTR, an optional screenshot (straight to storage) and a note. */
export function PayForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (file && !IMAGE_TYPES.includes(file.type))
      return setError({ text: "The screenshot must be a JPEG, PNG or WebP image." });
    if (file && file.size > PROOF_MAX_BYTES)
      return setError({ text: `The screenshot can be at most ${PROOF_MAX_BYTES / 1024 ** 2} MB.` });
    setBusy(true);
    try {
      let proof: { proofId: string; mimeType: string } | undefined;
      if (file) {
        const init = await api<{ proofId: string; uploadUrl: string }>("/api/v1/payments/proofs", {
          method: "POST",
          json: { mimeType: file.type, sizeBytes: file.size },
        });
        const put = await fetch(init.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "content-type": file.type },
        });
        if (!put.ok) throw new Error("upload");
        proof = { proofId: init.proofId, mimeType: file.type };
      }
      await api(`/api/v1/courses/${courseId}/payments`, {
        method: "POST",
        json: { reference, note: note || undefined, proof },
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? { text: err.message, field: err.fieldErrors.find((f) => f.path === "reference")?.message }
          : { text: "That didn't work. Try again." },
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} aria-label="Report your payment" className="flex flex-col gap-4">
      <Field
        label="UPI reference (UTR)"
        id="utr"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        required
        error={error?.field}
        hint="Usually 12 digits, under the payment in your UPI app's history."
      />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Screenshot of the payment (optional)
        <input
          type="file"
          accept={IMAGE_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm font-normal file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
        />
      </label>
      <Field
        label="Note for the school (optional)"
        id="pay-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
      />
      {error && !error.field && <FormAlert>{error.text}</FormAlert>}
      <Button type="submit" disabled={busy || reference.trim().length < 6} className="w-fit">
        {busy ? "Sending…" : "I've paid: send for checking"}
      </Button>
    </form>
  );
}
