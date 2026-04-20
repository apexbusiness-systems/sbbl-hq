import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules"],
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
    isolate: false,
    maxConcurrency: 2,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "istanbul",
      // Enabled via CLI flag in CI: `vitest run --coverage`
      // Local dev: `vitest run` skips coverage for speed.
      enabled: false,
      include: [
        // NOTE: src/worker/index.ts is intentionally excluded from coverage.
        // It is 7 400+ lines; Istanbul AST-instrumentation allocates ~600 MB
        // of heap per worker, pushing aggregation past the 8 GB budget.
        // Worker routes are integration-tested via worker-routes.test.ts;
        // statement-level coverage is tracked in the build-chaos-battery workflow.
        "src/lib/api/stream.ts",
        "src/pages/Live.tsx",
        "src/contexts/AppContext.tsx",
        "src/contexts/AuthContext.tsx",
        "src/contexts/BagContext.tsx",
      ],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 25,
        functions: 20,
        branches: 14,
        statements: 23,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
