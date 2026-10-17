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

test("an admin sets UPI details and a price; a student pays by UPI; the admin approves and the course opens", async ({
  page,
}, info) => {
  const title = `Music ${info.project.name} ${Date.now()}`;
  const utr = String(Date.now()).slice(-12).padStart(12, "4");

  await signIn(page, "teacher@school.edu");
  await page.goto("/courses/new");
  await page.getByLabel("Course title").fill(title);
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const courseUrl = page.url();

  // ── Admin: where to pay, and the price ──
  await signIn(page, "admin@school.edu");
  await page.goto("/admin/payments");
  await page.getByLabel("UPI ID").fill("school@okaxis");
  await page.getByLabel("Name students will see").fill("Sunrise School");
  await page.getByRole("button", { name: "Save UPI details" }).click();
  await expect(page.getByText("Saved. Students see these details")).toBeVisible();
  await page.goto(`${courseUrl}/edit`);
  await page.getByLabel("Price in rupees (0 = free)").fill("1500");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByText("Saved. Students now pay to join this course.")).toBeVisible();

  // ── Student: pay and report the UTR ──
  await signIn(page, "kabir@school.edu");
  await page.goto(`/courses?q=${encodeURIComponent(title)}`);
  const card = page.getByRole("article").filter({ hasText: title });
  await expect(card).toContainText("₹1,500");
  await card.getByRole("link", { name: /Pay and join/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("school@okaxis")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my UPI app" })).toHaveAttribute(
    "href",
    /^upi:\/\/pay\?pa=school%40okaxis/,
  );
  await page.getByLabel("UPI reference (UTR)").fill(utr);
  await page.getByRole("button", { name: "I've paid: send for checking" }).click();
  await expect(page.getByText(/Payment reported on/)).toBeVisible();
  expect((await page.goto(courseUrl))?.status()).toBe(404); // not yet

  // ── Admin: approve ──
  await signIn(page, "admin@school.edu");
  await page.goto("/admin/payments");
  const row = page.getByRole("listitem").filter({ hasText: utr });
  await expect(row).toContainText(title);
  await row.getByRole("button", { name: "Approve payment from Kabir Rao" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: utr })).toHaveCount(0);

  // ── Student: the course is open ──
  await signIn(page, "kabir@school.edu");
  await page.goto(courseUrl);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
