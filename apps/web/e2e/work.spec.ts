import { readFile } from "node:fs/promises";
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

async function openMaths(page: Page) {
  await page.goto("/courses");
  await page
    .getByRole("link", { name: /Mathematics · Grade 9-A/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Mathematics · Grade 9-A" })).toBeVisible();
}

test("a teacher sets an assignment and a quiz; the student does both; grades reach the parent", async ({
  page,
}, info) => {
  const tag = `${info.project.name} ${Date.now()}`;
  const essay = `Essay ${tag}`;
  const quiz = `Quiz ${tag}`;

  // ── Teacher: an assignment and a one-question quiz ──
  await signIn(page, "teacher@school.edu");
  await openMaths(page);
  await page.getByRole("link", { name: "New assignment" }).click();
  await page.getByLabel("Title").fill(essay);
  await page.getByLabel("Instructions").fill("Explain the quadratic formula in your own words.");
  await page.getByLabel("Points").fill("20");
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(page.getByRole("heading", { level: 1, name: essay })).toBeVisible();
  const essayUrl = page.url();

  await openMaths(page);
  await page.getByRole("link", { name: "New quiz" }).click();
  await page.getByLabel("Title").fill(quiz);
  await page.getByLabel("Question", { exact: true }).fill("What is 2 + 2?");
  await page.getByLabel("Question 1, option 1").fill("4");
  await page.getByLabel("Question 1, option 2").fill("5");
  await page.getByLabel("Option 1 is correct").check();
  await page.getByLabel("Visible to students").check();
  await page.getByRole("button", { name: "Create quiz" }).click();
  await expect(page.getByRole("heading", { level: 1, name: quiz })).toBeVisible();
  const quizUrl = page.url();

  // ── Student: hand in, then take the quiz ──
  await signIn(page, "aanya@school.edu");
  await openMaths(page);
  await page
    .getByRole("region", { name: "Assignments" })
    .getByRole("link", { name: new RegExp(essay) })
    .click();
  await page.getByLabel("Your answer").fill("It gives the roots of ax² + bx + c = 0.");
  await page.getByRole("button", { name: "Hand in", exact: true }).click();
  await expect(page.getByText("Handed in. Your teacher will grade it.")).toBeVisible();

  await page.goto(quizUrl);
  await page.getByRole("button", { name: "Start quiz" }).click();
  await page.getByRole("radio", { name: "4" }).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("heading", { name: "Your score: 1/1" })).toBeVisible();
  await expect(page.getByText("You've used all your attempts.")).toBeVisible();

  // ── Teacher: grade ──
  await signIn(page, "teacher@school.edu");
  await page.goto(essayUrl);
  const grade = page.getByRole("form", { name: "Grade Aanya Sharma" });
  await grade.getByLabel("Score (out of 20)").fill("18");
  await grade.getByLabel("Feedback (optional)").fill("Clear and correct.");
  await grade.getByRole("button", { name: "Save grade" }).click();
  await expect(page.getByText("Saved. Aanya Sharma can see the grade now.")).toBeVisible();
  await page.goto(quizUrl);
  await expect(page.getByRole("row").filter({ hasText: "Aanya Sharma" })).toContainText("1/1");

  // ── Teacher: the gradebook, and its CSV ──
  await openMaths(page);
  await page.getByRole("link", { name: "Gradebook" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Gradebook" })).toBeVisible();
  const headers = await page.getByRole("columnheader").allTextContents();
  const col = (title: string) => headers.findIndex((h) => h.includes(title)) - 1; // minus "Student"
  const aanya = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Aanya Sharma" }) });
  await expect(aanya.getByRole("cell").nth(col(essay))).toHaveText("18");
  await expect(aanya.getByRole("cell").nth(col(quiz))).toHaveText("1");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^grades-Mathematics-Grade-9-A-.*\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain(`${essay} (assignment, out of 20)`);
  expect(csv).toMatch(/Aanya Sharma,aanya@school\.edu,/);
  // Weighting by category is saved and explained.
  await page.getByLabel("By category").check();
  await page.getByLabel("Assignments", { exact: true }).fill("70");
  await page.getByRole("button", { name: "Save weighting" }).click();
  await expect(page.getByText("Saved. Totals use the new weighting.")).toBeVisible();
  await expect(page.getByText("Weighted: assignments 70%, quizzes 30%.")).toBeVisible();
  await page.getByLabel("By points (every point counts the same)").check();
  await page.getByRole("button", { name: "Save weighting" }).click();
  await expect(page.getByText("Weighted by points.")).toBeVisible();

  // ── Student sees the grade; the parent sees both ──
  await signIn(page, "aanya@school.edu");
  await page.goto(essayUrl);
  await expect(page.getByText("18/20")).toBeVisible();
  await expect(page.getByText("Clear and correct.")).toBeVisible();
  await openMaths(page);
  await page.getByRole("link", { name: "My grades" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My grades" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(essay) })).toContainText("18/20");
  await expect(page.getByRole("link", { name: new RegExp(quiz) })).toContainText("1/1");

  await signIn(page, "parent@example.com");
  await page.getByRole("link", { name: "See Aanya Sharma's progress" }).click();
  const grades = page.getByRole("region", { name: "Grades" });
  await expect(grades.getByRole("row").filter({ hasText: essay })).toContainText("18/20");
  await expect(grades.getByRole("row").filter({ hasText: quiz })).toContainText("1/1");
});
