import { expect, test } from "@playwright/test";

test.describe("QuantRift landing page", () => {
  test("presents the platform positioning and primary journeys", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Find the signal. Review the evidence./i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Start researching/i })).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(page.getByRole("link", { name: /Explore the demo/i })).toHaveAttribute("href", "/demo");
    await expect(page.getByText(/No broker execution/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /One clear view of the market/i })).toBeVisible();
    await expect(page).toHaveTitle(/QuantRift/i);
  });

  test("keeps the core actions visible on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start researching/i })).toBeVisible();
  });
});
