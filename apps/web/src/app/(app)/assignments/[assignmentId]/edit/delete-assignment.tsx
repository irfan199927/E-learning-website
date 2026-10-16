"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export function DeleteAssignment({ id, courseId }: { id: string; courseId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error && <FormAlert>{error}</FormAlert>}
      {confirm ? (
        <div
          role="group"
          aria-label="Confirm deleting this assignment"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm">This deletes every student&apos;s work and grade for it.</span>
          <Button
            variant="live"
            onClick={async () => {
              try {
                await api(`/api/v1/assignments/${id}`, { method: "DELETE" });
                router.push(`/courses/${courseId}#assignments`);
                router.refresh();
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Couldn't delete. Try again.");
              }
            }}
          >
            Delete assignment
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-fit" onClick={() => setConfirm(true)}>
          Delete…
        </Button>
      )}
    </div>
  );
}
