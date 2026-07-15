import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/scripts/**",
        "src/seeders/**",
        "src/server.js",
        "src/services/emailTemplates/**",
        "src/services/case-templates/**",
      ],
      reporter: ["text", "html", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.js"],
          setupFiles: ["tests/setup/unit.setup.js"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.js"],
          globalSetup: ["tests/setup/globalSetup.integration.js"],
          setupFiles: ["tests/setup/integration.setup.js"],
          // Integration suites share one database — never run files in parallel.
          fileParallelism: false,
          hookTimeout: 30000,
          testTimeout: 15000,
          passWithNoTests: true,
        },
      },
    ],
  },
});
