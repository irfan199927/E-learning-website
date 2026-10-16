import { describe, expect, it } from "vitest";
import { computeAttendance, mergeIntervals } from "./attendance";
import { decrypt, encrypt, needsReencrypt, parseKeyring, sha256Hex, signToken, verifyToken } from "./crypto";
import { AppError, Errors, isAppError } from "./errors";
import { isPlaylist, resolveHlsPath, rewritePlaylist } from "./hls";
import { buildIcs, escapeText, foldLine } from "./ics";
import { assertCan, can } from "./rbac";
import { buildRRule } from "./rrule";
import {
  createClassSchema,
  initUploadSchema,
  listClassesQuerySchema,
  partCount,
  rescheduleClassSchema,
} from "./schemas";
import { formatInZone, isValidTimeZone, joinWindow, reminderSchedule } from "./time";

const key = (b: number) => Buffer.alloc(32, b).toString("base64");
const t = (iso: string) => new Date(iso);

describe("rbac", () => {
  it("grants teachers scheduling and denies students", () => {
    expect(can("TEACHER", "class:schedule")).toBe(true);
    expect(can("STUDENT", "class:schedule")).toBe(false);
    expect(can("PARENT", "video:watch")).toBe(false);
  });
  it("assertCan throws a FORBIDDEN AppError", () => {
    expect(() => assertCan("STUDENT", "video:upload")).toThrowError(AppError);
    try {
      assertCan("STUDENT", "video:upload");
    } catch (e) {
      expect(isAppError(e) && e.status).toBe(403);
    }
    expect(() => assertCan("ADMIN", "user:manage")).not.toThrow();
  });
});

