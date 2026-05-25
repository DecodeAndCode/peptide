import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
});
