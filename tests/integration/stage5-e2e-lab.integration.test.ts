import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

beforeEach(async () => {
  resetStore();

  const labApp = buildLaboratoryServer();
  labServer = await new Promise<ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]>>((resolve, reject) => {
    const started = labApp.listen(0, "127.0.0.1", () => resolve(started));
    started.on("error", reject);
  });

  const address = labServer.address() as AddressInfo;
  labBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!labServer) {
      resolve();
      return;
    }

    labServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  labServer = undefined;
  labBaseUrl = "";
});

describe("Etapa 5.1 T08 E2E laboratorio", () => {
  it("flujo completo exitoso Sitio A: POST crawler + GET resultado", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T08 Success" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T08 Success" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["127.0.0.1"],
        allowSubdomains: false,
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: `${labBaseUrl}/sitio-a`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.statusHttp).toBe(200);
    expect(run.body.data.title).toBeTypeOf("string");
    expect(run.body.data.evidenceId).toBeTypeOf("string");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${execution.body.data.id}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(execution.body.data.id);
    expect(result.body.data.statusHttp).toBe(200);
    expect(result.body.data.evidenceId).toBe(run.body.data.evidenceId);

    const finalState = store.executions.get(execution.body.data.id);
    expect(finalState?.state).toBe("COMPLETED");
  });

  it("flujo fuera de alcance en laboratorio: POST crawler 403 + GET resultado error", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T08 Scope" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T08 Scope" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["127.0.0.1"],
        allowSubdomains: false,
        excludedPaths: ["/sitio-a/private"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: `${labBaseUrl}/sitio-a`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a/private/form`
      });

    expect(run.status).toBe(403);
    expect(run.body.errorCode).toBe("authorization_scope_rejected");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${execution.body.data.id}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.executionId).toBe(execution.body.data.id);
    expect(result.body.error.errorCode).toBe("authorization_scope_rejected");
    expect(result.body.error.message).toContain("route_excluded_by_authorization");

    const finalState = store.executions.get(execution.body.data.id);
    expect(finalState?.state).toBe("FAILED");
  });
});
