/**
 * E2E: Bridge Story full flow
 *
 * Covers:
 *  1. Entering Bridge Mode from the Scenario Library
 *  2. Selecting Source A and Target B
 *  3. Opening the Bridge Panel and running the connection analysis
 *  4. Generating the bridge story
 *  5. Saving the bridge to the library
 *  6. Verifying the BRIDGE badge appears in the Scenario Library
 *  7. Verifying the Lineage tab shows the bridge under both parent nodes
 *     with the correct bridge badge and role labels (bridged from A / bridged into B)
 *
 * All /api/v1/... requests are intercepted and answered with deterministic
 * mock data — no LLM calls are made.
 */

import { test, expect, Page, Route } from "@playwright/test";
import {
  SEED_SCENARIOS,
  SCENARIO_A,
  SCENARIO_B,
  BRIDGE_ANALYSIS_RESPONSE,
  BRIDGE_GENERATE_RESPONSE,
  SAVED_BRIDGE_SCENARIO,
  SCENARIOS_WITH_BRIDGE,
  EMPTY_SUMMARY,
  EMPTY_CATEGORIES,
  EMPTY_CONTENT,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

/** Register all baseline API mocks that every test needs on page load. */
async function registerBaseMocks(page: Page) {
  // Dashboard summary
  await page.route("**/api/v1/dashboard/summary", (route) =>
    route.fulfill({ json: EMPTY_SUMMARY })
  );

  // Content library
  await page.route("**/api/v1/content", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ json: EMPTY_CONTENT });
    }
    return route.continue();
  });

  // Categories
  await page.route("**/api/v1/categories", (route) =>
    route.fulfill({ json: EMPTY_CATEGORIES })
  );

  // Similar scenarios (shown on the SCENARIO DRAFT step for saved scenarios).
  // Must return an array; returning nothing causes "similar.map is not a function".
  await page.route("**/api/v1/scenarios/*/similar", (route) =>
    route.fulfill({ json: [] })
  );
}

/** Register the initial scenario list (two seed scenarios). */
async function registerScenarioList(page: Page, scenarios = SEED_SCENARIOS) {
  await page.route("**/api/v1/scenarios", (route, request) => {
    const method = request.method();
    if (method === "GET") {
      return route.fulfill({ json: scenarios });
    }
    // Let POST (create) through to be handled by a more specific mock
    return route.continue();
  });
}

/**
 * Replace the GET /api/v1/scenarios mock with one that returns the post-save
 * list. Call this right before the "Save to Library" click.
 */
