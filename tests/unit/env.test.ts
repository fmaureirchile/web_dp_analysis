import { afterEach, describe, expect, it } from "vitest";

import { getRuntimeEnv } from "../../apps/api/src/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getRuntimeEnv", () => {
  it("debe validar variables requeridas", () => {
    process.env.NODE_ENV = "test";
    process.env.APP_PORT = "3000";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.REDIS_URL = "redis://localhost:6379";

    const env = getRuntimeEnv();
    expect(env.nodeEnv).toBe("test");
    expect(env.appPort).toBe(3000);
  });

  it("debe fallar si falta variable requerida", () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "test";
    process.env.APP_PORT = "3000";
    process.env.REDIS_URL = "redis://localhost:6379";

    expect(() => getRuntimeEnv()).toThrowError("Missing required environment variables");
  });
});
