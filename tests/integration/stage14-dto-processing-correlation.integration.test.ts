import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";

let tempRepositoryPath = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function createExecution(): Promise<string> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E14-T02" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E14-T02" });

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
      baseUrl: "http://127.0.0.1/app"
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl: "http://127.0.0.1/app"
    });

  return execution.body.data.id as string;
}

beforeEach(async () => {
  resetStore();
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e14-dto-processing-correlation-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 14 T02 correlacion inicial DTO/procesamiento", () => {
  it("enlaza artefacto DTO con evidencias de procesamiento backend", async () => {
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "contracts"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "controllers"), { recursive: true });

    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "contracts", "user-profile.dto.ts"),
      "export interface UserProfileDto { id: string; email: string; }\n",
      "utf8"
    );

    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "controllers", "user.controller.ts"),
      "type UserProfileDto = { id: string };\nexport const controller = { map: (input: UserProfileDto) => input };\n",
      "utf8"
    );

    const executionId = await createExecution();

    const apiIndex = await request(app).post("/api/v1/code-analysis/backend/api-index/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200
    });
    expect(apiIndex.status).toBe(200);

    const backend = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200,
      maxMatchesPerFile: 5
    });
    expect(backend.status).toBe(200);

    const correlation = await request(app).get(`/api/v1/lineage/correlations/${executionId}/by-dto-processing`);

    expect(correlation.status).toBe(200);
    expect(correlation.body.data.executionId).toBe(executionId);
    expect(correlation.body.data.totals.dtoArtifacts).toBeGreaterThanOrEqual(1);

    const dtoLink = (correlation.body.data.correlations as Array<{
      dto: { relativePath: string };
      status: string;
      confidence: number;
      processingReferences: Array<unknown>;
    }>).find((item) => item.dto.relativePath.endsWith("user-profile.dto.ts"));

    expect(dtoLink).toBeDefined();
    expect(dtoLink?.status).toBe("INFERRED_HIGH");
    expect(dtoLink?.confidence).toBeGreaterThanOrEqual(0.7);
    expect(dtoLink?.processingReferences.length).toBeGreaterThanOrEqual(1);
  });

  it("retorna 422 cuando falta indexacion backend", async () => {
    const executionId = await createExecution();
    const response = await request(app).get(`/api/v1/lineage/correlations/${executionId}/by-dto-processing`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("backend_api_index_result_not_available");
  });
});
