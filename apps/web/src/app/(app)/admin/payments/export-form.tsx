"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";

/**
 * Download reported payments for a date range as CSV. Fetched rather than linked, so a bad range shows the
 * server's message here instead of a page of JSON.
 */
export function PaymentsExportForm({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const t = useTranslations("AdminPayments");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from || !to) return setError(t("chooseDates"));
    if (from > to) return setError(t("endBeforeStart"));
    setBusy(true);
    try {
      const params = new URLSearchParams({ from, to, status });
      const res = await fetch(`/api/v1/admin/payments/csv?${params}`, { credentials: "same-origin" });
      if (!res.ok) {
        const problem = (await res.json().catch(() => null)) as {
          title?: string;
          errors?: { message: string }[];
        } | null;
        setError(problem?.errors?.[0]?.message ?? problem?.title ?? t("failed"));
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name ?? "payments.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t("offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void download(e)} className="flex flex-col gap-4" aria-label={t("exportLabel")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="export-from"
          label={t("from")}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
        <Field
          id="export-to"
          label={t("to")}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-status" className="text-sm font-semibold">
            {t("which")}
          </label>
          <select
            id="export-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
          >
            <option value="ALL">{t("all")}</option>
            <option value="APPROVED">{t("tabApproved")}</option>
            <option value="PENDING">{t("waiting")}</option>
            <option value="REJECTED">{t("tabRejected")}</option>
          </select>
        </div>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" variant="secondary" disabled={busy} className="w-fit">
        {busy ? t("preparing") : t("downloadCsv")}
      </Button>
    </form>
  );
}
