import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password123!";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

async function signIn(page: Page, email: string, password = PASSWORD, { expectOk = true } = {}) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (expectOk) await expect(page).toHaveURL(/\/dashboard$/);
}

/** Newest email to `to` in Mailpit whose subject matches. */
async function mailText(to: string, subject: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const query = `to:"${to}" subject:"${subject}"`;
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages[0])
      return ((await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string })
        .Text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${to}`);
}

test("a student deletes their account; an admin can cancel it before the purge", async ({ page }, info) => {
  // A throwaway student, so the seeded accounts stay usable.
  const email = `leaving-${info.project.name}-${Date.now()}@school.edu`;
  const password = "A-strong-passw0rd";
  await signIn(page, "admin@school.edu");
  await page.goto("/admin/users");
  await page.getByLabel("Full name").fill("Leela Iyer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Add and email invite" }).click();
  await expect(page.getByText("Added 1 and emailed them a link to choose a password.")).toBeVisible();
  const link = (await mailText(email, "You've been added")).match(/https?:\/\/\S+/)![0];
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(password);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();

  // ── The student deletes their account from the Account page ──
  await signIn(page, email, password);
  await page.getByRole("link", { name: "Account: Leela Iyer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  const remove = page.getByRole("button", { name: "Delete my account" });
  await expect(remove).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await remove.click();
  await expect(page).toHaveURL(/\/sign-in\?deleted=1$/);
  await expect(page.getByText("Your account will be deleted.")).toBeVisible();
  expect(await mailText(email, "will be deleted")).toContain("deleted for good on");
  await signIn(page, email, password, { expectOk: false });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);

  // ── An admin cancels it; the student can sign in again ──
  await signIn(page, "admin@school.edu");
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await expect(page.getByText(/^Deleting on /)).toBeVisible();
  await page.getByRole("button", { name: "Cancel deletion of Leela Iyer" }).click();
  await expect(page.getByText("Cancelled. Leela Iyer can sign in again.")).toBeVisible();
  await signIn(page, email, password);
});

test("teachers can't delete their own account", async ({ page }) => {
  await signIn(page, "teacher@school.edu");
  await page.goto("/account");
  await expect(page.getByText("a school admin deletes these accounts")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  const res = await page.request.post("/api/v1/me/deletion-request", { data: { confirm: "DELETE" } });
  expect(res.status()).toBe(403);
});

test("anyone can switch the daily notification email off and back on", async ({ page }) => {
  await signIn(page, "parent@example.com");
  await page.goto("/account");
  const box = page.getByRole("checkbox", { name: /Daily summary of unread notifications/ });
  // Start from "on" whatever an earlier run left behind.
  if (!(await box.isChecked())) {
    await box.check();
    await expect(page.getByText("Daily summary on.")).toBeVisible();
  }
  await box.uncheck();
  await expect(page.getByText("Daily summary off.")).toBeVisible();
  await page.reload();
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(page.getByText("Daily summary on.")).toBeVisible();
});
