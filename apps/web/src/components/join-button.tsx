"use client";

import { joinWindow } from "@elearner/core/time";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { intlLocale } from "@/i18n/locales";
import { buttonClasses } from "./ui/button";

/**
 * Shows "Join" from N minutes before start. The server re-checks the window on click
 * (/api/v1/classes/:id/join), so this is UX only — never the security boundary.
 */
export function JoinButton({
  classId,
  startsAt,
  endsAt,
  opensMinutesBefore = 10,
  timeZone,
  needsConsent = false,
}: {
  classId: string;
  startsAt: string;
  endsAt: string;
  opensMinutesBefore?: number;
  /** Show "Opens 3:50 pm" on the school's clock, not the browser's. */
  timeZone?: string;
  /** The student hasn't agreed to the class-recording notice: send them there instead of to Meet. */
  needsConsent?: boolean;
}) {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;

  const w = joinWindow(new Date(startsAt), new Date(endsAt), now, opensMinutesBefore);
  if (w.state === "ended") return <span className="text-sm text-muted">{t("ended")}</span>;
  if (needsConsent)
    return (
      <Link href="/recording-consent" className={buttonClasses("secondary")}>
        {t("agreeToJoin")}
      </Link>
    );
  if (w.state === "not-yet") {
    const mins = Math.ceil((w.opensAt.getTime() - now.getTime()) / 60_000);
    const label =
      mins > 90
        ? t("opensAt", {
            time: w.opensAt.toLocaleTimeString(intlLocale(locale), {
              hour: "numeric",
              minute: "2-digit",
              timeZone,
            }),
          })
        : t("opensIn", { minutes: mins });
    return (
      <button type="button" disabled className={buttonClasses("secondary")}>
        {label}
      </button>
    );
  }
  return (
    <a
      href={`/api/v1/classes/${classId}/join`}
      target="_blank"
      rel="noopener"
      className={buttonClasses("live")}
    >
      <span className="size-2 rounded-full bg-white" aria-hidden="true" />
      {t("join")}
    </a>
  );
}
