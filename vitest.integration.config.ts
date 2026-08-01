import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 4
      }
    }
  }
});
