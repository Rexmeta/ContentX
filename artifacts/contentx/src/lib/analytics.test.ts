// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

describe("trackEvent", () => {
  afterEach(() => {
    delete window.umami;
  });

  it("is a no-op when analytics is unavailable", () => {
    expect(() => trackEvent("assessment_version_created", { success: true })).not.toThrow();
  });

  it("forwards event data to Umami", () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent("assessment_validation_completed", {
      version_number: 2,
      scenario_count: 3,
      success: false,
    });

    expect(track).toHaveBeenCalledWith("assessment_validation_completed", {
      version_number: 2,
      scenario_count: 3,
      success: false,
    });
  });

  it("swallows tracker failures", () => {
    window.umami = { track: () => { throw new Error("tracker unavailable"); } };

    expect(() => trackEvent("assessment_publish_completed", { success: true })).not.toThrow();
  });
});