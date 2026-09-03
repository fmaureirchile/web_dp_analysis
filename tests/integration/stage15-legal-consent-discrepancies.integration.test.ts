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

describe("Etapa 15 T03 discrepancias de consentimiento observable", () => {
  it("detecta tracking posterior al rechazo", async () => {
    const rejectResponse = await fetch(`${labBaseUrl}/sitio-c/consent/reject`, { method: "POST" });
    expect(rejectResponse.status).toBe(200);

    const executionId = await buildExecution(`${labBaseUrl}/sitio-c`);

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-c`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: [],
      declaredCookieKeys: [],
      declaredPurposes: ["analitica"]
    });

    expect(start.status).toBe(200);
    const trackingAfterReject = (start.body.data.discrepancies as Array<{ kind: string; message: string }>).find(
      (item) => item.kind === "TRACKING_AFTER_REJECT"
    );

    expect(trackingAfterReject).toBeDefined();
    expect(trackingAfterReject?.message).toContain("Existe una posible discrepancia");
    expect(trackingAfterReject?.message).toContain("Requiere validacion");
  });

  it("detecta captura previa a informacion y decision", async () => {
    const executionId = await buildExecution(`${labBaseUrl}/sitio-c`);

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-c`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);

    const start = await request(app).post("/api/v1/legal-analysis/discrepancies/start").send({
      executionId,
      declaredThirdParties: [],
      declaredCookieKeys: [],
      declaredPurposes: ["analitica"]
    });

    expect(start.status).toBe(200);

    const beforeInfo = (start.body.data.discrepancies as Array<{ kind: string; message: string }>).find(
      (item) => item.kind === "CAPTURE_BEFORE_INFORMATION"
    );

    expect(beforeInfo).toBeDefined();
    expect(beforeInfo?.message).toContain("Existe una posible discrepancia");
    expect(beforeInfo?.message).toContain("Requiere validacion");
  });
});
