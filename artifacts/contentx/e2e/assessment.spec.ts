import { expect, test, type Page } from "@playwright/test";

const assessmentId = "support-assessment";
const scenarioRecords = [
  {
    id: "scenario-refund", title: "Refund request", idea: "refund",
    scenario: { title: "Refund request", characters: [{ name: "Ari", role: "Customer" }] },
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "scenario-delay", title: "Delivery delay", idea: "delivery",
    scenario: { title: "Delivery delay", characters: [{ name: "Min", role: "Customer" }] },
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
];

function packagePayload(version: number) {
  return {
    packageKey: "support-assessment", version,
    metadata: { title: "Support assessment", description: "Resolve customer issues safely.", locale: "ko-KR" },
    provenance: { contentHash: "a".repeat(64) },
    competencies: [{ key: "empathy", name: "Empathy" }],
    scenarios: scenarioRecords.map((source, index) => ({
      key: source.id, title: source.title, description: source.idea,
      competencies: ["Empathy"], personas: [{ name: index ? "Min" : "Ari" }],
      difficulty: "intermediate", estimatedTime: 10, simulation: { mode: "roleplay" },
      termination: { maxTurns: 10 },
      evaluation: { dimensions: [{ key: "quality", label: "Response quality", weight: 1, criteria: ["Acknowledge the customer"] }], passingScore: 70 },
    })),
  };
}

async function registerAssessmentRoutes(page: Page) {
  let currentVersion = 0;
  const publishedVersions = new Set<number>();
  let createPayloads: any[] = [];

  const summary = () => currentVersion
    ? [{
      id: assessmentId, packageKey: "support-assessment", title: "Support assessment",
      description: "Resolve customer issues safely.", sourceType: "scenario-library",
      sourceId: scenarioRecords.map((item) => item.id).join(","), status: publishedVersions.size ? "published" : "draft",
      currentVersion, scenarioCount: 2, competencyCount: 1,
      latestTarget: publishedVersions.size ? { target: "roleplayx", organizationId: "org-1", category: "support", status: "succeeded" } : null,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    }]
    : [];
  const detail = () => ({
    ...summary()[0],
    versions: Array.from({ length: currentVersion }, (_, index) => {
      const version = index + 1;
      return {
        id: `version-${version}`, packageId: assessmentId, version, contentHash: "a".repeat(64),
        validation: { valid: publishedVersions.has(version), diagnostics: [] },
        status: publishedVersions.has(version) ? "published" : "draft",
        latestTarget: publishedVersions.has(version) ? { target: "roleplayx", organizationId: "org-1", category: "support", status: "succeeded" } : null,
        createdAt: "2026-01-01T00:00:00Z",
      };
    }),
    publicationHistory: Array.from(publishedVersions, (version) => ({
      id: `publication-${version}`, packageId: assessmentId, packageVersion: version, target: "roleplayx",
      organizationId: "org-1", category: "support", idempotencyKey: `key-${version}`, attempt: 1,
      status: "succeeded", createdAt: "2026-01-01T00:00:00Z",
    })),
  });

  await page.route("**/api/v1/scenarios", (route, request) =>
    request.method() === "GET" ? route.fulfill({ json: scenarioRecords }) : route.fallback());
  await page.route(`**/api/v1/assessments/${assessmentId}/versions`, async (route, request) => {
    if (request.method() !== "POST") return route.fallback();
    const body = request.postDataJSON();
    createPayloads.push(body);
    currentVersion = body.version;
    await route.fulfill({
      status: 201,
      json: { id: `version-${body.version}`, packageId: assessmentId, version: body.version, contentHash: "a".repeat(64), validation: { valid: true, diagnostics: [] }, createdAt: "2026-01-01T00:00:00Z" },
    });
  });
  await page.route(`**/api/v1/assessments/${assessmentId}/versions/*/package`, (route, request) => {
    const version = Number(request.url().match(/versions\/(\d+)\/package/)?.[1]);
    return route.fulfill({ json: packagePayload(version) });
  });
  await page.route(`**/api/v1/assessments/${assessmentId}/versions/*/validate`, route =>
    route.fulfill({ json: { valid: true, diagnostics: [] } }));
  await page.route(`**/api/v1/assessments/${assessmentId}/versions/*/publish`, (route, request) => {
    const version = Number(request.url().match(/versions\/(\d+)\/publish/)?.[1]);
    publishedVersions.add(version);
    return route.fulfill({ json: { status: "published", response: { importedScenarioCount: 2, roleplayXUrl: `https://roleplayx.example/import/${version}` } } });
  });
  await page.route(`**/api/v1/assessments/${assessmentId}/publishes`, route =>
    route.fulfill({ json: detail().publicationHistory }));
  await page.route(`**/api/v1/assessments/${assessmentId}`, route => route.fulfill({ json: detail() }));
  await page.route("**/api/v1/assessments", (route, request) =>
    request.method() === "GET" ? route.fulfill({ json: summary() }) : route.fallback());

  return { createPayloads };
}

async function completeVersionForm(page: Page, packageId?: string) {
  const dialog = page.getByRole("dialog").last();
  if (packageId) await dialog.getByTestId("input-assessment-package-id").fill(packageId);
  // Korean labels currently normalize to the same generated test id. Scope to
  // the dialog and use their stable form order: competency, then title.
  const duplicateTextInputs = dialog.locator('[data-testid="input-assessment-"]');
  await duplicateTextInputs.nth(packageId ? 0 : 0).fill("Empathy");
  await duplicateTextInputs.nth(packageId ? 1 : 1).fill("Support assessment");
  await dialog.getByTestId("input-assessment-description").fill("Resolve customer issues safely.");
  await dialog.getByTestId("input-assessment-evaluation-criteria").fill("Acknowledge the customer");
  for (const [id, character] of [["scenario-refund", "Ari · Customer"], ["scenario-delay", "Min · Customer"]] as const) {
    await dialog.getByTestId(`checkbox-assessment-scenario-${id}`).check();
    await dialog.getByTestId(`select-assessment-primary-persona-${id}`).click();
    await page.getByRole("option", { name: character }).click();
  }
}

async function validateAndPublish(page: Page) {
  await expect(page.getByTestId("button-publish-assessment")).toBeDisabled();
  await page.getByTestId("button-validate-assessment").click();
  await expect(page.getByTestId("status-validation-passed")).toBeVisible();
  await page.getByTestId("button-publish-assessment").click();
  await page.getByTestId("input-publish-organization").fill("org-1");
  await page.getByTestId("input-publish-category").fill("support");
  await page.getByTestId("button-confirm-publish").click();
  await expect(page.getByTestId("status-publish-success")).toContainText("2 scenarios");
}

test("creates v1 from two scenarios, publishes it, then creates an actionable v2", async ({ page }) => {
  const api = await registerAssessmentRoutes(page);
  await page.goto("/assessments");
  await page.getByTestId("button-new-assessment").click();
  await completeVersionForm(page, assessmentId);
  await page.getByTestId("button-create-assessment-version").click();

  await expect.poll(() => api.createPayloads).toHaveLength(1);
  expect(api.createPayloads[0]).toMatchObject({
    packageId: assessmentId, packageKey: assessmentId, version: 1,
    scenarios: [
      { scenarioId: "scenario-refund", primaryPersonaKey: "ari-1" },
      { scenarioId: "scenario-delay", primaryPersonaKey: "min-1" },
    ],
  });
  await expect(page).toHaveURL(/\/assessments\/support-assessment\?version=1/);
  await validateAndPublish(page);
  await expect(page.getByTestId("row-publish-history-publication-1")).toContainText("succeeded");

  // A published version remains immutable, but the follow-up-version action must remain available.
  await page.reload();
  await expect(page.getByTestId("status-assessment-immutable")).toBeVisible();
  await expect(page.getByTestId("button-new-assessment-version")).toBeVisible();
  await expect(page.getByTestId("button-validate-assessment")).toHaveCount(0);
  await page.getByTestId("button-new-assessment-version").click();
  await completeVersionForm(page);
  await page.getByTestId("button-create-assessment-version").click();

  await expect.poll(() => api.createPayloads).toHaveLength(2);
  expect(api.createPayloads[1]).toMatchObject({ packageId: assessmentId, version: 2 });
  await expect(page).toHaveURL(/\/assessments\/support-assessment\?version=2/);
  await expect(page.getByTestId("button-validate-assessment")).toBeVisible();
  await expect(page.getByTestId("button-publish-assessment")).toBeVisible();
  await validateAndPublish(page);
  await expect(page.getByTestId("row-publish-history-publication-2")).toContainText("succeeded");
});