describe("errors", () => {
  it("maps codes to HTTP status", () => {
    expect(Errors.notFound("Class").status).toBe(404);
    expect(Errors.rateLimited(5).details).toEqual({ retryAfterSec: 5 });
    expect(Errors.googleReconnect().code).toBe("GOOGLE_RECONNECT_REQUIRED");
    expect(Errors.upstream("Google", "boom").status).toBe(502);
    expect(Errors.unauthenticated().status).toBe(401);
    expect(Errors.validation("x").status).toBe(400);
    expect(Errors.conflict("x").status).toBe(409);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});

describe("crypto", () => {
  const ring = parseKeyring(`v1:${key(1)},v2:${key(2)}`, "v2");

  it("round-trips and tags ciphertext with the active key", () => {
    const c = encrypt("refresh-token", ring);
    expect(c.startsWith("v2.")).toBe(true);
    expect(decrypt(c, ring)).toBe("refresh-token");
    expect(needsReencrypt(c, ring)).toBe(false);
  });
  it("decrypts rows written with an older key", () => {
    const old = encrypt("x", parseKeyring(`v1:${key(1)}`, "v1"));
    expect(decrypt(old, ring)).toBe("x");
    expect(needsReencrypt(old, ring)).toBe(true);
  });
  it("detects tampering", () => {
    const c = encrypt("secret", ring).split(".");
    c[3] = Buffer.from("evil").toString("base64url");
    expect(() => decrypt(c.join("."), ring)).toThrow();
    expect(() => decrypt("v9.a.b.c", ring)).toThrow(/Unknown/);
    expect(() => decrypt("garbage", ring)).toThrow(/Malformed/);
  });
  it("rejects bad keyrings at boot", () => {
    expect(() => parseKeyring("v1:short", "v1")).toThrow(/32 bytes/);
    expect(() => parseKeyring(`v1:${key(1)}`, "v2")).toThrow(/Active key/);
    expect(() => parseKeyring("nocolon", "v1")).toThrow();
    expect(() => parseKeyring(`v.1:${key(1)}`, "v.1")).toThrow(/'.'/);
  });
  it("signs and verifies expiring tokens", () => {
    const now = Date.now();
    const tok = signToken({ uid: "u1" }, "s3cret", 60, now);
    expect(verifyToken<{ uid: string }>(tok, "s3cret", now)?.uid).toBe("u1");
    expect(verifyToken(tok, "other", now)).toBeNull();
    expect(verifyToken(tok, "s3cret", now + 61_000)).toBeNull();
    expect(verifyToken("nodot", "s3cret")).toBeNull();
    expect(verifyToken(`${Buffer.from("{bad").toString("base64url")}.x`, "s3cret")).toBeNull();
  });
  it("hashes", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("time", () => {
  const start = t("2026-10-14T09:30:00Z");
  const end = t("2026-10-14T10:15:00Z");
  it("opens the join button 10 minutes before start", () => {
    expect(joinWindow(start, end, t("2026-10-14T09:19:59Z")).state).toBe("not-yet");
    expect(joinWindow(start, end, t("2026-10-14T09:20:00Z")).state).toBe("open");
    expect(joinWindow(start, end, t("2026-10-14T10:15:00Z")).state).toBe("ended");
  });
  it("schedules only future reminders", () => {
    expect(reminderSchedule(start, t("2026-10-13T00:00:00Z")).map((r) => r.kind)).toEqual(["24h", "15m"]);
    expect(reminderSchedule(start, t("2026-10-14T09:00:00Z")).map((r) => r.kind)).toEqual(["15m"]);
    expect(reminderSchedule(start, t("2026-10-14T09:20:00Z"))).toEqual([]);
  });
  it("formats in IST and validates zones", () => {
    expect(formatInZone(start, "Asia/Kolkata")).toMatch(/3:00/);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

describe("rrule", () => {
  it("sorts and dedupes days, emits UTC UNTIL", () => {
    expect(
      buildRRule({ freq: "WEEKLY", byDay: ["WE", "MO", "WE"], until: t("2026-12-18T18:29:59.000Z") }),
    ).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T182959Z");
    expect(() => buildRRule({ freq: "WEEKLY", byDay: [], until: new Date() })).toThrow();
  });
});

describe("ics", () => {
  it("escapes, folds and terminates with CRLF", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = "SUMMARY:" + "क".repeat(40);
    expect(
      foldLine(long)
        .split("\r\n ")
        .every((l) => Buffer.byteLength(l) <= 75),
    ).toBe(true);
    const ics = buildIcs([
      {
        uid: "c1@elearner",
        title: "Maths, 9-A",
        startsAt: t("2026-10-14T09:30:00Z"),
        endsAt: t("2026-10-14T10:15:00Z"),
        description: "Agenda",
        location: "Google Meet",
        url: "https://meet.google.com/abc-defg-hij",
        updatedAt: t("2026-10-01T00:00:00Z"),
      },
      {
        uid: "c2",
        title: "Off",
        startsAt: t("2026-10-15T09:30:00Z"),
        endsAt: t("2026-10-15T10:00:00Z"),
        cancelled: true,
        updatedAt: t("2026-10-01T00:00:00Z"),
      },
    ]);
    expect(ics).toContain("SUMMARY:Maths\\, 9-A");
    expect(ics).toContain("DTSTART:20261014T093000Z");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("hls", () => {
  it("rewrites segment lines and URI attributes, keeps tags", () => {
    const pl = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg_000.ts\n\n#EXT-X-ENDLIST';
    const out = rewritePlaylist(pl, (u) => `https://cdn/x/${u}?sig=1`);
    expect(out).toContain('#EXT-X-MAP:URI="https://cdn/x/init.mp4?sig=1"');
    expect(out).toContain("https://cdn/x/seg_000.ts?sig=1");
    expect(out).toContain("#EXT-X-ENDLIST");
  });
  it("resolves relative paths and blocks traversal", () => {
    expect(resolveHlsPath("master.m3u8", "720p/index.m3u8")).toBe("720p/index.m3u8");
    expect(resolveHlsPath("720p/index.m3u8", "./seg_001.ts")).toBe("720p/seg_001.ts");
    expect(resolveHlsPath("720p/index.m3u8", "../360p/seg.ts")).toBe("360p/seg.ts");
    expect(() => resolveHlsPath("master.m3u8", "../../etc/passwd")).toThrow(/escapes/);
    expect(() => resolveHlsPath("master.m3u8", "https://evil/x.ts")).toThrow(/Absolute/);
    expect(isPlaylist("a/b.m3u8")).toBe(true);
    expect(isPlaylist("a/b.ts")).toBe(false);
  });
});

describe("attendance", () => {
  const win = { start: t("2026-10-14T09:30:00Z"), end: t("2026-10-14T10:30:00Z") };
  it("merges overlapping sessions", () => {
    expect(
      mergeIntervals([
        { start: t("2026-10-14T09:40:00Z"), end: t("2026-10-14T09:50:00Z") },
        { start: t("2026-10-14T09:30:00Z"), end: t("2026-10-14T09:45:00Z") },
        { start: t("2026-10-14T10:00:00Z"), end: t("2026-10-14T09:59:00Z") },
      ]),
    ).toHaveLength(1);
  });
  it("counts clipped time and applies the threshold", () => {
    const r = computeAttendance(
      [
        { start: t("2026-10-14T09:25:00Z"), end: t("2026-10-14T09:50:00Z") },
        { start: t("2026-10-14T10:00:00Z"), end: t("2026-10-14T10:15:00Z") },
      ],
      win,
    );
    expect(r.durationSeconds).toBe(35 * 60);
    expect(r.present).toBe(true);
    expect(r.joinedAt?.toISOString()).toBe("2026-10-14T09:25:00.000Z");
    expect(
      computeAttendance([{ start: t("2026-10-14T09:30:00Z"), end: t("2026-10-14T09:40:00Z") }], win).present,
    ).toBe(false);
    expect(computeAttendance([], win)).toEqual({
      joinedAt: null,
      leftAt: null,
      durationSeconds: 0,
      present: false,
    });
  });
});

describe("schemas", () => {
  const base = {
    courseId: "c1",
    title: "Quadratics",
    startsAt: "2026-10-14T09:30:00Z",
    endsAt: "2026-10-14T10:15:00Z",
  };
  it("accepts a valid class and defaults timezone", () => {
    const v = createClassSchema.parse(base);
    expect(v.timezone).toBe("Asia/Kolkata");
    expect(v.notifyParents).toBe(true);
  });
  it("rejects bad ranges and series", () => {
    expect(createClassSchema.safeParse({ ...base, endsAt: base.startsAt }).success).toBe(false);
    expect(createClassSchema.safeParse({ ...base, endsAt: "2026-10-14T20:00:00Z" }).success).toBe(false);
    expect(createClassSchema.safeParse({ ...base, timezone: "Nope/Zone" }).success).toBe(false);
    expect(
      createClassSchema.safeParse({
        ...base,
        recurrence: { freq: "WEEKLY", byDay: ["WE"], until: "2027-12-01T00:00:00Z" },
      }).success,
    ).toBe(false);
    expect(
      createClassSchema.safeParse({
        ...base,
        recurrence: { freq: "WEEKLY", byDay: ["WE"], until: "2026-10-01T00:00:00Z" },
      }).success,
    ).toBe(false);
    expect(rescheduleClassSchema.safeParse({ startsAt: base.endsAt, endsAt: base.startsAt }).success).toBe(
      false,
    );
  });
  it("bounds list ranges", () => {
    expect(listClassesQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31" }).success).toBe(true);
    expect(listClassesQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(false);
    expect(listClassesQuerySchema.safeParse({ from: "2026-10-31", to: "2026-10-01" }).success).toBe(false);
  });
  it("validates uploads", () => {
    expect(
      initUploadSchema.safeParse({
        courseId: "c",
        title: "Lesson",
        fileName: "a.mp4",
        mimeType: "video/mp4",
        sizeBytes: 10,
      }).success,
    ).toBe(true);
    const bad = initUploadSchema.safeParse({
      courseId: "c",
      title: "Lesson",
      fileName: "a.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 10,
    });
    expect(bad.success).toBe(false);
    expect(partCount(16 * 1024 * 1024 * 2 + 1)).toBe(3);
  });
});

describe("timezone conversion", () => {
  it("round-trips IST wall-clock input", async () => {
    const { zonedInputToUtc, utcToZonedInput, timeZoneOffsetMs } = await import("./time");
    expect(zonedInputToUtc("2026-10-14T15:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-10-14T09:30:00.000Z",
    );
    expect(utcToZonedInput(new Date("2026-10-14T09:30:00Z"), "Asia/Kolkata")).toBe("2026-10-14T15:00");
    expect(timeZoneOffsetMs(new Date("2026-01-01T00:00:00Z"), "Asia/Kolkata")).toBe(5.5 * 3600_000);
    expect(Number.isNaN(zonedInputToUtc("garbage", "UTC").getTime())).toBe(true);
  });
  it("handles DST zones on both sides of a transition", async () => {
    const { zonedInputToUtc } = await import("./time");
    expect(zonedInputToUtc("2026-03-07T10:00", "America/New_York").toISOString()).toBe(
      "2026-03-07T15:00:00.000Z",
    );
    expect(zonedInputToUtc("2026-03-09T10:00", "America/New_York").toISOString()).toBe(
      "2026-03-09T14:00:00.000Z",
    );
  });
});

describe("parseUserCsv", () => {
  it("reads columns in any order, defaults the role, and reports bad lines", async () => {
    const { parseUserCsv } = await import("./schemas");
    const csv = [
      "Name,Email,Role",
      '"Sharma, Aanya",AANYA@x.in,student',
      "Meera Kulkarni,meera@x.in,teacher",
      "No Email,,",
      "Rohan,rohan@x.in,",
      "Dup,aanya@x.in,",
      "Bad Role,b@x.in,principal",
      "",
    ].join("\r\n");
    const { users, problems } = parseUserCsv(csv);
    expect(users).toEqual([
      { email: "aanya@x.in", name: "Sharma, Aanya", role: "STUDENT" },
      { email: "meera@x.in", name: "Meera Kulkarni", role: "TEACHER" },
      { email: "rohan@x.in", name: "Rohan", role: "STUDENT" },
    ]);
    expect(problems.map((p) => p.line)).toEqual([4, 6, 7]);
    expect(problems[1]!.message).toMatch(/twice/);
    expect(parseUserCsv("foo,bar\n1,2").problems[0]!.line).toBe(1);
  });
});

describe("ageOn / isMinorOn", () => {
  it("counts whole years and flips on the birthday", async () => {
    const { ageOn, isMinorOn } = await import("./consent");
    const dob = new Date("2008-10-17T00:00:00Z");
    expect(ageOn(dob, new Date("2026-10-16T12:00:00Z"))).toBe(17);
    expect(isMinorOn(dob, new Date("2026-10-16T12:00:00Z"))).toBe(true);
    expect(ageOn(dob, new Date("2026-10-17T00:00:00Z"))).toBe(18);
    expect(isMinorOn(dob, new Date("2026-10-17T00:00:00Z"))).toBe(false);
    expect(ageOn(new Date("2008-02-29T00:00:00Z"), new Date("2026-02-28T00:00:00Z"))).toBe(17);
  });
});
