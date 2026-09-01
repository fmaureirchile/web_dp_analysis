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

describe("Etapa 10 T03 inventario minimo de terceros y cookies", () => {
  it("resume terceros observados en red", async () => {
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

    const report = await request(app).get(`/api/v1/reports/executions/${executionId}/tracking-inventory`);
    expect(report.status).toBe(200);
    expect(report.body.data.totals.thirdParties).toBeGreaterThanOrEqual(1);
    expect(report.body.data.totals.cookies).toBe(0);

    const firstThirdParty = report.body.data.thirdParties[0] as {
      domain: string;
      requestCount: number;
      requestIds: string[];
      urls: string[];
    };

    expect(firstThirdParty.domain).toBe("127.0.0.1");
    expect(firstThirdParty.requestCount).toBeGreaterThanOrEqual(1);
    expect(firstThirdParty.requestIds.length).toBeGreaterThanOrEqual(1);
    expect(firstThirdParty.urls.some((url) => url.includes("/sitio-a"))).toBe(true);
  });

  it("resume cookies observadas en almacenamiento", async () => {
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

    const report = await request(app).get(`/api/v1/reports/executions/${executionId}/tracking-inventory`);
    expect(report.status).toBe(200);
    expect(report.body.data.totals.thirdParties).toBe(0);
    expect(report.body.data.totals.cookies).toBe(2);
    expect(report.body.data.totals.cookieObservations).toBe(2);

    const cookieKeys = (report.body.data.cookies as Array<{ key: string }>).map((item) => item.key);
    expect(cookieKeys).toContain("synthetic_session");
    expect(cookieKeys).toContain("synthetic_pref");
  });

  it("retorna 400 cuando executionId no existe", async () => {
    const response = await request(app).get("/api/v1/reports/executions/non-existent/tracking-inventory");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("execution_id_not_found");
  });
});
