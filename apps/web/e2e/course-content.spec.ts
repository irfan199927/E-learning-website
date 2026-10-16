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

test("a teacher builds a course from modules and lessons, and a student works through it", async ({
  page,
}, info) => {
  const title = `Geometry ${info.project.name} ${Date.now()}`;

  // ── Teacher: create the course, then edit it ──
  await signIn(page, "teacher@school.edu");
  await page.goto("/courses/new");
  await page.getByLabel("Course title").fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const courseUrl = page.url();
  await page.getByRole("link", { name: "Edit course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Edit ${title}` })).toBeVisible();

  await page.getByLabel("New module").fill("Week 1");
  await page.getByRole("button", { name: "Add module" }).click();
  const week = page.getByRole("region", { name: "Week 1" });
  await expect(week).toBeVisible();

  // A reading…
  await week.getByRole("button", { name: "Add a lesson to Week 1" }).click();
  await week.getByLabel("Title").fill("Welcome");
  await week.getByLabel("Text").fill("Angles add up to 180° in a triangle.");
  await week.getByRole("button", { name: "Add lesson", exact: true }).click();
  await expect(week.getByRole("link", { name: "Welcome" })).toBeVisible();

  // …a link (hidden later)…
  await week.getByRole("button", { name: "Add a lesson to Week 1" }).click();
  await week.getByRole("radio", { name: "Link" }).check();
  await week.getByLabel("Title").fill("Protractor tool");
  await week.getByLabel("Web address").fill("https://example.org/protractor");
  await week.getByRole("button", { name: "Add lesson", exact: true }).click();
  await expect(week.getByRole("link", { name: "Protractor tool" })).toBeVisible();

  // …and a file lesson, which opens its editor to attach files.
  await week.getByRole("button", { name: "Add a lesson to Week 1" }).click();
  await week.getByRole("radio", { name: "Files" }).check();
  await week.getByLabel("Title").fill("Worksheet");
  await week.getByRole("button", { name: "Add lesson", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Worksheet" })).toBeVisible();
  await page.getByLabel("Add files").setInputFiles({
    name: "angles.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e worksheet\n"),
  });
  await expect(page.getByText("File added.")).toBeVisible();
  await expect(page.getByRole("link", { name: "angles.pdf" })).toBeVisible();

  // Reorder and hide.
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await week.getByRole("button", { name: "Move Worksheet up" }).click();
  await expect(week.getByRole("listitem").nth(1)).toContainText("Worksheet");
  await week.getByRole("button", { name: "Hide Protractor tool from students" }).click();
  await expect(week.getByRole("button", { name: "Show Protractor tool to students" })).toBeVisible();

  // ── A student joins (Kabir is an adult with no courses) ──
  await signIn(page, "kabir@school.edu");
  await page.goto("/courses");
  await page.getByRole("button", { name: `Ask to join ${title}` }).click();
  await expect(
    page.getByRole("article").filter({ hasText: title }).getByText("Request sent. Waiting for your teacher."),
  ).toBeVisible();
  await signIn(page, "teacher@school.edu");
  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Approve Kabir Rao" }).click();
  await expect(page.getByText("Kabir Rao can now open this course.")).toBeVisible();

  // ── Student: lessons in order, without the hidden one ──
  await signIn(page, "kabir@school.edu");
  await page.goto(courseUrl);
  const lessons = page.getByRole("region", { name: "Lessons" }).getByRole("listitem");
  await expect(lessons).toHaveCount(2);
  await expect(lessons.nth(0)).toContainText("Welcome");
  await expect(lessons.nth(1)).toContainText("Worksheet");
  await expect(page.getByText("0/2 lessons completed")).toBeVisible();

  await lessons.nth(0).getByRole("link").click();
  await expect(page.getByText("Angles add up to 180° in a triangle.")).toBeVisible();
  await expect(page.getByText("Week 1 · Lesson 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByRole("button", { name: "Done · undo" })).toBeVisible();

  await page.getByRole("link", { name: "Next: Worksheet" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /angles\.pdf/ }).click();
  expect((await download).suggestedFilename()).toBe("angles.pdf");

  await page.goto(courseUrl);
  await expect(page.getByText("1/2 lessons completed")).toBeVisible();
});
