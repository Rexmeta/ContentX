import { defineConfig } from "vitest/config";

// Standalone vitest config: intentionally does NOT reuse vite.config.ts,
// which requires a PORT env var (dev-server concern) irrelevant to unit tests.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
