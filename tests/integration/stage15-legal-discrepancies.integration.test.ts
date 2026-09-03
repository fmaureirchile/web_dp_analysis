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
  const org = await request(app).post("/api/v1/organizations").send({ name: `Org ${Math.random()}` });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: `Project ${Math.random()}` });

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

describe("Etapa 15 T01 discrepancias legal-tecnicas iniciales", () => {
  it("detecta tercero observado no declarado", async () => {
    const localhostEntry = labBaseUrl.replace("127.0.0.1", "localhost");
    const executionId = await buildExecution(`${localhostEntry}/sitio-a/redirect-host-swap`);

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId,
        entryUrl: `${localhostEntry}/sitio-a/redirect-host-swap`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: ["analytics.example.com"],
      declaredCookieKeys: []
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.totals.discrepancies).toBeGreaterThanOrEqual(1);

    const item = (start.body.data.discrepancies as Array<{ kind: string; message: string }>).find(
      (entry) => entry.kind === "THIRD_PARTY_OBSERVED_NOT_DECLARED"
    );

    expect(item).toBeDefined();
    expect(item?.message).toContain("Existe una posible discrepancia");
    expect(item?.message).toContain("Requiere validacion");

    const result = await request(app).get(`/api/v1/legal-analysis/discrepancies/${executionId}/result`);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(executionId);
  });

  it("retorna 422 cuando no existe observacion dinamica previa", async () => {
    const executionId = await buildExecution(`${labBaseUrl}/sitio-a/home`);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: ["127.0.0.1"],
      declaredCookieKeys: ["synthetic_session"]
    });

    expect(start.status).toBe(422);
    expect(start.body.ok).toBe(false);
    expect(start.body.error.errorCode).toBe("tracking_inventory_not_available");
  });
});
