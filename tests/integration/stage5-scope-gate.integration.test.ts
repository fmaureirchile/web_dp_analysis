import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe("Etapa 5.1 T03 scope gate", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rechaza URL fuera de alcance antes de iniciar fetch", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T03" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T03" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        excludedPaths: ["/private"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/home"
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: "https://example.local/home"
      });

    expect(execution.status).toBe(201);

    const crawl = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: execution.body.data.id,
        entryUrl: "https://outside.local/form"
      });

    expect(crawl.status).toBe(403);
    expect(crawl.body.errorCode).toBe("authorization_scope_rejected");
    expect(crawl.body.message).toContain("domain_not_authorized");

    const fetchedResult = await request(app).get(`/api/v1/crawler/passive/single-page/${execution.body.data.id}/result`);

    expect(fetchedResult.status).toBe(200);
    expect(fetchedResult.body.ok).toBe(false);
    expect(fetchedResult.body.error.executionId).toBe(execution.body.data.id);
    expect(fetchedResult.body.error.errorCode).toBe("authorization_scope_rejected");

    const updatedExecution = store.executions.get(execution.body.data.id);
    expect(updatedExecution?.state).toBe("FAILED");
    expect(store.executionTransitions).toHaveLength(3);
    expect(store.executionTransitions.map((entry) => entry.to)).toEqual(["QUEUED", "RUNNING", "FAILED"]);
  });

  it("valida alcance y ejecuta fetch devolviendo error controlado si host no responde", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T03-2" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T03-2" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/form"
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE"
      });

    const crawl = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: execution.body.data.id,
        entryUrl: "https://example.local/form"
      });

    expect(crawl.status).toBe(422);
    expect(crawl.body.errorCode).toBe("http_fetch_failed");
  });
});
