import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Standalone vitest config: intentionally does NOT reuse vite.config.ts,
// which requires a PORT env var (dev-server concern) irrelevant to unit tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
  },
});
