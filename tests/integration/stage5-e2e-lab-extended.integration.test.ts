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

async function setupExecution(input?: { excludedPaths?: string[] }): Promise<{ executionId: string }> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org T05 Extended" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T05 Extended" });

  const authorization = await request(app)
    .post("/api/v1/authorizations")
    .send({
      projectId: project.body.data.id,
      validFrom: isoNowPlus(-60),
      validTo: isoNowPlus(60),
      allowedDomains: ["127.0.0.1"],
      allowSubdomains: false,
      excludedPaths: input?.excludedPaths,
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

type Scenario = {
  name: string;
  entryPath: string;
  expectedStatus: number;
  expectedOk: boolean;
  expectedErrorCode?: string;
  expectedErrorMessage?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  excludedPaths?: string[];
};

const scenarios: Scenario[] = [
  {
    name: "exito",
    entryPath: "/sitio-a",
    expectedStatus: 200,
    expectedOk: true
  },
  {
    name: "fuera-de-alcance",
    entryPath: "/sitio-a/private/form",
    expectedStatus: 403,
    expectedOk: false,
    expectedErrorCode: "authorization_scope_rejected",
    expectedErrorMessage: "route_excluded_by_authorization",
    excludedPaths: ["/sitio-a/private"]
  },
  {
    name: "timeout",
    entryPath: "/sitio-a/slow-html",
    expectedStatus: 422,
    expectedOk: false,
    expectedErrorCode: "http_timeout",
    expectedErrorMessage: "http_timeout:request_timed_out",
    timeoutMs: 25
  },
  {
    name: "non-html",
    entryPath: "/sitio-a/non-html",
    expectedStatus: 422,
    expectedOk: false,
    expectedErrorCode: "http_non_html_content",
    expectedErrorMessage: "http_non_html_content:content_type_not_allowed"
  },
  {
    name: "size-limit",
    entryPath: "/sitio-a/large-html",
    expectedStatus: 422,
    expectedOk: false,
    expectedErrorCode: "response_size_limit_exceeded",
    expectedErrorMessage: "response_size_limit_exceeded:max_response_bytes_exceeded",
    maxResponseBytes: 128
  }
];

describe("Etapa 5.2 T05 E2E laboratorio ampliada", () => {
  it.each(scenarios)("matriz escenario $name", async (scenario) => {
    const { executionId } = await setupExecution({ excludedPaths: scenario.excludedPaths });

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}${scenario.entryPath}`,
        timeoutMs: scenario.timeoutMs,
        maxResponseBytes: scenario.maxResponseBytes
      });

    expect(run.status).toBe(scenario.expectedStatus);

    if (scenario.expectedOk) {
      expect(run.body.ok).toBe(true);
      expect(run.body.data.executionId).toBe(executionId);
      expect(run.body.data.statusHttp).toBe(200);
      expect(run.body.data.evidenceId).toBeTypeOf("string");
    } else {
      expect(run.body.errorCode).toBe(scenario.expectedErrorCode);
      if (scenario.expectedErrorMessage) {
        expect(run.body.message).toContain(scenario.expectedErrorMessage);
      }
    }

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(scenario.expectedOk);

    if (scenario.expectedOk) {
      expect(result.body.data.executionId).toBe(executionId);
      expect(result.body.data.entryUrl).toBe(`${labBaseUrl}${scenario.entryPath}`);
      expect(result.body.data.evidenceId).toBeTypeOf("string");
      expect(store.executions.get(executionId)?.state).toBe("COMPLETED");
      return;
    }

    expect(result.body.error.executionId).toBe(executionId);
    expect(result.body.error.errorCode).toBe(scenario.expectedErrorCode);
    if (scenario.expectedErrorMessage) {
      expect(result.body.error.message).toContain(scenario.expectedErrorMessage);
    }
    expect(store.executions.get(executionId)?.state).toBe("FAILED");
  });
});
