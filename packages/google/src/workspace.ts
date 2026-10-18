/**
 * Per-teacher Google client. Everything the app needs from Calendar, Meet and Drive,
 * behind a small interface (`TeacherGoogle`) so services can be unit-tested with a fake.
 */
import { type Readable } from "node:stream";
import { Errors } from "@elearner/core";
import { calendar as calendarApi, type calendar_v3 } from "@googleapis/calendar";
import { drive as driveApi } from "@googleapis/drive";
import { meet as meetApi } from "@googleapis/meet";
import { createOAuthClient, type GoogleOAuthConfig } from "./oauth";
import type { CredentialStore } from "./credential-store";
import { withRetry } from "./retry";

export interface ClassEventInput {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  /** Full RRULE line, e.g. "RRULE:FREQ=WEEKLY;BYDAY=WE;UNTIL=20261218T182959Z" */
  rrule?: string;
  attendeeEmails: string[];
  /** Shown in the invite instead of a join link, e.g. where to join from. */
  joinNote?: string;
  /** Our identifier, stored on the event so Calendar push sync can find the class. */
  appRef: string;
}

export interface EventInstance {
  eventId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface CreatedEvent {
  eventId: string;
  etag: string | null;
  meetLink: string | null;
  /** The Meet meeting code (abc-defg-hij): recordings and attendance are looked up by it. */
  conferenceId: string | null;
  /** One entry for a single class; every occurrence for a recurring series. */
  instances: EventInstance[];
}

export interface ConferenceRecord {
  name: string;
  startTime: Date;
  endTime: Date | null;
}

export interface Recording {
  name: string;
  state: string;
  driveFileId: string | null;
  startTime: Date | null;
  endTime: Date | null;
}

export interface ParticipantSessions {
  /** Google account id (same as the OpenID `sub`) for signed-in users, else null. */
  googleUserId: string | null;
  displayName: string | null;
  sessions: { start: Date; end: Date }[];
}

export interface ChangedEvent {
  eventId: string;
  status: "confirmed" | "tentative" | "cancelled";
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface TeacherGoogle {
  createClassEvent(input: ClassEventInput): Promise<CreatedEvent>;
  rescheduleEvent(
    eventId: string,
    startsAt: Date,
    endsAt: Date,
    timeZone: string,
  ): Promise<{ etag: string | null }>;
  cancelEvent(eventId: string): Promise<void>;
  findConferenceRecords(meetingCode: string, window: { from: Date; to: Date }): Promise<ConferenceRecord[]>;
  listRecordings(conferenceRecordName: string): Promise<Recording[]>;
  listParticipantSessions(conferenceRecordName: string): Promise<ParticipantSessions[]>;
  downloadDriveFile(
    fileId: string,
  ): Promise<{ stream: Readable; name: string; mimeType: string | null; size: number | null }>;
  watchCalendar(
    channelId: string,
    address: string,
    token: string,
    ttlSec: number,
  ): Promise<{ resourceId: string; expiresAt: Date }>;
  stopChannel(channelId: string, resourceId: string): Promise<void>;
  /**
   * Incremental Calendar sync. Pass the last nextSyncToken (or null for a full sync).
   * If Google invalidated the token (410 Gone) this transparently does a full sync.
   */
  listChangedEvents(
    syncToken: string | null,
  ): Promise<{ events: ChangedEvent[]; nextSyncToken: string | null }>;
}

const CALENDAR_ID = "primary";
const date = (s: string | null | undefined) => (s ? new Date(s) : null);

export async function createTeacherGoogle(
  cfg: GoogleOAuthConfig,
  store: CredentialStore,
  userId: string,
  opts: { sleep?: (ms: number) => Promise<void> } = {},
): Promise<TeacherGoogle> {
  const grant = await store.load(userId);
  if (!grant) throw Errors.googleReconnect();

  const auth = createOAuthClient(cfg);
  auth.setCredentials({
    refresh_token: grant.refreshToken,
    access_token: grant.accessToken ?? undefined,
    expiry_date: grant.expiresAt?.getTime(),
  });
  // google-auth-library refreshes transparently; persist what it gets back.
  auth.on("tokens", (t) => {
    if (t.access_token)
      void store.saveAccessToken(userId, t.access_token, t.expiry_date ? new Date(t.expiry_date) : null);
    if (t.refresh_token) void store.saveRefreshToken(userId, t.refresh_token);
  });

  const calendar = calendarApi({ version: "v3", auth });
  const meet = meetApi({ version: "v2", auth });
  const drive = driveApi({ version: "v3", auth });
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const call = <T>(fn: () => Promise<T>) =>
    withRetry(fn, { sleep, onRevoked: () => store.markRevoked(userId) });

  return {
    async createClassEvent(input) {
      // The Meet room is its own space, NOT the event's conference: Calendar invites then carry no join link,
      // so students join through E-learner, which checks recording consent first. TRUSTED = people in the
      // school's Workspace join directly, anyone else knocks.
      const space = (
        await call(() => meet.spaces.create({ requestBody: { config: { accessType: "TRUSTED" } } }))
      ).data;
      if (!space.meetingUri || !space.meetingCode)
        throw Errors.upstream("Google Meet", "Could not create a Meet room for this class.");

      const requestBody: calendar_v3.Schema$Event = {
        summary: input.title,
        description: [input.description, input.joinNote].filter(Boolean).join("\n\n"),
        start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone },
        end: { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone },
        recurrence: input.rrule ? [input.rrule] : undefined,
        attendees: input.attendeeEmails.map((email) => ({ email })),
        guestsCanModify: false,
        guestsCanInviteOthers: false,
        guestsCanSeeOtherGuests: false, // students must not see each other's emails
        reminders: { useDefault: false, overrides: [] }, // we send our own reminders
        extendedProperties: { private: { elearnerRef: input.appRef } },
      };
      const ev = (
        await call(() => calendar.events.insert({ calendarId: CALENDAR_ID, sendUpdates: "all", requestBody }))
      ).data;

      let instances: EventInstance[] = [{ eventId: ev.id!, startsAt: input.startsAt, endsAt: input.endsAt }];
      if (input.rrule) {
        const res = await call(() =>
          calendar.events.instances({ calendarId: CALENDAR_ID, eventId: ev.id!, maxResults: 250 }),
        );
        instances = (res.data.items ?? [])
          .filter((i) => i.id && i.start?.dateTime && i.end?.dateTime && i.status !== "cancelled")
          .map((i) => ({
            eventId: i.id!,
            startsAt: new Date(i.start!.dateTime!),
            endsAt: new Date(i.end!.dateTime!),
          }));
      }
      return {
        eventId: ev.id!,
        etag: ev.etag ?? null,
        meetLink: space.meetingUri,
        conferenceId: space.meetingCode,
        instances,
      };
    },

    async rescheduleEvent(eventId, startsAt, endsAt, timeZone) {
      const res = await call(() =>
        calendar.events.patch({
          calendarId: CALENDAR_ID,
          eventId,
          sendUpdates: "all",
          requestBody: {
            start: { dateTime: startsAt.toISOString(), timeZone },
            end: { dateTime: endsAt.toISOString(), timeZone },
          },
        }),
      );
      return { etag: res.data.etag ?? null };
    },

    async cancelEvent(eventId) {
      try {
        await call(() => calendar.events.delete({ calendarId: CALENDAR_ID, eventId, sendUpdates: "all" }));
      } catch (err) {
        // Already gone in Google is fine — the goal state is "cancelled".
        const status =
          (err as { status?: number; response?: { status?: number } }).status ??
          (err as { response?: { status?: number } }).response?.status;
        if (status !== 404 && status !== 410) throw err;
      }
    },

    async findConferenceRecords(meetingCode, window) {
      const filter = `space.meeting_code = "${meetingCode}" AND start_time >= "${window.from.toISOString()}" AND start_time <= "${window.to.toISOString()}"`;
      const out: ConferenceRecord[] = [];
      let pageToken: string | undefined;
      do {
        const res = await call(() => meet.conferenceRecords.list({ filter, pageToken, pageSize: 25 }));
        for (const r of res.data.conferenceRecords ?? []) {
          if (r.name && r.startTime)
            out.push({ name: r.name, startTime: new Date(r.startTime), endTime: date(r.endTime) });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return out;
    },

    async listRecordings(conferenceRecordName) {
      const res = await call(() => meet.conferenceRecords.recordings.list({ parent: conferenceRecordName }));
      return (res.data.recordings ?? []).map((r) => ({
        name: r.name ?? "",
        state: r.state ?? "STATE_UNSPECIFIED",
        driveFileId: r.driveDestination?.file ?? null,
        startTime: date(r.startTime),
        endTime: date(r.endTime),
      }));
    },

    async listParticipantSessions(conferenceRecordName) {
      const out: ParticipantSessions[] = [];
      let pageToken: string | undefined;
      do {
        const res = await call(() =>
          meet.conferenceRecords.participants.list({
            parent: conferenceRecordName,
            pageSize: 100,
            pageToken,
          }),
        );
        for (const p of res.data.participants ?? []) {
          if (!p.name) continue;
          const sessions = await call(() =>
            meet.conferenceRecords.participants.participantSessions.list({ parent: p.name!, pageSize: 100 }),
          );
          out.push({
            googleUserId: p.signedinUser?.user?.replace(/^users\//, "") ?? null,
            displayName:
              p.signedinUser?.displayName ?? p.anonymousUser?.displayName ?? p.phoneUser?.displayName ?? null,
            sessions: (sessions.data.participantSessions ?? [])
              .filter((s) => s.startTime)
              .map((s) => ({ start: new Date(s.startTime!), end: new Date(s.endTime ?? Date.now()) })),
          });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return out;
    },

    async downloadDriveFile(fileId) {
      const meta = await call(() =>
        drive.files.get({ fileId, fields: "id,name,mimeType,size", supportsAllDrives: true }),
      );
      const res = await call(() =>
        drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" }),
      );
      return {
        stream: res.data as unknown as Readable,
        name: meta.data.name ?? fileId,
        mimeType: meta.data.mimeType ?? null,
        size: meta.data.size ? Number(meta.data.size) : null,
      };
    },

    async watchCalendar(channelId, address, token, ttlSec) {
      const res = await call(() =>
        calendar.events.watch({
          calendarId: CALENDAR_ID,
          requestBody: { id: channelId, type: "web_hook", address, token, params: { ttl: String(ttlSec) } },
        }),
      );
      return {
        resourceId: res.data.resourceId ?? "",
        expiresAt: new Date(Number(res.data.expiration ?? Date.now() + ttlSec * 1000)),
      };
    },

    async stopChannel(channelId, resourceId) {
      await call(() => calendar.channels.stop({ requestBody: { id: channelId, resourceId } }));
    },

    async listChangedEvents(syncToken) {
      const run = async (token: string | null) => {
        const events: ChangedEvent[] = [];
        let pageToken: string | undefined;
        let nextSyncToken: string | null = null;
        do {
          const res = await call(() =>
            calendar.events.list({
              calendarId: CALENDAR_ID,
              singleEvents: true,
              showDeleted: true,
              maxResults: 250,
              pageToken,
              ...(token ? { syncToken: token } : {}),
            }),
          );
          for (const e of res.data.items ?? []) {
            if (!e.id) continue;
            events.push({
              eventId: e.id,
              status: (e.status as ChangedEvent["status"]) ?? "confirmed",
              startsAt: date(e.start?.dateTime),
              endsAt: date(e.end?.dateTime),
            });
          }
          pageToken = res.data.nextPageToken ?? undefined;
          nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
        } while (pageToken);
        return { events, nextSyncToken };
      };
      try {
        return await run(syncToken);
      } catch (err) {
        const status =
          (err as { status?: number }).status ?? (err as { response?: { status?: number } }).response?.status;
        if (status === 410 && syncToken) return run(null);
        throw err;
      }
    },
  };
}
