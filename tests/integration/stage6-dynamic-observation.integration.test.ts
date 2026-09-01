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
    expect(run.body.data.network).toHaveLength(1);
    expect(run.body.data.network[0].protocol).toBe("FETCH");
    expect(run.body.data.network[0].method).toBe("GET");
    expect(run.body.data.network[0].statusHttp).toBe(200);
    expect(run.body.data.network[0].url).toContain("/sitio-a");
    expect(run.body.data.network[0].thirdPartyDomain).toBeUndefined();
    expect(typeof run.body.data.network[0].classificationLabel).toBe("string");
    expect(typeof run.body.data.network[0].classificationConfidence).toBe("number");
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

  it("registra third-party cuando hay redireccion con cambio de hostname", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E6-T03" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E6-T03" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["localhost", "127.0.0.1"],
        allowSubdomains: false,
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: `${labBaseUrl}/sitio-a/redirect-host-swap`
      });

    const localhostEntry = labBaseUrl.replace("127.0.0.1", "localhost");

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${localhostEntry}/sitio-a/redirect-host-swap`
      });

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${localhostEntry}/sitio-a/redirect-host-swap`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.network).toHaveLength(1);
    expect(run.body.data.network[0].statusHttp).toBe(200);
    expect(run.body.data.network[0].url).toContain("127.0.0.1");
    expect(run.body.data.network[0].thirdPartyDomain).toBe("127.0.0.1");
    expect(typeof run.body.data.network[0].classificationLabel).toBe("string");
  });

  it("registra cookies con metadatos enmascarados", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E6-T04" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E6-T04" });

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
        baseUrl: `${labBaseUrl}/sitio-a/storage-cookie`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`
      });

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-a/storage-cookie`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.storage).toHaveLength(2);
    expect(run.body.data.storage[0].kind).toBe("COOKIE");
    expect(run.body.data.storage[0].valueMasked).toBe(true);
    expect(run.body.data.storage[0].key).toBe("synthetic_session");
    expect(run.body.data.storage[0].valueEvidenceId).toBeUndefined();
    expect(run.body.data.storage[0].classificationLabel).toBe("AUTH_SECRET");
    expect(run.body.data.storage[1].key).toBe("synthetic_pref");
    expect(run.body.data.storage[1].valueMasked).toBe(true);
    expect(typeof run.body.data.storage[1].classificationLabel).toBe("string");
  });

  it("registra timeline SPA minimo con eventos y correlacion de red/storage", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E6-T05" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E6-T05" });

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
        baseUrl: `${labBaseUrl}/sitio-d`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-d`
      });

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-d`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.network.length).toBeGreaterThanOrEqual(4);

    const networkUrls = run.body.data.network.map((item: { url: string }) => item.url);
    expect(networkUrls.some((url: string) => url.includes("/sitio-d/spa/bootstrap"))).toBe(true);
    expect(networkUrls.some((url: string) => url.includes("/sitio-d/spa/navigate"))).toBe(true);
    expect(networkUrls.some((url: string) => url.includes("/sitio-d/api/profile"))).toBe(true);

    const eventTypes = run.body.data.events.map((event: { eventType: string }) => event.eventType);
    expect(eventTypes).toContain("PAGE_LOAD");
    expect(eventTypes).toContain("CLICK");
    expect(eventTypes).toContain("SPA_NAVIGATION");

    const localStorageKeys = run.body.data.storage
      .filter((item: { kind: string }) => item.kind === "LOCAL_STORAGE")
      .map((item: { key: string }) => item.key);

    expect(localStorageKeys).toContain("synthetic_spa_boot");
    expect(localStorageKeys).toContain("synthetic_spa_route");
    const localStorageMasked = run.body.data.storage
      .filter((item: { kind: string }) => item.kind === "LOCAL_STORAGE")
      .every((item: { valueMasked: boolean }) => item.valueMasked === true);
    expect(localStorageMasked).toBe(true);

    const localStorageHasClassification = run.body.data.storage
      .filter((item: { kind: string }) => item.kind === "LOCAL_STORAGE")
      .every((item: { classificationLabel?: string }) => typeof item.classificationLabel === "string");
    expect(localStorageHasClassification).toBe(true);
  });

  it("publica consentimiento COMPLIANT para sitio B", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E8-T03-B" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E8-T03-B" });

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
        baseUrl: `${labBaseUrl}/sitio-b`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-b`
      });

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-b`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.consentEvaluation?.status).toBe("COMPLIANT");
    expect(run.body.data.consentEvaluation?.code).toBe("BASELINE_OK");
  });

  it("publica consentimiento DEFECTIVE para sitio C", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E8-T03-C" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E8-T03-C" });

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
        baseUrl: `${labBaseUrl}/sitio-c`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "SCAN_PASSIVE",
        entryUrl: `${labBaseUrl}/sitio-c`
      });

    const run = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({
        executionId: execution.body.data.id,
        entryUrl: `${labBaseUrl}/sitio-c`,
        timeoutMs: 10000
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.consentEvaluation?.status).toBe("DEFECTIVE");
    expect(run.body.data.consentEvaluation?.code).toBe("TRACKING_BEFORE_CONSENT");
  });
});
