"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Approve (enrols the student) or reject with a reason the student sees. */
export function DecidePayment({ paymentId, student }: { paymentId: string; student: string }) {
  const t = useTranslations("AdminPayments");
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/payments/${paymentId}`, {
        method: "PATCH",
        json: { decision, note: decision === "reject" ? reason : undefined },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Field
            label={t("rejectReason", { student })}
            id={`reason-${paymentId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="live" disabled={busy || !reason.trim()} onClick={() => void decide("reject")}>
              {t("rejectPayment")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void decide("approve")}
            aria-label={t("approveLabel", { student })}
          >
            {t("approve")}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRejecting(true)}
            aria-label={t("rejectLabel", { student })}
          >
            {t("reject")}
          </Button>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  );
}
