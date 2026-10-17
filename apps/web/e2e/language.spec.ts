import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";

test.describe("a Marathi browser", () => {
  test.use({ locale: "mr-IN" });

  test("gets the sign-in page in Marathi", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await expect(page.locator("html")).toHaveAttribute("lang", "mr");
    await expect(page.getByRole("heading", { name: "साइन इन" })).toBeVisible();
    await expect(page.getByLabel("भाषा")).toHaveValue("mr");
  });
});

test("a student switches the interface to Hindi and back", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("rohan@school.edu");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/account");
  await page.getByLabel("Language").selectOption("hi");
  await expect(page.getByRole("heading", { name: "खाता", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("#main-nav")).toContainText("अवलोकन"); // hidden in the mobile drawer

  // The choice sticks across pages, and screens not translated yet still work (in English).
  await page.goto("/courses");
  await expect(page.locator("#main-nav")).toContainText("मेरे कोर्स");

  await page.goto("/account");
  await page.getByLabel("भाषा").selectOption("en");
  await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
