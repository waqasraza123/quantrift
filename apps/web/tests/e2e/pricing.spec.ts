import { expect, test } from "@playwright/test";

test("pricing explains the plans and preserves the Team choice through signup", async ({ page }) => {
  await page.goto("/pricing");
  const cards = page.locator(".pricing-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(1)).toContainText("$29");
  await expect(cards.nth(1)).toContainText("100 AI credits per month");
  await expect(cards.nth(2)).toContainText("$79");
  await expect(cards.nth(2)).toContainText("Up to 5 members");
  await expect(page.getByRole("link", { name: /Choose Team/ })).toHaveAttribute("href", "/register?next=%2Fbilling%3Fplan%3Dteam");
  await expect(page.getByText(/Paid checkout is not available yet/)).toBeVisible();
});

test("pricing remains readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  const cards = page.locator(".pricing-card");
  await expect(cards).toHaveCount(3);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
});

test("billing requires an explicit checkout action and shows a recoverable failure", async ({ page }) => {
  let checkoutRequests = 0;
  await page.route("**/billing/workspace", (route) => route.fulfill({ json: {
    workspaceId: "11111111-1111-4111-8111-111111111111", plan: "free", status: "free",
    subscriptionStatus: null, credits: 0, used: 0, reserved: 0, remaining: 0, members: 1,
    periodStart: null, periodEnd: null, transitionEndsAt: null, cancelAtPeriodEnd: false,
    canManage: true, checkoutEnabled: true, portalEnabled: false, aiConfigured: true,
    enforcementEnabled: true, syncPending: false,
  } }));
  await page.route("**/billing/plans", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ json: { ...catalog, checkoutEnabled: true } });
  });
  await page.route("**/api/backend/billing/checkout", async (route) => {
    checkoutRequests += 1;
    expect(route.request().postDataJSON().plan).toBe("pro");
    await route.fulfill({ status: 503, json: { error: { code: "stripe_unavailable", message: "Stripe is unavailable. Please try again." } } });
  });
  await page.goto("/billing?plan=pro");
  const checkout = page.getByRole("button", { name: "Choose Pro" });
  await expect(checkout).toBeEnabled();
  expect(checkoutRequests).toBe(0);
  await checkout.click();
  await expect(page.getByRole("alert")).toContainText("Stripe is unavailable");
  expect(checkoutRequests).toBe(1);
  await expect(checkout).toBeEnabled();
});
