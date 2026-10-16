import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password123!";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** "YYYY-MM-DDTHH:mm" for now, on the school's clock (the teacher's time zone). */
function nowInKolkata(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

test("a teacher schedules an in-person class without Google, takes attendance, and the parent sees it", async ({
  page,
}, info) => {
  const title = `Lab ${info.project.name} ${Date.now()}`;

  // ── Schedule a class that starts now, in a room (the seeded teacher has no Google connection) ──
  await signIn(page, "teacher@school.edu");
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Schedule class" }).click();
  const form = page.getByRole("complementary", { name: "Schedule a class" });
  await form.getByLabel("Title").fill(title);
  const maths = await form
    .locator("#courseId option", { hasText: "Mathematics · Grade 9-A" })
    .getAttribute("value");
  await form.getByLabel("Class", { exact: true }).selectOption(maths!);
  await form.getByLabel("Starts").fill(nowInKolkata());
  await form.getByLabel("Room or place (optional)").fill("Room 12");
  await form.getByRole("button", { name: "Schedule class" }).click();
  await expect(form).toBeHidden();

  // ── Take attendance from the course page ──
  await page.goto("/courses");
  await page
    .getByRole("link", { name: /Mathematics · Grade 9-A/ })
    .first()
    .click();
  const attendance = page.getByRole("region", { name: "Attendance" });
  await attendance.getByRole("link", { name: new RegExp(`^Take attendance for ${title}`) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Room 12", { exact: false }).first()).toBeVisible();
  await page.getByRole("group", { name: "Aanya Sharma" }).getByLabel("Present").check();
  await page.getByRole("group", { name: "Rohan Patil" }).getByLabel("Absent").check();
  await page.getByRole("button", { name: "Save attendance" }).click();
  await expect(page.getByText("Saved attendance for 2 students.")).toBeVisible();
  await expect(page.getByText("1 present of 2 marked.")).toBeVisible();

  // ── The student sees the room instead of a Join button ──
  await signIn(page, "aanya@school.edu");
  const upcoming = page.getByRole("region", { name: "Upcoming classes" });
  const row = upcoming.getByRole("listitem").filter({ hasText: title });
  await expect(row).toContainText("Room 12");
  await expect(row).toContainText("In person");

  // ── The parent sees the mark ──
  await signIn(page, "parent@example.com");
  await page.getByRole("link", { name: "See Aanya Sharma's progress" }).click();
  const classes = page.getByRole("region", { name: "Live classes, last 30 days" });
  await expect(classes.getByRole("row").filter({ hasText: title })).toContainText("Attended");
});
