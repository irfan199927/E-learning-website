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

test("the teacher's bell shows a join request; opening it marks it read and goes to the request", async ({
  page,
}, info) => {
  const title = `Chemistry ${info.project.name} ${Date.now()}`;

  await signIn(page, "teacher@school.edu");
  await page.goto("/courses/new");
  await page.getByLabel("Course title").fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await signIn(page, "kabir@school.edu");
  await page.goto(`/courses?q=${encodeURIComponent(title)}`);
  await page.getByRole("button", { name: `Ask to join ${title}` }).click();
  await expect(
    page.getByRole("article").filter({ hasText: title }).getByText("Request sent. Waiting for your teacher."),
  ).toBeVisible();

  // Other tests notify this teacher too, so only check that something is unread, then find this one.
  await signIn(page, "teacher@school.edu");
  await page.getByRole("link", { name: /^Notifications, \d+ unread$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  const item = page.getByRole("button", { name: new RegExp(`Kabir Rao asked to join ${title}`) });
  await expect(item).toContainText("(unread)");
  await item.click();
  await expect(page).toHaveURL(/\/courses\/[^/]+#join-requests$/);
  await expect(page.getByRole("button", { name: "Approve Kabir Rao" })).toBeVisible();

  await page.goto("/notifications");
  await expect(
    page.getByRole("button", { name: new RegExp(`Kabir Rao asked to join ${title}`) }),
  ).not.toContainText("(unread)");
  // Mark all as read leaves nothing unread on the page.
  const markAll = page.getByRole("button", { name: "Mark all as read" });
  if (await markAll.isVisible()) {
    await markAll.click();
    await expect(page.locator("li", { hasText: "(unread)" })).toHaveCount(0);
  }
  // The bell keeps itself up to date from this endpoint.
  const count = await page.request.get("/api/v1/notifications/unread-count");
  expect(count.status()).toBe(200);
  expect(typeof ((await count.json()) as { data: { unread: number } }).data.unread).toBe("number");
});
