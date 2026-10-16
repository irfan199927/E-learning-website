import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Regression test for the "calendar renders UTC" bug (fixed in 8a4c37a): without the luxon
 * plugin FullCalendar ignored the school timezone, so a 10:30 IST class showed at 05:00.
 * The browser runs in UTC here on purpose. The calendar must follow the user's timezone
 * (Asia/Kolkata for seeded users), not the device's.
 */
test.use({ timezoneId: "UTC" });

const TZ = "Asia/Kolkata";
const title = `E2E timezone check ${randomUUID().slice(0, 8)}`;
let db: pg.Client;
let classId: string;

test.beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  // Today's date in the school timezone, then 10:30–11:15 local (IST has no DST).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const startsAt = new Date(`${today}T10:30:00+05:30`);
  const endsAt = new Date(`${today}T11:15:00+05:30`);
  classId = `e2e-${randomUUID()}`;
  const { rows } = await db.query<{ id: string; teacherId: string }>(
    `SELECT id, "teacherId" FROM "Course" WHERE slug = 'maths-9a'`,
  );
  if (!rows[0]) throw new Error("Seeded course maths-9a not found. Run `pnpm db:seed` first.");
  await db.query(
    `INSERT INTO "ClassSession" (id, "courseId", "hostId", title, "startsAt", "endsAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [classId, rows[0].id, rows[0].teacherId, title, startsAt, endsAt],
  );
});

test.afterAll(async () => {
  await db?.query(`DELETE FROM "ClassSession" WHERE id = $1`, [classId]);
  await db?.end();
});

test("calendar shows class times in the school timezone, not the browser's", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("aanya@school.edu");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/calendar");
  await page.getByRole("button", { name: "day", exact: true }).click();
  const event = page.locator(".fc-event", { hasText: title });
  await expect(event).toBeVisible();
  await expect(event).toContainText("10:30");
  await expect(event).not.toContainText("5:00"); // what the UTC bug rendered
});
