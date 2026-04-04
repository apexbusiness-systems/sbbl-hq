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
    coverage: {
      provider: "istanbul",
      // Enabled via CLI flag in CI: `vitest run --coverage`
      // Local dev: `vitest run` skips coverage for speed.
      enabled: false,
      include: [
        "src/worker/index.ts",
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
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
