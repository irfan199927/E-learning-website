import { describe, expect, it } from "vitest";
import { createMemoryMailer, esc, templates } from "./index";

describe("templates", () => {
  it("escapes user-supplied text in HTML", () => {
    const m = templates.verifyEmail('<script>alert("x")</script>', "https://app/verify?t=1&u=2");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("t=1&amp;u=2");
    expect(esc("'")).toBe("&#39;");
  });
  it("renders reminders in the recipient's timezone", () => {
    const m = templates.classReminder({
      name: "Aanya",
      classTitle: "Quadratics",
      courseTitle: "Maths 9-A",
      startsAt: new Date("2026-10-14T09:30:00Z"),
      timeZone: "Asia/Kolkata",
      kind: "15m",
      url: "https://app/dashboard",
    });
    expect(m.subject).toBe("Quadratics starts in 15 minutes");
    expect(m.text).toMatch(/3:00/);
    expect(templates.resetPassword("A", "https://x").subject).toMatch(/Reset/);
    expect(templates.invite("A <b>", "https://x").html).toContain("A &lt;b&gt;");
  });
  it("lists unread notifications in a digest, escaped, with a way to switch it off", () => {
    const m = templates.notificationDigest({
      name: "Aanya",
      items: [
        { title: "Graded: <Essay>", body: "8/10", url: "https://app/assignments/a1" },
        { title: "Payment confirmed", body: "", url: "https://app/courses/c1" },
      ],
      more: 3,
      inboxUrl: "https://app/notifications",
      settingsUrl: "https://app/account",
    });
    expect(m.subject).toBe("5 new updates on E-learner");
    expect(m.html).toContain("Graded: &lt;Essay&gt;");
    expect(m.text).toContain("- Graded: <Essay> — 8/10\n  https://app/assignments/a1");
    expect(m.text).toContain("…and 3 more.");
    expect(m.html).toContain('href="https://app/account"');
    expect(
      templates.notificationDigest({ ...{ name: "A", inboxUrl: "x", settingsUrl: "y" }, items: [], more: 1 })
        .subject,
    ).toBe("1 new update on E-learner");
  });
  it("memory mailer records messages", async () => {
    const mailer = createMemoryMailer();
    await mailer.send("a@b.c", templates.resetPassword("A", "https://x"));
    expect(mailer.sent).toHaveLength(1);
  });
});
