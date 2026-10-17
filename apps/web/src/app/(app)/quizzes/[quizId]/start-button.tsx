"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function StartQuizButton({ quizId, label }: { quizId: string; label: string }) {
  const t = useTranslations("Quizzes");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        disabled={busy}
        className="w-fit"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/v1/quizzes/${quizId}/attempts`, { method: "POST" });
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t("startFailed"));
            setBusy(false);
          }
        }}
      >
        {busy ? t("starting") : label}
      </Button>
    </div>
  );
}
