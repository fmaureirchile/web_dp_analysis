import { type AddressInfo } from "node:net";
import { createServer } from "node:http";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import {
  listCrawlerOperationalEventsByExecutionId,
  resetStore
} from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function getUnusedLocalBaseUrl(): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(204);
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  return baseUrl;
}

function expectMinimalOperationalEventShape(
  event: {
    executionId: string;
    correlationId: string;
    event: string;
    timestamp: string;
    detail?: string;
  },
  expected: { executionId: string; correlationId: string }
): void {
  expect(Object.prototype.hasOwnProperty.call(event, "executionId")).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(event, "correlationId")).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(event, "event")).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(event, "timestamp")).toBe(true);

  expect(event.executionId).toBe(expected.executionId);
  expect(event.correlationId).toBe(expected.correlationId);

  expect(event.event).toBeTypeOf("string");
  expect(event.event.length).toBeGreaterThan(0);

  expect(event.timestamp).toBeTypeOf("string");
  expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);

  if (event.detail !== undefined) {
    expect(event.detail).toBeTypeOf("string");
  }
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

    const events = listCrawlerOperationalEventsByExecutionId(executionId);

    expect(events.length).toBeGreaterThanOrEqual(2);
    events.forEach((event) => expectMinimalOperationalEventShape(event, { executionId, correlationId: correlation }));
    expect(events.map((event) => event.event)).toEqual(["crawl_started", "crawl_result_success"]);
    expect(events[0].detail).toBe(`${labBaseUrl}/sitio-a`);
    expect(events[1].detail).toBeTypeOf("string");
    expect(events[1].detail?.length).toBeGreaterThan(0);
    expect(Date.parse(events[0].timestamp)).toBeLessThanOrEqual(Date.parse(events[1].timestamp));
    expect(events.every((event) => event.correlationId === correlation)).toBe(true);
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

    const events = listCrawlerOperationalEventsByExecutionId(executionId);

    expect(events.length).toBeGreaterThanOrEqual(2);
    events.forEach((event) => expectMinimalOperationalEventShape(event, { executionId, correlationId: correlation }));
    expect(events.map((event) => event.event)).toEqual(["crawl_started", "crawl_result_error"]);
    expect(events[0].detail).toBe(`${labBaseUrl}/sitio-a/non-html`);
    expect(events[1].detail).toBe("http_non_html_content");
    expect(Date.parse(events[0].timestamp)).toBeLessThanOrEqual(Date.parse(events[1].timestamp));
    expect(events.every((event) => event.correlationId === correlation)).toBe(true);
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

    const firstEvents = listCrawlerOperationalEventsByExecutionId(first.executionId);
    const secondEvents = listCrawlerOperationalEventsByExecutionId(second.executionId);

    expect(firstEvents.length).toBeGreaterThanOrEqual(2);
    expect(secondEvents.length).toBeGreaterThanOrEqual(2);

    expect(firstEvents.every((entry) => entry.executionId === first.executionId)).toBe(true);
    expect(secondEvents.every((entry) => entry.executionId === second.executionId)).toBe(true);

    expect(firstEvents.every((entry) => entry.correlationId === "corr-t06-iso-001")).toBe(true);
    expect(secondEvents.every((entry) => entry.correlationId === "corr-t06-iso-002")).toBe(true);
  });

  it("mantiene taxonomia detail/errorCode por tipo de error", async () => {
    const unreachableBaseUrl = await getUnusedLocalBaseUrl();

    const cases: Array<{
      name: string;
      entryUrl: string;
      expectedStatus: number;
      expectedErrorCode: string;
      expectedEvents: string[];
    }> = [
      {
        name: "non_html",
        entryUrl: `${labBaseUrl}/sitio-a/non-html`,
        expectedStatus: 422,
        expectedErrorCode: "http_non_html_content",
        expectedEvents: ["crawl_started", "crawl_result_error"]
      },
      {
        name: "fetch_failed",
        entryUrl: `${unreachableBaseUrl}/downstream`,
        expectedStatus: 422,
        expectedErrorCode: "http_fetch_failed",
        expectedEvents: ["crawl_started", "crawl_result_error"]
      },
      {
        name: "invalid_entry_url",
        entryUrl: "ftp://127.0.0.1/recurso",
        expectedStatus: 400,
        expectedErrorCode: "invalid_entry_url",
        expectedEvents: ["crawl_result_error"]
      }
    ];

    const allowedErrorCodes = new Set([
      "authorization_scope_rejected",
      "invalid_entry_url",
      "http_timeout",
      "http_non_html_content",
      "http_fetch_failed",
      "response_size_limit_exceeded",
      "internal_error"
    ]);

    for (const testCase of cases) {
      const { executionId } = await setupExecution();
      const correlation = `corr-t06-tax-${testCase.name}`;

      const run = await request(app)
        .post("/api/v1/crawler/passive/single-page")
        .set("x-correlation-id", correlation)
        .send({
          executionId,
          entryUrl: testCase.entryUrl
        });

      expect(run.status).toBe(testCase.expectedStatus);
      expect(run.body.errorCode).toBe(testCase.expectedErrorCode);

      const events = listCrawlerOperationalEventsByExecutionId(executionId);
      expect(events.map((event) => event.event)).toEqual(testCase.expectedEvents);
      const errorEvent = events[events.length - 1];
      expect(errorEvent.detail).toBe(testCase.expectedErrorCode);
      expect(allowedErrorCodes.has(String(errorEvent.detail))).toBe(true);
      expect(events.every((event) => event.correlationId === correlation)).toBe(true);
    }
  });
});
