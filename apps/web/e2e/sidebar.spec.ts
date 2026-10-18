import { expect, test } from "@playwright/test";

test("the desktop sidebar collapses to icons, stays collapsed after a reload, and expands again", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "Phones use the drawer; collapsing is desktop only.");
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@school.edu");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole("navigation", { name: "Main" });
  const users = nav.getByRole("link", { name: "Users", exact: true });
  const wide = (await nav.boundingBox())!.width;

  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(nav.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await nav.boundingBox())!.width).toBeLessThan(wide / 2);
  // Labels are hidden visually but still name the links.
  await expect(users).toBeVisible();
  await expect(users).toHaveAttribute("title", "Users");

  await page.reload();
  await expect(nav.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await users.click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  await nav.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => (await nav.boundingBox())!.width).toBeGreaterThan(wide - 2);
});
