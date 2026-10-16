"use client";

import type { NewUserInput, Role } from "@elearner/core";
import { MAX_USERS_PER_IMPORT, parseUserCsv } from "@elearner/core/schemas";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/form";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

type Result = { email: string; status: "created" | "exists" | "email-failed" };

function summary(results: Result[]): { tone: "success" | "error"; text: string } {
  const n = (s: Result["status"]) => results.filter((r) => r.status === s).length;
  const parts = [
    n("created") && `Added ${n("created")} and emailed them a link to choose a password.`,
    n("exists") && `${n("exists")} already had an account and weren't changed.`,
    n("email-failed") && `${n("email-failed")} were added but the email didn't send; use "Resend invite".`,
  ].filter(Boolean);
  return { tone: n("email-failed") ? "error" : "success", text: parts.join(" ") || "Nothing to add." };
}

/** Add one person, or many from a spreadsheet saved as CSV (columns: email, name, role). */
export function AddUsers() {
  const router = useRouter();
  const [mode, setMode] = useState<"one" | "csv">("one");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [csv, setCsv] = useState<{
    users: NewUserInput[];
    problems: { line: number; message: string }[];
  } | null>(null);

  async function send(users: NewUserInput[], reset: () => void) {
    setBusy(true);
    setNote(null);
    try {
      const { results } = await api<{ results: Result[] }>("/api/v1/admin/users", {
        method: "POST",
        json: { users },
      });
      setNote(summary(results));
      reset();
      router.refresh();
    } catch (err) {
      setNote({
        tone: "error",
        text: err instanceof ApiError ? err.message : "Couldn't add them. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  function addOne(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void send(
      [
        {
          email: String(f.get("email") ?? "")
            .trim()
            .toLowerCase(),
          name: String(f.get("name") ?? "").trim(),
          role: String(f.get("role")) as Role,
        },
      ],
      () => form.reset(),
    );
  }

  async function readFile(file: File | undefined) {
    setNote(null);
    setCsv(file ? parseUserCsv(await file.text()) : null);
  }

  const tab = (key: "one" | "csv", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === key}
      aria-controls={`add-${key}`}
      id={`tab-${key}`}
      onClick={() => {
        setMode(key);
        setNote(null);
      }}
      className={`h-11 rounded-full border px-5 text-[15px] font-medium ${
        mode === key
          ? "border-ink bg-ink text-surface"
          : "border-line-strong bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-labelledby="add-h"
      className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
    >
      <h2 id="add-h" className="mb-3 font-display text-xl font-bold">
        Add people
      </h2>
      <div role="tablist" aria-label="How to add people" className="mb-4 flex flex-wrap gap-2">
        {tab("one", "One person")}
        {tab("csv", "From a spreadsheet")}
      </div>
      {note && (
        <div className="mb-4">
          <FormAlert tone={note.tone}>{note.text}</FormAlert>
        </div>
      )}

      {mode === "one" ? (
        <form
          id="add-one"
          role="tabpanel"
          aria-labelledby="tab-one"
          onSubmit={addOne}
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        >
          <Field id="new-name" name="name" label="Full name" required maxLength={120} autoComplete="off" />
          <Field id="new-email" name="email" type="email" label="Email" required autoComplete="off" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-role" className="text-sm font-semibold">
              Role
            </label>
            <select
              id="new-role"
              name="role"
              defaultValue="STUDENT"
              className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]"
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="PARENT">Parent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add and email invite"}
          </Button>
        </form>
      ) : (
        <div id="add-csv" role="tabpanel" aria-labelledby="tab-csv" className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Save your spreadsheet as CSV. The first row names the columns: <code>email</code>,{" "}
            <code>name</code> and optionally <code>role</code> (student, teacher, parent or admin; student if
            empty). Up to {MAX_USERS_PER_IMPORT} people at a time.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="csv-file" className="text-sm font-semibold">
              CSV file
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void readFile(e.target.files?.[0])}
              className="text-[15px] file:mr-3 file:h-11 file:rounded-[var(--radius-control)] file:border file:border-line-strong file:bg-surface file:px-4 file:font-semibold"
            />
          </div>
          {csv && (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="font-semibold">
                {csv.users.length} {csv.users.length === 1 ? "person" : "people"} ready to add
                {csv.problems.length > 0 &&
                  `, ${csv.problems.length} ${csv.problems.length === 1 ? "line" : "lines"} skipped`}
              </p>
              {csv.problems.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-[#A11C14]">
                  {csv.problems.slice(0, 20).map((p) => (
                    <li key={`${p.line}-${p.message}`}>
                      Line {p.line}: {p.message}
                    </li>
                  ))}
                  {csv.problems.length > 20 && <li>…and {csv.problems.length - 20} more</li>}
                </ul>
              )}
              <Button
                className="w-fit"
                disabled={busy || csv.users.length === 0 || csv.users.length > MAX_USERS_PER_IMPORT}
                onClick={() => void send(csv.users, () => setCsv(null))}
              >
                {busy ? "Adding…" : `Add ${csv.users.length} and email invites`}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
