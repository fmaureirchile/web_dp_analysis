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

describe("Etapa 10 T01 reporte ejecutivo", () => {
  it("genera resumen con conteos y trazabilidad por evidencia", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E10-T01" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E10-T01" });

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

    const page = await request(app)
      .post("/api/v1/pages")
      .send({ executionId, url: `${labBaseUrl}/sitio-a/form`, title: "Form A" });

    const field = await request(app)
      .post("/api/v1/form-fields")
      .send({ pageId: page.body.data.id as string, name: "email", type: "email", required: true });

    await request(app)
      .post("/api/v1/observations")
      .send({
        executionId,
        pageId: page.body.data.id as string,
        formFieldId: field.body.data.id as string,
        description: "Observed email collection",
        reviewState: "PENDING"
      });

    const evidence1 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "PASSIVE_HTML",
      location: "memory://passive-html/r1"
    });

    const evidence2 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "BROWSER_DOM_SNAPSHOT",
      location: "memory://browser-dom/r2"
    });

    const report = await request(app).get(`/api/v1/reports/executions/${executionId}/executive-summary`);
    expect(report.status).toBe(200);
    expect(report.body.data.executionId).toBe(executionId);
    expect(report.body.data.totals.evidences).toBe(2);
    expect(report.body.data.totals.observations).toBe(1);

    const byKind = report.body.data.evidenceByKind as Array<{ kind: string; count: number; evidenceIds: string[] }>;
    expect(byKind).toHaveLength(2);

    const htmlRow = byKind.find((row) => row.kind === "PASSIVE_HTML");
    expect(htmlRow?.count).toBe(1);
    expect(htmlRow?.evidenceIds).toContain(evidence1.body.data.id);

    const domRow = byKind.find((row) => row.kind === "BROWSER_DOM_SNAPSHOT");
    expect(domRow?.count).toBe(1);
    expect(domRow?.evidenceIds).toContain(evidence2.body.data.id);

    const byLevel = report.body.data.evidenceByLevel as Array<{ level: string; count: number; evidenceIds: string[] }>;
    expect(byLevel).toHaveLength(1);
    expect(byLevel[0].level).toBe("E2");
    expect(byLevel[0].count).toBe(2);
    expect(byLevel[0].evidenceIds).toContain(evidence1.body.data.id);
    expect(byLevel[0].evidenceIds).toContain(evidence2.body.data.id);
  });

  it("retorna 400 cuando executionId no existe", async () => {
    const response = await request(app).get("/api/v1/reports/executions/non-existent/executive-summary");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("execution_id_not_found");
  });
});
