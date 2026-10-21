import { expect, test } from "@playwright/test";

test.describe("QuantRift landing page", () => {
  test("presents the platform positioning and primary journeys", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Agentic AI for quantitative market intelligence/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Open QuantRift/i })).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(page.getByRole("link", { name: /View source/i })).toHaveAttribute(
      "href",
      "https://github.com/waqasraza123/quantrift",
    );
    await expect(page.getByText(/No broker execution/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /An integrated quantitative research system/i })).toBeVisible();
    await expect(page).toHaveTitle(/QuantRift/i);
  });

  test("keeps the core actions visible on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "GitHub" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Open QuantRift/i })).toBeVisible();
  });
});