async function upgradeScenarioListMock(page: Page, scenarios = SCENARIOS_WITH_BRIDGE) {
  // Unroute old handler and attach a fresh one that returns the updated list
  await page.unroute("**/api/v1/scenarios");
  await page.route("**/api/v1/scenarios", (route, request) => {
    if (request.method() === "GET") {
      return route.fulfill({ json: scenarios });
    }
    if (request.method() === "POST") {
      return route.fulfill({ status: 201, json: SAVED_BRIDGE_SCENARIO });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Test: full Bridge Mode flow
// ---------------------------------------------------------------------------

test.describe("Bridge Story flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerBaseMocks(page);
    await registerScenarioList(page);
  });

  test("enters Bridge Mode and shows A/B markers on selected scenarios", async ({ page }) => {
    await page.goto("/world");

    // Switch to Scenario Library tab
    await page.getByRole("button", { name: /Scenario Library/ }).click();

    // Scenarios should appear
    await expect(page.getByText(SCENARIO_A.title)).toBeVisible();
    await expect(page.getByText(SCENARIO_B.title)).toBeVisible();

    // Enter Bridge Mode
    await page.getByRole("button", { name: "Bridge Mode" }).click();

    // Click Scenario A — it becomes Source A
    await page.getByText(SCENARIO_A.title).first().click();
    await expect(page.getByText("A").first()).toBeVisible();

    // Click Scenario B — it becomes Target B
    await page.getByText(SCENARIO_B.title).first().click();
    await expect(page.getByText("B").first()).toBeVisible();

    // The "Analyze Connection" button in the filter bar should now be enabled
    const analyzeBtn = page.getByRole("button", { name: "Analyze Connection" }).first();
    await expect(analyzeBtn).toBeEnabled();
  });

  test("full Bridge Mode → generate → save → BRIDGE badge appears", async ({ page }) => {
    // Register bridge-specific API mocks BEFORE navigation
    await page.route("**/api/v1/scenarios/bridge/analyze", (route) =>
      route.fulfill({ json: BRIDGE_ANALYSIS_RESPONSE })
    );
    await page.route("**/api/v1/scenarios/bridge", (route) =>
      route.fulfill({ status: 201, json: BRIDGE_GENERATE_RESPONSE })
    );

    await page.goto("/world");

    // ── Step 1: open Scenario Library ────────────────────────────────────
    await page.getByRole("button", { name: /Scenario Library/ }).click();
    await expect(page.getByText(SCENARIO_A.title)).toBeVisible();
    await expect(page.getByText(SCENARIO_B.title)).toBeVisible();

    // ── Step 2: activate Bridge Mode ─────────────────────────────────────
    await page.getByRole("button", { name: "Bridge Mode" }).click();

    // ── Step 3: select A then B ───────────────────────────────────────────
    // Click on scenario A card (any visible element with the title)
    await page.getByText(SCENARIO_A.title).first().click();
    // Click on scenario B card
    await page.getByText(SCENARIO_B.title).first().click();

    // ── Step 4: open the Bridge Panel ────────────────────────────────────
    const filterBarAnalyzeBtn = page.getByRole("button", { name: "Analyze Connection" }).first();
    await expect(filterBarAnalyzeBtn).toBeEnabled();
    await filterBarAnalyzeBtn.click();

    // Bridge panel overlay should appear
    await expect(page.getByText("Bridge Story").first()).toBeVisible();
    await expect(page.getByText(/Source A/)).toBeVisible();
    await expect(page.getByText(/Target B/)).toBeVisible();
    await expect(page.getByText(SCENARIO_A.title).first()).toBeVisible();
    await expect(page.getByText(SCENARIO_B.title).first()).toBeVisible();

    // ── Step 5: run connection analysis ──────────────────────────────────
    // The panel has an "Analyze Connection" button
    const panelAnalyzeBtn = page.getByRole("button", { name: "Analyze Connection" }).last();
    await panelAnalyzeBtn.click();

    // Analysis summary and gap dimensions should appear
    await expect(page.getByText(BRIDGE_ANALYSIS_RESPONSE.summary)).toBeVisible();
    await expect(page.getByText("timeline", { exact: false })).toBeVisible();

    // Requirements textarea should be pre-filled.
    // Navigate from the label up one level (div.space-y-2) then find the textarea
    // within that div — avoids matching outer ancestor divs and the idea textarea.
    const reqLabel = page.locator("label", { hasText: "Transition Requirements" });
    const reqTextarea = reqLabel.locator("..").locator("textarea");
    await expect(reqTextarea).toContainText("Establish time passage");

    // ── Step 6: generate the bridge story ────────────────────────────────
    await page.getByRole("button", { name: "Generate Bridge Story" }).click();

    // We should land on the SCENARIO DRAFT step.
    // The stepper renders "2. SCENARIO DRAFT" (distinct from "Scenario Draft" in the breadcrumb).
    await expect(page.getByText("2. SCENARIO DRAFT")).toBeVisible();

    // The Bridge Story banner should show A → Bridge → B
    await expect(page.getByText(/Bridge Story/)).toBeVisible();
    await expect(page.getByText(/Source A/)).toBeVisible();
    await expect(page.getByText(/Target B/)).toBeVisible();

    // The bridge candidates bar should be visible
    await expect(page.getByText("Bridge Candidates")).toBeVisible();

    // ── Step 7: save to library ───────────────────────────────────────────
    // Upgrade the scenario list mock so it returns the saved bridge after refetch
    await upgradeScenarioListMock(page);

    await page.getByRole("button", { name: "Save to Library" }).click();

    // A success toast should appear
    await expect(
      page.getByText(/Scenario saved to library/i).or(page.getByText(/saved/i)).first()
    ).toBeVisible();

    // ── Step 8: BRIDGE badge in Scenario Library ──────────────────────────
    // After save the component stays on the SCENARIO DRAFT step and shows
    // "SAVED IN LIBRARY". Navigate back to the library to verify the badge.
    await expect(page.getByText("SAVED IN LIBRARY")).toBeVisible();

    // Click "Back to Library / Idea" to return to the scenario list
    await page.getByRole("button", { name: /Back to Library/i }).click();

    // SCENARIOS tab is active (set by save); verify BRIDGE badge and saved title.
    await expect(
      page.getByText(SAVED_BRIDGE_SCENARIO.title).first()
    ).toBeVisible();
    // The badge spans "BRIDGE ({source} → {target})".
    // Use filter(hasText) for substring match — getByText requires full-text match which
    // can fail when the element also includes an inline SVG icon node before the text.
    await expect(
      page.locator("span").filter({ hasText: "BRIDGE (" }).first()
    ).toBeVisible();
  });

  test("Lineage tab shows bridge node under both parents with role labels", async ({ page }) => {
    // Start with the full list (bridge already saved)
    await page.unroute("**/api/v1/scenarios");
    await registerScenarioList(page, SCENARIOS_WITH_BRIDGE);

    await page.goto("/world");

    // Switch to Lineage tab
    await page.getByRole("button", { name: /Lineage/ }).click();

    // Wait for tree to render
    await expect(page.getByText("family tree")).toBeVisible();

    // The bridge node appears under both parent roots — use first() to avoid strict-mode error.
    await expect(page.getByText(SAVED_BRIDGE_SCENARIO.title).first()).toBeVisible();

    // Bridge role labels should appear ("bridged from (A)" or "bridged into (B)")
    await expect(
      page.getByText(/bridged from \(A\)|bridged into \(B\)/i).first()
    ).toBeVisible();

    // The "bridge" chip badge should appear
    await expect(page.getByText("bridge").first()).toBeVisible();
  });
});
