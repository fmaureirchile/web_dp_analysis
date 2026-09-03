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

describe("Etapa 17 T01 purga de datos por ejecucion", () => {
  it("elimina resultados y artefactos de una ejecucion manteniendo trazabilidad de error esperada", async () => {
    const baselineExecutionId = await buildExecution(`${labBaseUrl}/sitio-a/storage-cookie`);
    const currentExecutionId = await buildExecution(`${labBaseUrl}/sitio-d`);

    const baselineRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: baselineExecutionId, entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`, timeoutMs: 10000 });
    expect(baselineRun.status).toBe(200);

    const currentRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: currentExecutionId, entryUrl: `${labBaseUrl}/sitio-d`, timeoutMs: 10000 });
    expect(currentRun.status).toBe(200);

    const comparison = await request(app)
      .post("/api/v1/monitoring/version-comparisons/start")
      .send({ baselineExecutionId, currentExecutionId });
    expect(comparison.status).toBe(200);

    const purge = await request(app).post(`/api/v1/privacy/executions/${currentExecutionId}/purge`).send({});

    expect(purge.status).toBe(200);
    expect(purge.body.ok).toBe(true);
    expect(purge.body.data.executionId).toBe(currentExecutionId);
    expect(purge.body.data.deletedCounts.dynamicObservationResult).toBe(1);
    expect(purge.body.data.deletedCounts.evidences).toBeGreaterThanOrEqual(2);
    expect(purge.body.data.deletedCounts.versionComparisons).toBeGreaterThanOrEqual(1);

    const observationResult = await request(app).get(`/api/v1/browser/observations/${currentExecutionId}/result`);
    expect(observationResult.status).toBe(422);
    expect(observationResult.body.errorCode).toBe("internal_error");
    expect(observationResult.body.message).toBe("dynamic_observation_result_not_available");

    const comparisonResult = await request(app).get(
      `/api/v1/monitoring/version-comparisons/${baselineExecutionId}/${currentExecutionId}/result`
    );
    expect(comparisonResult.status).toBe(422);
    expect(comparisonResult.body.error.errorCode).toBe("result_not_available");
  });

  it("retorna 400 cuando executionId no existe", async () => {
    const response = await request(app).post("/api/v1/privacy/executions/does-not-exist/purge").send({});

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("invalid_execution_id");
  });
});
