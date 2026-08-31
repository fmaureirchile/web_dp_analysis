import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";
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

describe("Etapa 5.2 T03 consulta operativa", () => {
  it("lista ejecuciones COMPLETED/FAILED con filtros de estado y metadata basica", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T03-Op" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T03-Op" });

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

    const completedExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    const failedExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    const draftExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "DRAFT",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    const completedRun = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: completedExecution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    expect(completedRun.status).toBe(200);

    const failedRun = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: failedExecution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a/private/form`
      });

    expect(failedRun.status).toBe(403);

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();

    const operational = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ states: "COMPLETED,FAILED", from, to, limit: 10 });

    expect(operational.status).toBe(200);
    expect(operational.body.data.states).toEqual(["COMPLETED", "FAILED"]);
    expect(operational.body.data.limit).toBe(10);

    const items = operational.body.data.items as Array<{
      executionId: string;
      state: string;
      resultAvailable: boolean;
      statusHttp?: number;
      evidenceId?: string;
      errorCode?: string;
    }>;

    const completedItem = items.find((item) => item.executionId === completedExecution.body.data.id);
    const failedItem = items.find((item) => item.executionId === failedExecution.body.data.id);
    const draftItem = items.find((item) => item.executionId === draftExecution.body.data.id);

    expect(completedItem).toBeDefined();
    expect(completedItem?.state).toBe("COMPLETED");
    expect(completedItem?.resultAvailable).toBe(true);
    expect(completedItem?.statusHttp).toBe(200);
    expect(completedItem?.evidenceId).toBeTypeOf("string");

    expect(failedItem).toBeDefined();
    expect(failedItem?.state).toBe("FAILED");
    expect(failedItem?.resultAvailable).toBe(true);
    expect(failedItem?.errorCode).toBe("authorization_scope_rejected");

    expect(draftItem).toBeUndefined();
  });

  it("valida filtros invalidos", async () => {
    const invalidStates = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ states: "RUNNING" });

    expect(invalidStates.status).toBe(400);
    expect(invalidStates.body.error).toBe("invalid_states_filter");

    const invalidWindow = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ from: "not-iso" });

    expect(invalidWindow.status).toBe(400);
    expect(invalidWindow.body.error).toBe("invalid_from_filter");

    const invalidLimit = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ limit: "999" });

    expect(invalidLimit.status).toBe(400);
    expect(invalidLimit.body.error).toBe("invalid_limit_filter");
  });
});
