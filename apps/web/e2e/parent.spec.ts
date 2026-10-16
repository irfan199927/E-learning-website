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

test("a parent sees their child's progress, read-only", async ({ page }) => {
  await signIn(page, "parent@example.com");
  const children = page.getByRole("region", { name: "Your children" });
  await expect(children.getByRole("heading", { name: "Aanya Sharma" })).toBeVisible();
  await children.getByRole("link", { name: "See Aanya Sharma's progress" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Aanya Sharma" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Courses \(\d+\)$/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Mathematics · Grade 9-A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Live classes, last 30 days$/ })).toBeVisible();
  // Nothing to click that changes anything: no join, lesson or edit links.
  await expect(page.getByRole("button", { name: /join/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /lesson|edit/i })).toHaveCount(0);

  // A parent can't open a child who isn't theirs (any id is a plain 404).
  const res = await page.goto("/children/not-my-child");
  expect(res?.status()).toBe(404);
  await page.goto("/children");
  await expect(page.getByRole("heading", { level: 1, name: "My children" })).toBeVisible();
});

test("an admin links a student to a parent, and the parent sees them at once", async ({ page }, info) => {
  const name = `Ishaan ${info.project.name} ${Date.now()}`;
  const email = `ishaan-${info.project.name}-${Date.now()}@school.edu`;

  await signIn(page, "admin@school.edu");
  await page.goto("/admin/users");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Add and email invite" }).click();
  await expect(page.getByText("Added 1 and emailed them a link to choose a password.")).toBeVisible();

  await page.goto(`/admin/users?q=${encodeURIComponent("parent@example.com")}`);
  await page.getByRole("button", { name: "Link a student to Sunita Sharma" }).click();
  await page.getByLabel("Student's email").fill(email);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByText(`Linked ${email}. Sunita Sharma can now see their progress.`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Unlink ${name} from Sunita Sharma` })).toBeVisible();

  await signIn(page, "parent@example.com");
  await page.goto("/children");
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Unlinking hides the student again.
  await signIn(page, "admin@school.edu");
  await page.goto(`/admin/users?q=${encodeURIComponent("parent@example.com")}`);
  await page.getByRole("button", { name: `Unlink ${name} from Sunita Sharma` }).click();
  await expect(page.getByText(`Sunita Sharma no longer sees ${name}.`)).toBeVisible();
  await signIn(page, "parent@example.com");
  await page.goto("/children");
  await expect(page.getByRole("heading", { name: "Aanya Sharma" })).toBeVisible();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
});
