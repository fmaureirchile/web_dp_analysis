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

async function setupExecution(): Promise<{ executionId: string }> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org T06" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T06" });

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

  return { executionId: execution.body.data.id as string };
}

describe("Etapa 5.2 T06 observabilidad minima", () => {
  it("registra eventos estructurados de inicio y resultado exitoso por executionId/correlationId", async () => {
    const { executionId } = await setupExecution();
    const correlation = "corr-t06-success-001";

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .set("x-correlation-id", correlation)
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    expect(run.status).toBe(200);

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();
    const operational = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ states: "COMPLETED", from, to, limit: 10 });

    expect(operational.status).toBe(200);

    const items = operational.body.data.items as Array<{
      executionId: string;
      state: string;
      resultAvailable: boolean;
      statusHttp?: number;
      evidenceId?: string;
    }>;

    const item = items.find((entry) => entry.executionId === executionId);
    expect(item).toBeDefined();
    expect(item?.state).toBe("COMPLETED");
    expect(item?.resultAvailable).toBe(true);
    expect(item?.statusHttp).toBe(200);
    expect(item?.evidenceId).toBeTypeOf("string");
  });

  it("registra eventos estructurados de inicio y error por executionId/correlationId", async () => {
    const { executionId } = await setupExecution();
    const correlation = "corr-t06-error-001";

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .set("x-correlation-id", correlation)
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-a/non-html`
      });

    expect(run.status).toBe(422);
    expect(run.body.errorCode).toBe("http_non_html_content");

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();
    const operational = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ states: "FAILED", from, to, limit: 10 });

    expect(operational.status).toBe(200);

    const items = operational.body.data.items as Array<{
      executionId: string;
      state: string;
      resultAvailable: boolean;
      errorCode?: string;
    }>;

    const item = items.find((entry) => entry.executionId === executionId);
    expect(item).toBeDefined();
    expect(item?.state).toBe("FAILED");
    expect(item?.resultAvailable).toBe(true);
    expect(item?.errorCode).toBe("http_non_html_content");
  });

  it("mantiene aislamiento de eventos entre ejecuciones distintas", async () => {
    const first = await setupExecution();
    const second = await setupExecution();

    await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .set("x-correlation-id", "corr-t06-iso-001")
      .send({
        executionId: first.executionId,
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .set("x-correlation-id", "corr-t06-iso-002")
      .send({
        executionId: second.executionId,
        entryUrl: `${labBaseUrl}/sitio-a/non-html`
      });

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();
    const operational = await request(app)
      .get("/api/v1/crawler/passive/executions/operational")
      .query({ states: "COMPLETED,FAILED", from, to, limit: 20 });

    expect(operational.status).toBe(200);

    const items = operational.body.data.items as Array<{
      executionId: string;
      state: string;
      resultAvailable: boolean;
    }>;

    const firstItem = items.find((entry) => entry.executionId === first.executionId);
    const secondItem = items.find((entry) => entry.executionId === second.executionId);

    expect(firstItem).toBeDefined();
    expect(secondItem).toBeDefined();
    expect(firstItem?.state).toBe("COMPLETED");
    expect(secondItem?.state).toBe("FAILED");
    expect(firstItem?.resultAvailable).toBe(true);
    expect(secondItem?.resultAvailable).toBe(true);
  });
});
