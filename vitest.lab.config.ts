import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/lab-*.integration.test.ts"]
  }
});
