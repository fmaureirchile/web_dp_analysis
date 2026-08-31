import fs from "node:fs";
import path from "node:path";
import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

type FailureMatrixFixture = {
  scenarioId: string;
  stage: string;
  site: string;
  request: {
    entryPath: string;
    timeoutMs?: number;
    maxResponseBytes?: number;
  };
  expected: {
    status: number;
    ok: boolean;
    errorCode: string;
    messageContains: string;
  };
  manifestRef: string;
};

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function loadFailureFixtures(): FailureMatrixFixture[] {
  const fixturesDir = path.join(
    __dirname,
    "..",
    "..",
    "test-lab",
    "fixtures",
    "stage5-fetch-failure-matrix"
  );

  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((fileName) => fileName.endsWith(".fixture.json"))
    .sort((a, b) => a.localeCompare(b));

  return fixtureFiles.map((fileName) => {
    const fullPath = path.join(fixturesDir, fileName);
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(content) as FailureMatrixFixture;
  });
}

async function setupExecution(): Promise<{ executionId: string }> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org T05 Fixture Matrix" });
  const project = await request(app)
    .post("/api/v1/projects")
    .send({ organizationId: org.body.data.id, name: "Project T05 Fixture Matrix" });

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

describe("Etapa 5.5 T03 matriz E2E laboratorio desde fixtures", () => {
  const fixtures = loadFailureFixtures();

  it.each(fixtures)("$scenarioId -> $request.entryPath", async (fixture) => {
    const { executionId } = await setupExecution();

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}${fixture.request.entryPath}`,
        timeoutMs: fixture.request.timeoutMs,
        maxResponseBytes: fixture.request.maxResponseBytes
      });

    expect(run.status).toBe(fixture.expected.status);
    expect(run.body.errorCode).toBe(fixture.expected.errorCode);
    expect(run.body.message).toContain(fixture.expected.messageContains);

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(fixture.expected.ok);
    expect(result.body.error.executionId).toBe(executionId);
    expect(result.body.error.errorCode).toBe(fixture.expected.errorCode);
    expect(result.body.error.message).toContain(fixture.expected.messageContains);
    expect(store.executions.get(executionId)?.state).toBe("FAILED");
  });
});
