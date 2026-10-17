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

test("a teacher creates a course, a new student asks to join, and the course opens after approval", async ({
  page,
}, info) => {
  const title = `Robotics ${info.project.name} ${Date.now()}`;

  await signIn(page, "teacher@school.edu");
  await page.goto("/courses");
  await page.getByRole("link", { name: "New course" }).click();
  await page.getByLabel("Course title").fill(title);
  await page.getByLabel("Class or grade (optional)").fill("8");
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("No one is waiting to join.")).toBeVisible();
  const courseUrl = page.url();

  // Kabir starts outside every course here (like a fresh Google sign-up).
  await signIn(page, "kabir@school.edu");
  await page.goto("/courses");
  // The catalog search finds it (long catalogs show only the first courses alphabetically).
  await page.getByRole("searchbox", { name: "Search courses" }).fill(title);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/[?&]q=/);
  await page.getByRole("button", { name: `Ask to join ${title}` }).click();
  // Scoped to this course: Kabir may have other pending requests (other runs, the other device project).
  await expect(
    page.getByRole("article").filter({ hasText: title }).getByText("Request sent. Waiting for your teacher."),
  ).toBeVisible();
  // The course itself stays closed until approval.
  const closed = await page.goto(courseUrl);
  expect(closed?.status()).toBe(404);

  await signIn(page, "teacher@school.edu");
  await page.goto("/courses");
  await page
    .getByRole("article")
    .filter({ hasText: title })
    .getByRole("link", { name: "1 student waiting to join" })
    .click();
  await page.getByRole("button", { name: "Approve Kabir Rao" }).click();
  await expect(page.getByText("Kabir Rao can now open this course.")).toBeVisible();

  await signIn(page, "kabir@school.edu");
  await page.goto(courseUrl);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
