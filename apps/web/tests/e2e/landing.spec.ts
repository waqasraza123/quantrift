import { expect, test } from "@playwright/test";

test.describe("QuantRift landing page", () => {
  test("presents the platform positioning and primary journeys", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /AI Agents for your trading research\./i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your account/i })).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(page.getByRole("link", { name: /Try the chart preview/i })).toHaveAttribute("href", "#product-preview");
    await expect(page.getByText("Market research and conditional paper setups. Not financial advice.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Find what matters. Review it in one place./i })).toBeVisible();
    await expect(page).toHaveTitle(/QuantRift/i);
  });

  test("keeps the core actions visible on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your account/i })).toBeVisible();
  });
});
