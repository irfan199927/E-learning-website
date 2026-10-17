"use client";

import { PAYMENT_IMAGE_TYPES, QR_MAX_BYTES } from "@elearner/core/payments";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Upload, replace or remove the UPI QR code image students can scan. */
export function QrEditor({ qrVersion }: { qrVersion: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setNote(null);
    try {
      await action();
      setNote({ tone: "success", text: ok });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "The upload didn't work. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const upload = (file: File) => {
    if (!(file.type in PAYMENT_IMAGE_TYPES))
      return setNote({ tone: "error", text: "Use a JPEG, PNG or WebP image." });
    if (file.size > QR_MAX_BYTES)
      return setNote({ tone: "error", text: `The QR image can be at most ${QR_MAX_BYTES / 1024 ** 2} MB.` });
    void run(async () => {
      const init = await api<{ qrId: string; uploadUrl: string }>(
        "/api/v1/admin/payment-settings/qr/uploads",
        {
          method: "POST",
          json: { mimeType: file.type, sizeBytes: file.size },
        },
      );
      const put = await fetch(init.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!put.ok) throw new Error("upload");
      await api("/api/v1/admin/payment-settings/qr", {
        method: "PUT",
        json: { qrId: init.qrId, mimeType: file.type },
      });
    }, "QR code saved.");
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {qrVersion ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed storage redirect
        <img
          src={`/api/v1/payment-qr?v=${qrVersion}`}
          alt="Your UPI QR code"
          className="size-40 rounded-xl border border-line bg-white object-contain p-2"
        />
      ) : (
        <p className="text-sm text-muted sm:w-40">
          No QR code yet. Students can still pay to the UPI ID or number.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {qrVersion ? "Replace the QR code" : "Upload a QR code"}
          <input
            type="file"
            accept={Object.keys(PAYMENT_IMAGE_TYPES).join(",")}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
            className="text-sm font-normal file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
          />
        </label>
        <p className="text-sm text-muted">
          The QR from your UPI or bank app (JPEG, PNG or WebP, up to 2 MB).
        </p>
        {qrVersion && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(
                () => api("/api/v1/admin/payment-settings/qr", { method: "DELETE" }),
                "QR code removed.",
              )
            }
            className="w-fit"
          >
            Remove QR code
          </Button>
        )}
        <div aria-live="polite">
          {busy ? (
            <p className="text-sm text-muted">Saving…</p>
          ) : (
            note && <FormAlert tone={note.tone}>{note.text}</FormAlert>
          )}
        </div>
      </div>
    </div>
  );
}
