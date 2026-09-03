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

describe("Etapa 16 T03 alerta por cambio documental/tecnico", () => {
  it("clasifica DOCUMENTATION_GAP cuando aparece tracking nuevo sin endpoints nuevos", async () => {
    const baselineExecutionId = await buildExecution(`${labBaseUrl}/sitio-a`);
    const currentExecutionId = await buildExecution(`${labBaseUrl.replace("127.0.0.1", "localhost")}/sitio-a/redirect-host-swap`);

    const baselineRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: baselineExecutionId, entryUrl: `${labBaseUrl}/sitio-a`, timeoutMs: 10000 });
    expect(baselineRun.status).toBe(200);

    const currentRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: currentExecutionId,
        entryUrl: `${labBaseUrl.replace("127.0.0.1", "localhost")}/sitio-a/redirect-host-swap`,
        timeoutMs: 10000
      });
    expect(currentRun.status).toBe(200);

    const start = await request(app).post("/api/v1/monitoring/version-comparisons/start").send({
      baselineExecutionId,
      currentExecutionId
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.totals.newEndpoints).toBe(0);
    expect(start.body.data.alert.probableCause).toBe("DOCUMENTATION_GAP");

    const newTracking = (start.body.data.changes as Array<{ kind: string; probableCause: string }>).filter(
      (item) => item.kind === "NEW_THIRD_PARTY" || item.kind === "NEW_COOKIE"
    );
    expect(newTracking.length).toBeGreaterThanOrEqual(1);
    expect(newTracking.every((item) => item.probableCause === "DOCUMENTATION_GAP")).toBe(true);
  });

  it("clasifica SITE_CHANGE cuando aparecen endpoints nuevos", async () => {
    const baselineExecutionId = await buildExecution(`${labBaseUrl}/sitio-a`);
    const currentExecutionId = await buildExecution(`${labBaseUrl}/sitio-d`);

    const baselineRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: baselineExecutionId, entryUrl: `${labBaseUrl}/sitio-a`, timeoutMs: 10000 });
    expect(baselineRun.status).toBe(200);

    const currentRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: currentExecutionId, entryUrl: `${labBaseUrl}/sitio-d`, timeoutMs: 10000 });
    expect(currentRun.status).toBe(200);

    const start = await request(app).post("/api/v1/monitoring/version-comparisons/start").send({
      baselineExecutionId,
      currentExecutionId
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.totals.newEndpoints).toBeGreaterThanOrEqual(1);
    expect(start.body.data.alert.probableCause).toBe("SITE_CHANGE");

    const hasEndpointDelta = (start.body.data.changes as Array<{ kind: string }>).some((item) => item.kind === "NEW_ENDPOINT");
    expect(hasEndpointDelta).toBe(true);
  });
});
