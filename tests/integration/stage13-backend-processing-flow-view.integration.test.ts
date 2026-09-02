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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E13-T03" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E13-T03" });

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
      baseUrl: "http://127.0.0.1/api"
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl: "http://127.0.0.1/api"
    });

  return execution.body.data.id as string;
}

beforeEach(async () => {
  resetStore();
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e13-backend-flow-view-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 13 T03 vista minima API a procesamiento", () => {
  it("consolida artefactos API y detecciones de procesamiento por executionId", async () => {
    await mkdir(path.join(tempRepositoryPath, "docs", "contracts"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "services"), { recursive: true });

    await writeFile(path.join(tempRepositoryPath, "docs", "contracts", "openapi.yaml"), "openapi: 3.0.0\n", "utf8");
    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "routes", "users.routes.ts"),
      "import { usersService } from '../services/users.service';\nrouter.get('/users', () => usersService.list());\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "services", "users.service.ts"),
      "import { prisma } from '../db/prisma';\nexport const usersService = { list: () => prisma.user.findMany() };\n",
      "utf8"
    );

    const executionId = await createExecution();

    const apiIndex = await request(app).post("/api/v1/code-analysis/backend/api-index/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 100
    });
    expect(apiIndex.status).toBe(200);

    const processing = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 100,
      maxMatchesPerFile: 5
    });

    expect(processing.status).toBe(200);
    expect(processing.body.ok).toBe(true);

    const view = await request(app).get(`/api/v1/code-analysis/backend/processing-flow/${executionId}/view`);
    expect(view.status).toBe(200);
    expect(view.body.data.executionId).toBe(executionId);
    expect(view.body.data.totals.apiArtifacts).toBeGreaterThanOrEqual(2);
    expect(view.body.data.totals.filesWithProcessingMatches).toBeGreaterThanOrEqual(1);
    expect(view.body.data.totals.processingMatches).toBeGreaterThanOrEqual(2);
    expect(view.body.data.totals.distinctProcessingRules).toBeGreaterThanOrEqual(2);

    const byRule = view.body.data.byRule as Array<{ rule: string; matchCount: number; filesCount: number }>;
    expect(byRule.find((entry) => entry.rule === "ROUTE_HANDLER")?.matchCount).toBeGreaterThanOrEqual(1);
    expect(byRule.find((entry) => entry.rule === "SERVICE_USAGE")?.matchCount).toBeGreaterThanOrEqual(1);

    expect(view.body.data.evidenceIds.apiIndexEvidenceId).toBe(apiIndex.body.data.evidenceId);
    expect(view.body.data.evidenceIds.processingEvidenceId).toBe(processing.body.data.evidenceId);
  });

  it("retorna 422 cuando falta indexacion o deteccion previa", async () => {
    const executionId = await createExecution();
    const response = await request(app).get(`/api/v1/code-analysis/backend/processing-flow/${executionId}/view`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("backend_api_index_result_not_available");
  });
});
