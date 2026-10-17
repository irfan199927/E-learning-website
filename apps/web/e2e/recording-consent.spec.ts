import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";

test("a student reads the recording notice, agrees, and can withdraw", async ({ page }, info) => {
  // One seeded student per project, so desktop and mobile don't change each other's answer.
  const email = info.project.name === "mobile" ? "kabir@school.edu" : "rohan@school.edu";
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const banner = page.getByRole("complementary", { name: "Class recordings" });
  await page.goto("/recording-consent");
  await expect(page.getByRole("heading", { level: 1, name: "Live classes are recorded" })).toBeVisible();
  // A fresh seed leaves this student unanswered; a retry may find them agreed from the last attempt.
  const withdraw = page.getByRole("button", { name: "Withdraw my agreement" });
  if (await withdraw.isVisible()) await withdraw.click();
  else {
    await expect(page.getByText("You haven't answered yet.")).toBeVisible();
    await page.goto("/dashboard");
    await expect(banner).toBeVisible();
    await banner.getByRole("link", { name: "Read the notice" }).click();
  }

  await page.getByRole("button", { name: "I agree" }).click();
  await expect(page.getByText("Thanks. You can join live classes now.")).toBeVisible();
  await expect(page.getByText(/^You agreed on /)).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Upcoming classes" })).toBeVisible();
  await expect(banner).toHaveCount(0);

  await page.goto("/recording-consent");
  await page.getByRole("button", { name: "Withdraw my agreement" }).click();
  await expect(
    page.getByText("Withdrawn. You can't join live classes from E-learner until you agree again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "I agree" })).toBeVisible();
});
