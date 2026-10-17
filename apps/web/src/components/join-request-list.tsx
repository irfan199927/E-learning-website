"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export interface JoinRequestRow {
  id: string;
  name: string;
  email: string;
  message: string | null;
  requestedOn: string;
}

/** A teacher's queue of students asking to join one course, with Approve / Decline. */
export function JoinRequestList({ requests }: { requests: JoinRequestRow[] }) {
  const t = useTranslations("CourseEditor");
  const router = useRouter();
  const [rows, setRows] = useState(requests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(row: JoinRequestRow, decision: "approve" | "decline") {
    setBusy(row.id);
    setError(null);
    try {
      await api(`/api/v1/join-requests/${row.id}`, { method: "PATCH", json: { decision } });
      setRows((r) => r.filter((x) => x.id !== row.id));
      setDone(
        decision === "approve" ? t("approved", { name: row.name }) : t("declinedName", { name: row.name }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {done && <FormAlert tone="success">{done}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      {rows.length === 0 ? (
        <p className="text-muted">{t("noRequests")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{r.name}</p>
                <p className="truncate text-sm text-muted">
                  {t("asked", { email: r.email, date: r.requestedOn })}
                </p>
                {r.message && <p className="mt-1 text-sm">“{r.message}”</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => decide(r, "approve")}
                  disabled={busy !== null}
                  aria-label={t("approveNamed", { name: r.name })}
                >
                  {t("approve")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => decide(r, "decline")}
                  disabled={busy !== null}
                  aria-label={t("declineNamed", { name: r.name })}
                >
                  {t("decline")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
