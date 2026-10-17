import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password123!";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Signs in and waits for the dashboard, unless the sign-in is expected to fail. */
async function signIn(page: Page, email: string, password = PASSWORD, { expectOk = true } = {}) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (expectOk) await expect(page).toHaveURL(/\/dashboard$/);
}

/** Newest email to `to` in Mailpit, as plain text. */
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

test("an admin adds a teacher, who sets a password from the invite; switching them off blocks sign-in", async ({
  page,
}, info) => {
  const email = `new-teacher-${info.project.name}-${Date.now()}@school.edu`;
  await signIn(page, "admin@school.edu");
  await page.goto("/admin/users"); // the nav link is inside the closed drawer on mobile
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();

  await page.getByLabel("Full name").fill("Priya Desai");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Role", { exact: true }).first().selectOption("TEACHER");
  await page.getByRole("button", { name: "Add and email invite" }).click();
  await expect(page.getByText("Added 1 and emailed them a link to choose a password.")).toBeVisible();

  // The invite uses the welcome wording, and its link lets the new person choose a password.
  const mail = await latestMailText(email);
  expect(mail).toContain("Your school added you to E-learner");
  const link = mail.match(/https?:\/\/\S+/)![0];
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByLabel("New password", { exact: true }).fill("A-strong-passw0rd");
  await page.getByLabel("Confirm new password").fill("A-strong-passw0rd");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();
  await signIn(page, email, "A-strong-passw0rd");
  // The new account has teacher rights: the upload page is teacher/admin only.
  await page.goto("/library/upload");
  await expect(page).toHaveURL(/\/library\/upload$/); // students would be sent back to the dashboard

  // The admin switches the account off; the next sign-in fails.
  await signIn(page, "admin@school.edu");
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await page.getByRole("button", { name: "Switch off Priya Desai" }).click();
  await expect(page.getByText("Priya Desai can't sign in now.")).toBeVisible();
  await signIn(page, email, "A-strong-passw0rd", { expectOk: false });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("non-admins can't open the users page or its API", async ({ page }) => {
  await signIn(page, "teacher@school.edu");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
  const res = await page.request.get("/api/v1/admin/users");
  expect(res.status()).toBe(403);
});

test("an admin sets the daily learning goal; students see it on their Overview", async ({ page }, info) => {
  // Settings are school-wide: only one project changes them, and puts them back.
  test.skip(info.project.name !== "desktop", "school-wide setting; checked once");
  await signIn(page, "admin@school.edu");
  await page.goto("/admin/settings");
  await page.getByLabel("Daily learning goal (minutes)").fill("45");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved. Students see the new goal")).toBeVisible();

  await signIn(page, "aanya@school.edu");
  await expect(page.getByText("of 45 min")).toBeVisible();
  await expect(page.getByText("Questions answered")).toBeVisible();

  await signIn(page, "admin@school.edu");
  await page.goto("/admin/settings");
  await page.getByLabel("Daily learning goal (minutes)").fill("30");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved. Students see the new goal")).toBeVisible();
});
