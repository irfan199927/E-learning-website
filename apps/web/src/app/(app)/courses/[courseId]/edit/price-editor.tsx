"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Admin: set a course's price in whole rupees (0 = free). */
export function PriceEditor({ courseId, priceInPaise }: { courseId: string; priceInPaise: number | null }) {
  const t = useTranslations("CourseEditor");
  const router = useRouter();
  const [rupees, setRupees] = useState(priceInPaise ? String(priceInPaise / 100) : "0");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await api<{ priceInPaise: number | null }>(`/api/v1/courses/${courseId}/price`, {
        method: "PUT",
        json: { priceRupees: rupees.trim() === "" ? 0 : rupees },
      });
      setNote({
        tone: "success",
        text: res.priceInPaise ? t("pricePaid") : t("priceFree"),
      });
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : t("failed"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      aria-label={t("priceForm")}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-48">
        <Field
          label={t("priceRupees")}
          id="price-rupees"
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? t("saving") : t("savePrice")}
      </Button>
      <div className="basis-full" aria-live="polite">
        {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      </div>
    </form>
  );
}
