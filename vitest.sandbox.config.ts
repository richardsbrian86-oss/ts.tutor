import { defineConfig } from "vitest/config";

// Used only by `tutor check`, which runs the tests the tutor wrote for your
// current exercise.
export default defineConfig({
  test: {
    include: ["sandbox/**/*.test.ts"],
    environment: "node",
    // A runaway loop in an exercise should fail fast, not hang your terminal.
    testTimeout: 10_000,
  },
});
