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

async function buildExecution(entryUrl: string): Promise<string> {
  const organization = await request(app).post("/api/v1/organizations").send({ name: `Org ${Math.random()}` });
  const project = await request(app)
    .post("/api/v1/projects")
    .send({ organizationId: organization.body.data.id, name: `Project ${Math.random()}` });

  const authorization = await request(app)
    .post("/api/v1/authorizations")
    .send({
      projectId: project.body.data.id,
      validFrom: isoNowPlus(-60),
      validTo: isoNowPlus(60),
      allowedDomains: ["127.0.0.1", "localhost"],
      allowSubdomains: false,
      permittedOperations: ["SCAN_PASSIVE"]
    });

  const target = await request(app)
    .post("/api/v1/targets")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      baseUrl: entryUrl
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl
    });

  return execution.body.data.id as string;
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

describe("Etapa 17 T02 retencion configurable minima", () => {
  it("purga ejecuciones cerradas fuera de ventana y conserva las recientes", async () => {
    const oldExecutionId = await buildExecution(`${labBaseUrl}/sitio-a/storage-cookie`);
    const freshExecutionId = await buildExecution(`${labBaseUrl}/sitio-a/storage-cookie`);

    const oldRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: oldExecutionId, entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`, timeoutMs: 10000 });
    expect(oldRun.status).toBe(200);

    const freshRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: freshExecutionId, entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`, timeoutMs: 10000 });
    expect(freshRun.status).toBe(200);

    const oldExecution = store.executions.get(oldExecutionId);
    const freshExecution = store.executions.get(freshExecutionId);
    expect(oldExecution).toBeTruthy();
    expect(freshExecution).toBeTruthy();

    store.executions.set(oldExecutionId, {
      ...oldExecution!,
      updatedAt: new Date(Date.now() - 120 * 60_000).toISOString()
    });

    store.executions.set(freshExecutionId, {
      ...freshExecution!,
      updatedAt: new Date().toISOString()
    });

    const retention = await request(app).post("/api/v1/privacy/retention/apply").send({
      windowMinutes: 60
    });

    expect(retention.status).toBe(200);
    expect(retention.body.ok).toBe(true);
    expect(retention.body.data.candidateExecutions).toBe(1);
    expect(retention.body.data.purgedExecutions).toBe(1);
    expect(retention.body.data.deletedTotals.dynamicObservationResult).toBe(1);

    const oldResult = await request(app).get(`/api/v1/browser/observations/${oldExecutionId}/result`);
    expect(oldResult.status).toBe(422);
    expect(oldResult.body.message).toBe("dynamic_observation_result_not_available");

    const freshResult = await request(app).get(`/api/v1/browser/observations/${freshExecutionId}/result`);
    expect(freshResult.status).toBe(200);
    expect(freshResult.body.ok).toBe(true);
  });

  it("retorna 400 cuando windowMinutes es invalido", async () => {
    const response = await request(app).post("/api/v1/privacy/retention/apply").send({
      windowMinutes: 0
    });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("invalid_window_minutes");
  });
});
