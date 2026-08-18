/**
 * E2E: Synthesize Mode regression
 *
 * Verifies that the existing Synthesize Mode flow was not broken by the
 * introduction of Bridge Mode.  Covers:
 *  1. Entering Synthesize Mode
 *  2. Selecting two scenarios
 *  3. Choosing elements for each in the Synthesis Panel
 *  4. Running synthesis and landing on the SCENARIO DRAFT step
 *  5. Saving to library — SYNTHESIZED badge appears in Scenario Library
 *
 * All /api/v1/... requests are intercepted with deterministic mock data.
 */

import { test, expect, Page } from "@playwright/test";
import {
  SEED_SCENARIOS,
  SCENARIO_A,
  SCENARIO_B,
  SYNTHESIS_RESPONSE,
  SAVED_SYNTHESIS_SCENARIO,
  EMPTY_SUMMARY,
  EMPTY_CATEGORIES,
  EMPTY_CONTENT,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function registerBaseMocks(page: Page) {
  await page.route("**/api/v1/dashboard/summary", (route) =>
    route.fulfill({ json: EMPTY_SUMMARY })
  );
  await page.route("**/api/v1/content", (route, request) => {
    if (request.method() === "GET") return route.fulfill({ json: EMPTY_CONTENT });
    return route.continue();
  });
  await page.route("**/api/v1/categories", (route) =>
    route.fulfill({ json: EMPTY_CATEGORIES })
  );
  await page.route("**/api/v1/scenarios", (route, request) => {
    if (request.method() === "GET") return route.fulfill({ json: SEED_SCENARIOS });
    return route.continue();
  });
  // Similar scenarios (shown on the SCENARIO DRAFT step for saved scenarios).
  // Must return an array; returning nothing causes "similar.map is not a function".
  await page.route("**/api/v1/scenarios/*/similar", (route) =>
    route.fulfill({ json: [] })
  );
}

async function registerSynthesisMocks(page: Page) {
  await page.route("**/api/v1/scenarios/synthesize", (route) =>
    route.fulfill({ status: 201, json: SYNTHESIS_RESPONSE })
  );
}

async function upgradeScenariosAfterSave(page: Page) {
  await page.unroute("**/api/v1/scenarios");
  const updatedList = [...SEED_SCENARIOS, SAVED_SYNTHESIS_SCENARIO];
  await page.route("**/api/v1/scenarios", (route, request) => {
    if (request.method() === "GET") return route.fulfill({ json: updatedList });
    if (request.method() === "POST") {
      return route.fulfill({ status: 201, json: SAVED_SYNTHESIS_SCENARIO });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Synthesize Mode regression", () => {
  test.beforeEach(async ({ page }) => {
    await registerBaseMocks(page);
    await registerSynthesisMocks(page);
  });

  test("enters Synthesize Mode and shows checkboxes", async ({ page }) => {
    await page.goto("/world");
    await page.getByRole("button", { name: /Scenario Library/ }).click();

    await expect(page.getByText(SCENARIO_A.title)).toBeVisible();
    await expect(page.getByText(SCENARIO_B.title)).toBeVisible();

    // Toggle Synthesize Mode on
    await page.getByRole("button", { name: "Synthesize Mode" }).click();

    // Checkboxes should now appear alongside each scenario
    const checkboxes = page.getByRole("checkbox");
    await expect(checkboxes.first()).toBeVisible();

    // The "Synthesize" button should be disabled (0 selected)
    await expect(
      page.getByRole("button", { name: /Synthesize \(0\)/ })
    ).toBeDisabled();
  });

  test("full Synthesize flow → save → SYNTHESIZED badge appears", async ({ page }) => {
    await page.goto("/world");
    await page.getByRole("button", { name: /Scenario Library/ }).click();

    // ── Step 1: enter Synthesize Mode ────────────────────────────────────
    await page.getByRole("button", { name: "Synthesize Mode" }).click();

    // ── Step 2: select both scenarios ────────────────────────────────────
    // Click on each scenario's row to toggle the checkbox
    await page.getByText(SCENARIO_A.title).first().click();
    await page.getByText(SCENARIO_B.title).first().click();

    // "Synthesize (2)" button should now be enabled
    const synthesizeBtn = page.getByRole("button", { name: /Synthesize \(2\)/ });
    await expect(synthesizeBtn).toBeEnabled();

    // ── Step 3: open Synthesis Panel ─────────────────────────────────────
    await synthesizeBtn.click();

    // Panel title
    await expect(page.getByText("Synthesize Scenarios")).toBeVisible();

    // Each scenario should be listed with element buttons
    await expect(page.getByText(SCENARIO_A.title).first()).toBeVisible();
    await expect(page.getByText(SCENARIO_B.title).first()).toBeVisible();

    // ── Step 4: pick elements for each scenario ───────────────────────────
    // Find the "characters" button for Scenario A (first occurrence)
    // and "setting" for Scenario B (second occurrence)
    const allCharButtons = page.getByRole("button", { name: "characters" });
    await allCharButtons.first().click();   // characters for scenario A

    const allSettingButtons = page.getByRole("button", { name: "setting" });
    await allSettingButtons.last().click();  // setting for scenario B

    // The "Run Synthesis" button should now be enabled
    const runBtn = page.getByRole("button", { name: "Run Synthesis" });
    await expect(runBtn).toBeEnabled();

    // ── Step 5: run synthesis ─────────────────────────────────────────────
    await runBtn.click();

    // We should land on SCENARIO DRAFT step.
    // Use the stepper's exact text ("2. SCENARIO DRAFT") to avoid the "Scenario Draft"
    // breadcrumb that Playwright's case-insensitive getByText would also match.
    await expect(page.getByText("2. SCENARIO DRAFT")).toBeVisible();

    // The "Candidates" bar should appear
    await expect(page.getByText("Candidates")).toBeVisible();

    // The draft content fields are rendered (title lives in a textarea/input value,
    // not as plain text, so check the "Logline" section label which is always visible).
    await expect(page.getByText("Logline")).toBeVisible();

    // ── Step 6: save to library ───────────────────────────────────────────
    await upgradeScenariosAfterSave(page);

    await page.getByRole("button", { name: "Save to Library" }).click();

    // Success toast or library tab shown
    await expect(
      page.getByText(/Scenario saved to library/i).or(page.getByText(/saved/i)).first()
    ).toBeVisible();

    // ── Step 7: SYNTHESIZED badge should appear ───────────────────────────
    // After save the component stays on the SCENARIO DRAFT step and shows
    // "SAVED IN LIBRARY". Navigate back to the library to verify the badge.
    await expect(page.getByText("SAVED IN LIBRARY")).toBeVisible();

    // Click "Back to Library / Idea" to return to the scenario list
    await page.getByRole("button", { name: /Back to Library/i }).click();

    // SCENARIOS tab is active; verify SYNTHESIZED badge
    await expect(page.getByText(/SYNTHESIZED/i).first()).toBeVisible();
  });

  test("Bridge Mode button is still present after Synthesize Mode is toggled", async ({ page }) => {
    await page.goto("/world");
    await page.getByRole("button", { name: /Scenario Library/ }).click();

    // Enable synthesize mode then disable it
    await page.getByRole("button", { name: "Synthesize Mode" }).click();
    await expect(page.getByRole("button", { name: "Cancel Synthesis" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel Synthesis" }).click();

    // Bridge Mode button should still be present
    await expect(page.getByRole("button", { name: "Bridge Mode" })).toBeVisible();
  });
});
