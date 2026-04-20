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
    // ── Pool: forks instead of threads ──────────────────────────────────
    // Threads share a V8 heap; with 97 test files + Istanbul instrumentation
    // of large source files the shared heap exceeds 8 GB and OOMs during
    // coverage aggregation. Forks give each worker its own isolated heap so
    // GC can reclaim between files. singleFork serialises execution: higher
    // wall-clock time but zero OOM risk and deterministic output in CI.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: true,
    maxConcurrency: 1,
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
      reporter: ["text", "json", "html"],
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
