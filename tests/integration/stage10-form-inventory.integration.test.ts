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

describe("Etapa 10 T02 inventario minimo de formularios", () => {
  it("retorna inventario por executionId y permite filtrar por pageId", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E10-T02" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E10-T02" });

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

    const pageA = await request(app)
      .post("/api/v1/pages")
      .send({ executionId, url: `${labBaseUrl}/sitio-a/form-a`, title: "Form A" });

    const pageB = await request(app)
      .post("/api/v1/pages")
      .send({ executionId, url: `${labBaseUrl}/sitio-a/form-b`, title: "Form B" });

    const fieldA = await request(app)
      .post("/api/v1/form-fields")
      .send({ pageId: pageA.body.data.id as string, name: "email", type: "email", required: true });

    const fieldB = await request(app)
      .post("/api/v1/form-fields")
      .send({ pageId: pageB.body.data.id as string, name: "phone", type: "tel", required: false });

    await request(app)
      .post("/api/v1/observations")
      .send({
        executionId,
        pageId: pageA.body.data.id as string,
        formFieldId: fieldA.body.data.id as string,
        description: "Observed email field",
        reviewState: "PENDING"
      });

    await request(app)
      .post("/api/v1/observations")
      .send({
        executionId,
        pageId: pageB.body.data.id as string,
        formFieldId: fieldB.body.data.id as string,
        description: "Observed phone field",
        reviewState: "PENDING"
      });

    const allPages = await request(app).get(`/api/v1/reports/executions/${executionId}/form-inventory`);
    expect(allPages.status).toBe(200);
    expect(allPages.body.data.totals.pages).toBe(2);
    expect(allPages.body.data.totals.fields).toBe(2);
    expect(allPages.body.data.totals.observations).toBe(2);
    expect(allPages.body.data.pages).toHaveLength(2);

    const onlyPageA = await request(app).get(
      `/api/v1/reports/executions/${executionId}/form-inventory?pageId=${pageA.body.data.id as string}`
    );
    expect(onlyPageA.status).toBe(200);
    expect(onlyPageA.body.data.totals.pages).toBe(1);
    expect(onlyPageA.body.data.totals.fields).toBe(1);
    expect(onlyPageA.body.data.totals.observations).toBe(1);
    expect(onlyPageA.body.data.pages[0].pageId).toBe(pageA.body.data.id);
    expect(onlyPageA.body.data.pages[0].fields[0].name).toBe("email");
  });

  it("retorna 400 cuando pageId no pertenece a la ejecucion", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E10-T02-invalid" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E10-T02-invalid" });

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

    const response = await request(app).get(
      `/api/v1/reports/executions/${execution.body.data.id as string}/form-inventory?pageId=non-existent`
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("page_id_not_found");
  });
});
