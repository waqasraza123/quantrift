import { expect, test } from "@playwright/test";
import { setMockApiScenario } from "./fixtures/apiMocks";

test.describe("password authentication", () => {
  test("signup waits for verified email and creates no browser session", async ({ page, request }) => {
    await setMockApiScenario(request, "auth-register-success");
    await page.goto("/register");

    await page.getByLabel("Workspace").fill("Northstar Research");
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Email address").fill("analyst@example.test");
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByText("No session was created")).not.toBeVisible();
    expect((await page.context().cookies()).find((cookie) => cookie.name === "trading_intelligence_session")).toBeUndefined();
  });

  test("unverified login offers resend and reports actual delivery", async ({ page, request }) => {
    await setMockApiScenario(request, "auth-login-unverified");
    await page.goto("/login");
    await page.getByLabel("Email address").fill("analyst@example.test");
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
    await page.getByRole("button", { name: "Sign in securely" }).click();

    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await page.getByRole("button", { name: "Resend verification" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox again" })).toBeVisible();
  });

  test("login proxy stores an HttpOnly cookie and strips the raw token", async ({ request }) => {
    await setMockApiScenario(request, "auth-login-success");
    const response = await request.post("/api/auth/login", {
      data: { email: "analyst@example.test", password: "correct horse battery staple" },
    });
    const payload = await response.json();
    const setCookie = response.headers()["set-cookie"];

    expect(response.ok()).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain("tai_session_");
    expect(payload).not.toHaveProperty("accessToken");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  test("logout revokes the server session and expires the cookie", async ({ request }) => {
    await setMockApiScenario(request, "auth-login-success");
    await request.post("/api/auth/login", {
      data: { email: "analyst@example.test", password: "correct horse battery staple" },
    });
    const response = await request.post("/api/auth/logout", { data: {} });
    const setCookie = response.headers()["set-cookie"];

    expect(response.ok()).toBeTruthy();
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
  });

  test("verification renders the success state", async ({ page }) => {
    await page.goto("/verify-email?token=valid-verification-token-e2e");
    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to sign in" })).toBeVisible();
  });

  test("verification renders the expired state with recovery", async ({ page }) => {
    await page.goto("/verify-email?token=expired-token-value-for-e2e");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new link" })).toBeDisabled();
  });

  test("verification renders the invalid state", async ({ page }) => {
    await page.goto("/verify-email?token=invalid-token-value-for-e2e");
    await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
  });

  test("auth failures and field controls remain accessible on mobile", async ({ page, request }) => {
    await setMockApiScenario(request, "auth-login-failure");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByLabel("Email address").fill("analyst@example.test");
    await page.getByLabel("Password", { exact: true }).fill("incorrect password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Credentials are invalid" })).toBeVisible();
  });

  test("signup delivery failure never presents a sent state", async ({ page, request }) => {
    await setMockApiScenario(request, "auth-register-failure");
    await page.goto("/register");
    await page.getByLabel("Workspace").fill("Northstar Research");
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Email address").fill("analyst@example.test");
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("heading", { name: "Your account is waiting" })).toBeVisible();
    await expect(page.getByText("could not deliver", { exact: false })).toBeVisible();
    await expect(page.getByText("Email sent")).not.toBeVisible();
  });
});
