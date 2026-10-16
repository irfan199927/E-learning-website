import { expect, test } from "@playwright/test";
import { course } from "../src/app/(marketing)/course";

test("landing page advertises the course and is indexable", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(course.name);
  for (const m of course.modules) {
    await expect(page.getByRole("heading", { name: m.title })).toBeVisible();
  }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
});

test("Enroll sends visitors to sign-in, then on to their courses", async ({ page, isMobile }) => {
  await page.goto("/");
  // The hero's own button (the header has one too).
  await page.locator(".lp-hero-actions").getByRole("link", { name: "Enroll now" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcourses$/);

  await page.getByLabel("Email").fill("aanya@school.edu");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/courses$/);

  // Signed-in visitors get "Go to dashboard" instead of the enrol pitch.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Enroll now" })).toHaveCount(0);
  if (!isMobile)
    await expect(page.locator(".lp-header").getByRole("link", { name: "Go to dashboard" })).toBeVisible();
});

test.describe("reduced motion", () => {
  test("everything is readable without the scroll animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const portal = page.locator("[data-gp-ready]");
    await expect(portal).toHaveAttribute("data-gp-motion", "off");
    // Content that normally appears only after zooming through the letter is shown in place.
    await expect(page.getByRole("heading", { name: /A teacher, a live class/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: course.projects[0].title })).toBeVisible();
  });
});
