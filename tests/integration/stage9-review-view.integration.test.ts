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

describe("Etapa 9 T03 vista de revision minima", () => {
  it("expone agregado de evidencias y observaciones por ejecucion", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E9-T03" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E9-T03" });

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

    const observation = await request(app)
      .post("/api/v1/observations")
      .send({
        executionId,
        pageId: page.body.data.id as string,
        formFieldId: field.body.data.id as string,
        description: "Observed email collection",
        reviewState: "PENDING"
      });

    expect(observation.status).toBe(201);

    const evidence1 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "PASSIVE_HTML",
      location: "memory://passive-html/review-1"
    });
    expect(evidence1.status).toBe(201);

    const evidence2 = await request(app).post("/api/v1/evidences").send({
      executionId,
      level: "E2",
      kind: "BROWSER_DOM_SNAPSHOT",
      location: "memory://browser-dom/review-2"
    });
    expect(evidence2.status).toBe(201);

    const reviewView = await request(app).get(`/api/v1/review/executions/${executionId}/view`);
    expect(reviewView.status).toBe(200);
    expect(reviewView.body.data.executionId).toBe(executionId);
    expect(reviewView.body.data.evidenceCount).toBe(2);
    expect(reviewView.body.data.observationCount).toBe(1);
    expect(reviewView.body.data.evidences).toHaveLength(2);
    expect(reviewView.body.data.observations).toHaveLength(1);
    expect(reviewView.body.data.observations[0].description).toBe("Observed email collection");
  });

  it("retorna 400 cuando executionId no existe", async () => {
    const response = await request(app).get("/api/v1/review/executions/non-existent/view");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("execution_id_not_found");
  });
});
