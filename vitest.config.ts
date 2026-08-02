import { defineConfig } from "vitest/config";

const maxForksRaw = process.env.VITEST_UNIT_MAX_FORKS;
const maxForks = Number.isInteger(Number(maxForksRaw)) && Number(maxForksRaw) > 0
  ? Number(maxForksRaw)
  : 2;

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks
      }
    }
  }
});
