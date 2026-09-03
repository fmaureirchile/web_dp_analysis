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
      allowedDomains: ["127.0.0.1"],
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

describe("Etapa 15 T02 finalidad no encontrada baseline", () => {
  it("detecta categoria observada sin finalidad declarada", async () => {
    const executionId = await buildExecution(`${labBaseUrl}/sitio-a/storage-cookie`);

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: [],
      declaredCookieKeys: ["synthetic_session", "synthetic_pref"],
      declaredPurposes: ["boletin informativo"]
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.totals.observedCategories).toBeGreaterThanOrEqual(1);

    const purposeGap = (start.body.data.discrepancies as Array<{ kind: string; message: string }>).find(
      (item) => item.kind === "PURPOSE_NOT_FOUND_FOR_OBSERVED_CATEGORY"
    );

    expect(purposeGap).toBeDefined();
    expect(purposeGap?.message).toContain("No se encontro finalidad declarada");
    expect(purposeGap?.message).toContain("Existe una posible discrepancia");
    expect(purposeGap?.message).toContain("Requiere validacion");
  });

  it("no crea discrepancia de finalidad cuando existe finalidad compatible", async () => {
    const executionId = await buildExecution(`${labBaseUrl}/sitio-a/storage-cookie`);

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: [],
      declaredCookieKeys: ["synthetic_session", "synthetic_pref"],
      declaredPurposes: ["analitica de comportamiento", "seguridad operativa"]
    });

    expect(start.status).toBe(200);
    const purposeGaps = (start.body.data.discrepancies as Array<{ kind: string }>).filter(
      (item) => item.kind === "PURPOSE_NOT_FOUND_FOR_OBSERVED_CATEGORY"
    );
    expect(purposeGaps.length).toBe(0);
  });
});
