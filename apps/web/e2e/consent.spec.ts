import { expect, test, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

async function signIn(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function latestMailText(to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages[0])
      return ((await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string })
        .Text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

test("a new minor gives their birth date, a parent consents by email, and then they can ask to join", async ({
  page,
}, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const student = `minor-${stamp}@school.edu`;
  const parent = `parent-${stamp}@example.com`;
  const password = "A-strong-passw0rd";

  // An admin adds the student; the student sets a password from the invite.
  await signIn(page, "admin@school.edu", "Password123!");
  await expect(page).toHaveURL(/\/dashboard$/);
  const added = await page.request.post("/api/v1/admin/users", {
    data: { users: [{ email: student, name: "Isha Menon", role: "STUDENT" }] },
  });
  expect(added.ok()).toBe(true);
  await page.context().clearCookies();
  await page.goto((await latestMailText(student)).match(/https?:\/\/\S+/)![0]);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(password);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();

  // First sign-in: the app asks for a date of birth before anything else.
  await signIn(page, student, password);
  await expect(page).toHaveURL(/\/welcome$/);
  await page.goto("/courses");
  await expect(page).toHaveURL(/\/welcome$/); // every app page sends them back
  await page.getByLabel("Date of birth").fill("2013-05-05");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/courses/);

  // Under 18: browsing works, joining doesn't.
  await expect(page.getByRole("heading", { name: "A parent needs to approve your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find a course" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ask to join/ })).toHaveCount(0);
  await page.getByLabel("Parent's or guardian's email").fill(parent);
  await page.getByRole("button", { name: "Send approval link" }).click();
  await expect(page.getByText(`We emailed ${parent}`)).toBeVisible();

  // The parent opens the link (no account needed), reads the notice and consents.
  const mail = await latestMailText(parent);
  expect(mail).toContain("Isha Menon gave your email address");
  await page.context().clearCookies();
  await page.goto(mail.match(/https?:\/\/\S+\/consent\/\S+/)![0]);
  await expect(page.getByRole("heading", { name: "Approve Isha Menon's account" })).toBeVisible();
  await expect(page.getByText("What the school keeps, and why")).toBeVisible();
  await page.getByRole("button", { name: "Give consent" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Your full name").fill("Lakshmi Menon");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent" }).click();
  await expect(page.getByText("Thank you. Isha Menon can now join their courses.")).toBeVisible();

  // Back as the student: the panel is gone and they can ask to join.
  await signIn(page, student, password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "A parent needs to approve your account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Ask to join/ }).first()).toBeVisible();
});
