import { expect, test, type Page } from "@playwright/test";

// Seeded by packages/db/prisma/seed.ts
const PASSWORD = "Password123!";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("health endpoints", async ({ request }) => {
  expect((await request.get("/api/health")).ok()).toBe(true);
  const ready = await request.get("/api/health/ready");
  expect(await ready.json()).toMatchObject({ status: "ok", checks: { database: "ok", redis: "ok" } });
});

test("signed-out users are sent to sign-in, and APIs return 401 problem+json", async ({ page, request }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcalendar/);
  const res = await request.get("/api/v1/classes?from=2026-10-01&to=2026-10-31");
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("application/problem+json");
});

test("pages carry a nonce-based CSP and security headers", async ({ request }) => {
  const res = await request.get("/sign-in");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});

test("wrong password shows a helpful error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("aanya@school.edu");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
});

test("teacher signs in and sees the dashboard and calendar", async ({ page }) => {
  await signIn(page, "teacher@school.edu");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meera");
  await expect(page.getByRole("link", { name: "Connect Google" })).toBeVisible(); // no grant yet
  await page.getByRole("link", { name: "Calendar" }).first().click();
  await expect(page.getByRole("link", { name: "Connect Google to schedule" })).toBeVisible();
});

test("students cannot schedule classes or upload videos", async ({ page }) => {
  await signIn(page, "aanya@school.edu");
  const origin = new URL(page.url()).origin;
  const schedule = await page.request.post("/api/v1/classes", {
    headers: { origin },
    data: { courseId: "x", title: "Hack", startsAt: "2030-01-01T10:00:00Z", endsAt: "2030-01-01T11:00:00Z" },
  });
  expect(schedule.status()).toBe(403);
  await page.goto("/library/upload");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("cross-site mutations are rejected", async ({ page }) => {
  await signIn(page, "teacher@school.edu");
  const res = await page.request.post("/api/v1/videos/uploads", {
    headers: { origin: "https://evil.example" },
    data: { courseId: "x", title: "x", fileName: "a.mp4", mimeType: "video/mp4", sizeBytes: 1 },
  });
  expect(res.status()).toBe(403);
});

test("student sees their learning overview and courses", async ({ page, isMobile }) => {
  await signIn(page, "aanya@school.edu");
  await expect(page.getByRole("heading", { name: "Monthly progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's progress" })).toBeVisible();
  await expect(page.getByText(/days? streak/i)).toBeVisible();

  if (isMobile) {
    // The drawer is closed (and out of the tab order) until the menu button opens it.
    await expect(page.getByRole("link", { name: "My courses" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page.getByRole("link", { name: "My courses" }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My courses");
  await expect(page.getByRole("link", { name: "Mathematics · Grade 9-A" })).toBeVisible();

  await page.getByRole("link", { name: /^Completed/ }).click();
  await expect(page).toHaveURL(/filter=completed/);

  // Course pages are enrollment-gated like videos: unknown ids are a plain 404.
  const res = await page.goto("/courses/not-a-real-course");
  expect(res?.status()).toBe(404);
});

test("parents don't get a courses page", async ({ page }) => {
  await signIn(page, "parent@example.com");
  await page.goto("/courses");
  await expect(page).toHaveURL(/\/dashboard$/);
});
