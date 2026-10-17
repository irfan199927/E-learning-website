import { expect, test } from "@playwright/test";

test("the app is installable and has an offline page", async ({ page }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const m = (await manifest.json()) as { start_url: string; display: string; icons: { src: string }[] };
  expect(m).toMatchObject({ start_url: "/dashboard", display: "standalone" });
  for (const icon of m.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  const sw = await page.request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toBe("no-cache");

  await page.goto("/sign-in");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  // The service worker installs and caches the offline page…
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // A worker controls pages loaded after it activates.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  // It cached the offline page at install. (Playwright's offline mode doesn't reach a service worker's own
  // requests, so the network-failure fallback itself can't be simulated here.)
  const cached = await page.evaluate(async () =>
    (await (await caches.open("elearner-v1")).keys()).map((r) => new URL(r.url).pathname),
  );
  expect(cached).toContain("/offline");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});
