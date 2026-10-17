"use client";

import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";

/**
 * Download reported payments for a date range as CSV. Fetched rather than linked, so a bad range shows the
 * server's message here instead of a page of JSON.
 */
export function PaymentsExportForm({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [status, setStatus] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from || !to) return setError("Choose both dates.");
    if (from > to) return setError("The end date is before the start date.");
    setBusy(true);
    try {
      const params = new URLSearchParams({ from, to, status });
      const res = await fetch(`/api/v1/admin/payments/csv?${params}`, { credentials: "same-origin" });
      if (!res.ok) {
        const problem = (await res.json().catch(() => null)) as {
          title?: string;
          errors?: { message: string }[];
        } | null;
        setError(problem?.errors?.[0]?.message ?? problem?.title ?? "That didn't work. Try again.");
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
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void download(e)} className="flex flex-col gap-4" aria-label="Download payments">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="export-from"
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
        />
        <Field
          id="export-to"
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-status" className="text-sm font-semibold">
            Which payments
          </label>
          <select
            id="export-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
          >
            <option value="ALL">All</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Waiting to be checked</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Button type="submit" variant="secondary" disabled={busy} className="w-fit">
        {busy ? "Preparing…" : "Download CSV"}
      </Button>
    </form>
  );
}
