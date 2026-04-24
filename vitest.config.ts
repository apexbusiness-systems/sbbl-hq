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
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 2,
        maxForks: 2,
      },
    },
    isolate: true,
    testTimeout: 120000,
    hookTimeout: 120000,
    coverage: {
      provider: "istanbul",
      // Enabled via CLI flag in CI: `vitest run --coverage`
      // Local dev: `vitest run` skips coverage for speed.
      enabled: false,
      include: [
        // Only truly bounded modules belong here — large page components
        // and contexts are excluded because their Istanbul instrumentation
        // (plus module-level singletons kept alive with isolate:false)
        // accumulates across all 89 test files and pushes the heap past
        // the 12 GB ceiling before the run completes.
        // Live.tsx and context behavior is validated by the live-page-*
        // and context integration tests; statement coverage is tracked
        // in the build-chaos-battery workflow.
        "src/lib/api/stream.ts",
      ],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
