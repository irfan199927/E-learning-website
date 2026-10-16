"use client";

import type { EventDropArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { FormAlert } from "@/components/form";
import { buttonClasses } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import type { ClassDto } from "@/server/services/classes";
import { ScheduleClassForm, type CourseOption } from "./schedule-class-form";

interface Props {
  timeZone: string;
  canSchedule: boolean;
  googleConnected: boolean;
  /** Google sign-in is configured for this school (it isn't on a LAN-only UAT). */
  googleAvailable: boolean;
  courses: CourseOption[];
}

export function ClassCalendar({ timeZone, canSchedule, googleConnected, googleAvailable, courses }: Props) {
  const router = useRouter();
  const ref = useRef<FullCalendar>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const loadEvents = useCallback(async (info: EventSourceFuncArg): Promise<EventInput[]> => {
    const qs = new URLSearchParams({ from: info.start.toISOString(), to: info.end.toISOString() });
    setRange({ from: info.start.toISOString(), to: info.end.toISOString() });
    const classes = await api<ClassDto[]>(`/api/v1/classes?${qs}`);
    return classes.map((c) => ({
      id: c.id,
      title: `${c.title} · ${c.course.title}`,
      start: c.startsAt,
      end: c.endsAt,
      backgroundColor: c.course.color,
      borderColor: c.course.color,
      editable: c.canManage && new Date(c.startsAt) > new Date(),
      extendedProps: { meetLink: c.meetLink, canManage: c.canManage },
    }));
  }, []);

  async function onEventDrop(arg: EventDropArg) {
    setError(null);
    try {
      await api(`/api/v1/classes/${arg.event.id}`, {
        method: "PATCH",
        json: { startsAt: arg.event.start?.toISOString(), endsAt: arg.event.end?.toISOString() },
      });
    } catch (e) {
      arg.revert();
      setError(e instanceof ApiError ? e.message : "Couldn't move the class. Try again.");
    }
  }

  function onDateClick(arg: DateClickArg) {
    if (canSchedule && arg.date > new Date()) setDraftStart(arg.date);
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="min-w-0 flex-[999_1_560px] rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Times in {timeZone}</span>
          <span className="ml-auto" />
          {range && (
            <a
              href={`/api/v1/calendar.ics?${new URLSearchParams(range)}`}
              className={buttonClasses("secondary", "h-10")}
            >
              Export .ics
            </a>
          )}
          {canSchedule && googleAvailable && !googleConnected && (
            <a
              href="/api/v1/google/connect?returnTo=/calendar"
              className={buttonClasses("secondary", "h-10")}
            >
              Connect Google for Meet
            </a>
          )}
          {canSchedule && (
            <button
              type="button"
              className={buttonClasses("primary", "h-10")}
              onClick={() => setDraftStart(nextHalfHour())}
            >
              Schedule class
            </button>
          )}
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <FullCalendar
          ref={ref}
          // luxonPlugin makes the named `timeZone` real; without it FullCalendar silently renders UTC.
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          timeZone={timeZone}
          firstDay={1}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          nowIndicator
          height="auto"
          events={loadEvents}
          eventDrop={onEventDrop}
          eventDurationEditable={false}
          dateClick={onDateClick}
          eventClick={(arg) => {
            // Teachers: a class that has started opens its attendance; an upcoming one opens its meeting link.
            if (arg.event.extendedProps.canManage && arg.event.start && arg.event.start <= new Date()) {
              router.push(`/classes/${arg.event.id}/attendance`);
              return;
            }
            const link = arg.event.extendedProps.meetLink as string | null;
            if (link) window.open(link, "_blank", "noopener");
          }}
        />
        {canSchedule && (
          <p className="mt-3 text-[13px] text-muted">
            Drag a class to reschedule it (Google classes also update students&apos; Calendar invites). Click
            a class that has started to take attendance.
          </p>
        )}
      </section>

      {draftStart && (
        <ScheduleClassForm
          courses={courses}
          googleConnected={googleConnected}
          timeZone={timeZone}
          initialStart={draftStart}
          onClose={() => setDraftStart(null)}
          onScheduled={() => {
            setDraftStart(null);
            ref.current?.getApi().refetchEvents();
          }}
        />
      )}
    </div>
  );
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}
