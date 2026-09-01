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

describe("Etapa 9 T01 consulta de evidencias", () => {
  it("lista evidencias por executionId y permite filtrar por kind", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E9-T01" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E9-T01" });

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

    const executionId = execution.body.data.id as string;

    const e1 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "PASSIVE_HTML",
      location: "memory://passive-html/custom-1"
    });
    expect(e1.status).toBe(201);

    const e2 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "BROWSER_SCREENSHOT",
      location: "memory://browser-screenshot/custom-1"
    });
    expect(e2.status).toBe(201);

    const listAll = await request(app).get(`/api/v1/evidences?executionId=${executionId}`);
    expect(listAll.status).toBe(200);
    expect(listAll.body.data.executionId).toBe(executionId);
    expect(listAll.body.data.items).toHaveLength(2);

    const listKind = await request(app).get(`/api/v1/evidences?executionId=${executionId}&kind=PASSIVE_HTML`);
    expect(listKind.status).toBe(200);
    expect(listKind.body.data.items).toHaveLength(1);
    expect(listKind.body.data.items[0].kind).toBe("PASSIVE_HTML");
    expect(listKind.body.data.items[0].location).toBe("memory://passive-html/custom-1");
  });

  it("retorna 400 cuando falta executionId", async () => {
    const response = await request(app).get("/api/v1/evidences");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("execution_id_required");
  });

  it("pagina resultados con cursor y respeta ventana temporal", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E9-T02" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E9-T02" });

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

    const executionId = execution.body.data.id as string;

    await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "PASSIVE_HTML",
      location: "memory://passive-html/page-1"
    });

    await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "BROWSER_DOM_SNAPSHOT",
      location: "memory://browser-dom/page-2"
    });

    const firstPage = await request(app).get(`/api/v1/evidences?executionId=${executionId}&limit=1`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.items).toHaveLength(1);
    expect(typeof firstPage.body.data.nextCursor).toBe("string");

    const nextCursor = firstPage.body.data.nextCursor as string;
    const secondPage = await request(app).get(`/api/v1/evidences?executionId=${executionId}&limit=1&cursor=${nextCursor}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.items).toHaveLength(1);
    expect(secondPage.body.data.items[0].evidenceId).not.toBe(firstPage.body.data.items[0].evidenceId);

    const from = new Date(Date.now() - 5 * 60_000).toISOString();
    const to = new Date(Date.now() + 5 * 60_000).toISOString();
    const inWindow = await request(app).get(
      `/api/v1/evidences?executionId=${executionId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    expect(inWindow.status).toBe(200);
    expect(inWindow.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it("retorna 400 cuando from es mayor que to", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E9-T02-window" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E9-T02-window" });

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

    const executionId = execution.body.data.id as string;
    const from = new Date(Date.now() + 5 * 60_000).toISOString();
    const to = new Date(Date.now() - 5 * 60_000).toISOString();

    const invalidWindow = await request(app).get(
      `/api/v1/evidences?executionId=${executionId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );

    expect(invalidWindow.status).toBe(400);
    expect(invalidWindow.body.error).toBe("invalid_time_window");
  });
});
