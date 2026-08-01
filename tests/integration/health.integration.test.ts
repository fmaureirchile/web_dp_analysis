import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";

describe("GET /health", () => {
  it("debe responder estado operativo", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("web-analysis-api");
    expect(response.body.version).toBe("0.1.0");
    expect(typeof response.body.startedAt).toBe("string");
    expect(typeof response.body.timestamp).toBe("string");
  });
});
