import { describe, expect, it } from "vitest";
import { makeDeps, world } from "@/test/fakes";
import { getAttention } from "./attention";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

describe("needs-your-attention counts (integration)", () => {
  it("counts work to grade, join requests and unmarked classes in the teacher's own courses", async () => {
    const w = await world();
    const deps = makeDeps();
    const db = deps.db;
    const assignment = await db.assignment.create({
      data: {
        courseId: w.course.id,
        title: "Essay",
        instructions: "-",
        dueAt: hoursAgo(1),
        publishedAt: new Date(),
      },
    });
    await db.submission.create({
      data: {
        assignmentId: assignment.id,
        userId: w.student.id,
        status: "SUBMITTED",
        submittedAt: hoursAgo(2),
      },
    });
    await db.joinRequest.create({ data: { userId: w.outsider.id, courseId: w.course.id } });
    const unmarked = await db.classSession.create({
      data: {
        courseId: w.course.id,
        hostId: w.teacher.id,
        title: "Room class",
        startsAt: hoursAgo(3),
        endsAt: hoursAgo(2),
      },
    });
    // Not counted: a Google class (Meet fills attendance in) and a class that already has marks.
    await db.classSession.create({
      data: {
        courseId: w.course.id,
        hostId: w.teacher.id,
        title: "Meet class",
        startsAt: hoursAgo(5),
        endsAt: hoursAgo(4),
        googleEventId: `ev-${w.course.id}`,
      },
    });
    const marked = await db.classSession.create({
      data: {
        courseId: w.course.id,
        hostId: w.teacher.id,
        title: "Marked",
        startsAt: hoursAgo(7),
        endsAt: hoursAgo(6),
      },
    });
    await db.attendance.create({
      data: { classSessionId: marked.id, userId: w.student.id, source: "MANUAL", present: true },
    });

    const mine = await getAttention(deps, w.teacher);
    expect(mine.stats).toBeNull();
    expect(mine.items).toEqual([
      { key: "grade", count: 1, href: `/assignments/${assignment.id}` },
      { key: "joinRequests", count: 1, href: `/courses/${w.course.id}#join-requests` },
      { key: "attendance", count: 1, href: `/classes/${unmarked.id}/attendance` },
    ]);

    // Another teacher's work isn't theirs; students can't ask at all.
    expect((await getAttention(deps, w.otherTeacher)).items).toEqual([]);
    await expect(getAttention(deps, w.student)).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Admins see the whole school, plus totals.
    const school = await getAttention(deps, w.admin);
    expect(school.items.find((i) => i.key === "grade")?.count).toBeGreaterThanOrEqual(1);
    expect(school.stats?.courses).toBeGreaterThanOrEqual(1);
  });
});
