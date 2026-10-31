import { expect, test } from "@playwright/test";
import { setMockApiScenario } from "./fixtures/apiMocks";

test("terminal controls open accessible dialogs and retain the selected timeframe", async ({
  page,
  request,
}) => {
  await setMockApiScenario(request, "ready-overview");
  await page.goto("/terminal");
  await expect(
    page.getByRole("toolbar", { name: "Chart controls" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Indicators", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Indicators & chart settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "4h", exact: true }).click();
  await expect(page).toHaveURL(/timeframe=4h/);
  await page.keyboard.press("/");
  await expect(
    page.getByRole("dialog", { name: "Search markets" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("terminal saves theme preferences without changing public pages", async ({
  page,
  request,
}) => {
  await setMockApiScenario(request, "ready-overview");
  await page.goto("/terminal");
  const terminal = page.locator(".qt-terminal");
  await expect(terminal).toHaveAttribute("data-terminal-theme", "dark");
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await expect(terminal).toHaveAttribute("data-terminal-theme", "light");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(localStorage).some(
          ([key, value]) =>
            key.startsWith("quantrift:terminal:v1:") &&
            value.includes('"theme":"light"'),
        ),
      ),
    )
    .toBeTruthy();
  await page.reload();
  await expect(terminal).toHaveAttribute("data-terminal-theme", "light");
});
