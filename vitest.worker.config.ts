import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/broadcast-*.test.ts"],
    setupFiles: ["src/test/worker-setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
