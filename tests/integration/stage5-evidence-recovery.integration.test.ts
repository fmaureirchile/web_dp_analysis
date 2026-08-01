import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import {
  getPassiveHtmlEvidenceReferenceByExecutionId,
  resetStore,
  store
} from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";
const originalPersistenceFlag = process.env.USE_PRISMA_PERSISTENCE;

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

beforeEach(async () => {
  process.env.USE_PRISMA_PERSISTENCE = "true";
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

  process.env.USE_PRISMA_PERSISTENCE = originalPersistenceFlag;
  labServer = undefined;
  labBaseUrl = "";
});

describe("Etapa 5.2 T02 evidencia durable", () => {
  it("recupera referencia evidenceId por executionId tras reinicio", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T02" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T02" });

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

    const crawl = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a`
      });

    expect(crawl.status).toBe(200);
    const evidenceId = crawl.body.data.evidenceId as string;

    // Simula reinicio de proceso: vaciamos estado en memoria y recuperamos desde capa durable.
    resetStore();
    expect(store.evidences.size).toBe(0);

    const recovered = await getPassiveHtmlEvidenceReferenceByExecutionId(execution.body.data.id);

    expect(recovered).toBeDefined();
    expect(recovered?.executionId).toBe(execution.body.data.id);
    expect(recovered?.evidenceId).toBe(evidenceId);
    expect(recovered?.location).toBe(`memory://passive-html/${evidenceId}`);
  });
});
