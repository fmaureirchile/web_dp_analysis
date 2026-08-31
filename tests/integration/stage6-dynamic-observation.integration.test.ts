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

describe("Etapa 6 T02 observacion dinamica minima", () => {
  it("captura DOM y screenshot con resultado consultable por executionId", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E6-T02" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E6-T02" });

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

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.executionId).toBe(execution.body.data.id);
    expect(run.body.data.pageSnapshots).toHaveLength(1);
    expect(run.body.data.network).toEqual([]);
    expect(run.body.data.storage).toEqual([]);
    expect(run.body.data.events).toHaveLength(1);
    expect(run.body.data.events[0].eventType).toBe("PAGE_LOAD");

    const snapshot = run.body.data.pageSnapshots[0] as {
      domEvidenceId: string;
      screenshotEvidenceId: string;
    };

    const domEvidence = store.evidences.get(snapshot.domEvidenceId);
    const screenshotEvidence = store.evidences.get(snapshot.screenshotEvidenceId);

    expect(domEvidence?.kind).toBe("BROWSER_DOM_SNAPSHOT");
    expect(screenshotEvidence?.kind).toBe("BROWSER_SCREENSHOT");
    expect(domEvidence?.location).toBe(`memory://browser-dom/${snapshot.domEvidenceId}`);
    expect(screenshotEvidence?.location).toBe(`memory://browser-screenshot/${snapshot.screenshotEvidenceId}`);

    const domPayload = store.browserDomSnapshots.get(snapshot.domEvidenceId);
    const screenshotPayload = store.browserScreenshots.get(snapshot.screenshotEvidenceId);

    expect(domPayload?.html).toContain("<html");
    expect(screenshotPayload?.dataUrl).toContain("data:image/svg+xml;base64,");

    const result = await request(app).get(`/api/v1/browser/observations/${execution.body.data.id}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(execution.body.data.id);

    const finalExecution = store.executions.get(execution.body.data.id);
    expect(finalExecution?.state).toBe("COMPLETED");
  });
});
