import { defineConfig } from "vitest/config";

// Tests for ts-tutor itself. Your exercise tests live in sandbox/ and are run
// separately by `tutor check` (see vitest.sandbox.config.ts), so a half-finished
// exercise never breaks this project's own test suite.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
