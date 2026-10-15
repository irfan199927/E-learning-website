"use client";

import type { EventDropArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
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
  courses: CourseOption[];
}

export function ClassCalendar({ timeZone, canSchedule, googleConnected, courses }: Props) {
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
      extendedProps: { meetLink: c.meetLink },
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
    if (canSchedule && googleConnected && arg.date > new Date()) setDraftStart(arg.date);
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
          {canSchedule && googleConnected && (
            <button
              type="button"
              className={buttonClasses("primary", "h-10")}
              onClick={() => setDraftStart(nextHalfHour())}
            >
              Schedule class
            </button>
          )}
          {canSchedule && !googleConnected && (
            <a href="/api/v1/google/connect?returnTo=/calendar" className={buttonClasses("primary", "h-10")}>
              Connect Google to schedule
            </a>
          )}
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
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
            const link = arg.event.extendedProps.meetLink as string | null;
            if (link) window.open(link, "_blank", "noopener");
          }}
        />
        {canSchedule && (
          <p className="mt-3 text-[13px] text-muted">
            Drag a class to reschedule it — students get an updated Google Calendar invite.
          </p>
        )}
      </section>

      {draftStart && (
        <ScheduleClassForm
          courses={courses}
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
