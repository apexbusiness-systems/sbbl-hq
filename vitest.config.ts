import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const defaultCoverageInclude = [
  "src/lib/api/stream.ts",
  "src/pages/Live.tsx",
  "src/contexts/AppContext.tsx",
  "src/contexts/AuthContext.tsx",
  "src/contexts/BagContext.tsx",
];

const ciCriticalCoverageInclude = [
  // CI coverage scope is intentionally narrow to avoid Istanbul OOM while
  // preserving quality gates on the stream session provider core.
  "src/lib/playback/IPlaybackProvider.ts",
  "src/lib/playback/LegacyEmbedProvider.ts",
  "src/lib/playback/NativeHlsProvider.ts",
  "src/lib/playback/selectProvider.ts",
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules"],
    coverage: {
      provider: "istanbul",
      // Enabled via CLI flag in CI: `vitest run --coverage`
      // Local dev: `vitest run` skips coverage for speed.
      enabled: false,
      // CI critical suite instruments only the go-live/paywall/playback surface
      // to avoid whole-suite instrumentation OOMs.
      include: process.env.CI ? ciCriticalCoverageInclude : defaultCoverageInclude,
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      reporter: process.env.CI ? ["text", "json"] : ["text", "json", "html"],
      // Keep aggregate-only collection in CI to reduce memory churn.
      all: false,
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
