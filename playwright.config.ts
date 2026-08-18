import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for ContentX end-to-end tests.
 *
 * The tests start the contentx Vite dev server on a dedicated port (5174)
 * and intercept every /api/v1/... request with page.route() mocks so the
 * LLM-backed backend is never called.
 */
export default defineConfig({
  testDir: "artifacts/contentx/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the nix-installed Chromium which bundles all its own system deps.
        // The Playwright-downloaded headless shell requires glib/dbus/X11 libs
        // not available in this environment; the nix build is self-contained.
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            || `${process.env.HOME}/.nix-profile/bin/chromium`,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
  webServer: {
    command: "PORT=5174 BASE_PATH=/ pnpm --filter @workspace/contentx run dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      PORT: "5174",
      BASE_PATH: "/",
      NODE_ENV: "test",
    },
  },
});
