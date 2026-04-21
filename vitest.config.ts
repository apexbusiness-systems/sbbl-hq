import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules"],
    coverage: {
      provider: "istanbul",
      enabled: false,
      include: [
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
