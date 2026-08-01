import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";
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

describe("Etapa 5.1 T04/T05 passive fetch + evidence", () => {
  it("devuelve resultado exitoso y persiste evidencia HTML en memoria", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org T04T05" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T04T05" });

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
    expect(crawl.body.ok).toBe(true);
    expect(crawl.body.data.executionId).toBe(execution.body.data.id);
    expect(crawl.body.data.entryUrl).toBe(`${labBaseUrl}/sitio-a`);
    expect(crawl.body.data.statusHttp).toBe(200);
    expect(crawl.body.data.evidenceId).toBeTypeOf("string");
    expect(crawl.body.data.fetchedAt).toBeTypeOf("string");

    const fetchedResult = await request(app).get(`/api/v1/crawler/passive/single-page/${execution.body.data.id}/result`);

    expect(fetchedResult.status).toBe(200);
    expect(fetchedResult.body.ok).toBe(true);
    expect(fetchedResult.body.data.executionId).toBe(execution.body.data.id);
    expect(fetchedResult.body.data.evidenceId).toBe(crawl.body.data.evidenceId);

    const evidenceId = crawl.body.data.evidenceId as string;
    const persistedEvidence = store.evidences.get(evidenceId);
    const persistedPayload = store.passiveHtmlEvidences.get(evidenceId);

    expect(persistedEvidence).toBeDefined();
    expect(persistedEvidence?.executionId).toBe(execution.body.data.id);
    expect(persistedEvidence?.kind).toBe("PASSIVE_HTML");
    expect(persistedEvidence?.location).toBe(`memory://passive-html/${evidenceId}`);

    expect(persistedPayload).toBeDefined();
    expect(persistedPayload?.executionId).toBe(execution.body.data.id);
    expect(persistedPayload?.entryUrl).toBe(`${labBaseUrl}/sitio-a`);
    expect(persistedPayload?.statusHttp).toBe(200);
    expect(persistedPayload?.html).toContain("<html");
    expect(persistedPayload?.title).toBeTypeOf("string");

    const updatedExecution = store.executions.get(execution.body.data.id);
    expect(updatedExecution?.state).toBe("COMPLETED");
    expect(store.executionTransitions).toHaveLength(3);
    expect(store.executionTransitions.map((entry) => entry.to)).toEqual(["QUEUED", "RUNNING", "COMPLETED"]);
  });
});
