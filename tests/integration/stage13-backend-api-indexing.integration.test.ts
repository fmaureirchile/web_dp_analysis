import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";

let tempRepositoryPath = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function createExecution(): Promise<string> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E13-T01" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E13-T01" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e13-backend-api-index-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 13 T01 indexacion minima backend APIs", () => {
  it("indexa artefactos de API y permite consultar resultado", async () => {
    await mkdir(path.join(tempRepositoryPath, "docs", "contracts"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "graphql"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "packages", "contracts", "src"), { recursive: true });

    await writeFile(path.join(tempRepositoryPath, "docs", "contracts", "openapi.yaml"), "openapi: 3.0.0\ninfo:\n  title: Demo\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "apps", "api", "src", "routes", "user.routes.ts"), "export const routes = [];\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "apps", "api", "src", "graphql", "schema.graphql"), "type Query { ping: String }\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "packages", "contracts", "src", "user.dto.ts"), "export interface UserDto { id: string }\n", "utf8");

    const executionId = await createExecution();

    const start = await request(app).post("/api/v1/code-analysis/backend/api-index/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 100
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.executionId).toBe(executionId);
    expect(start.body.data.totalArtifacts).toBe(4);

    const typeCounts = new Map<string, number>((start.body.data.artifactTypeCounts as Array<{ artifactType: string; count: number }>).map((x) => [x.artifactType, x.count]));
    expect(typeCounts.get("OPENAPI")).toBe(1);
    expect(typeCounts.get("ROUTE")).toBe(1);
    expect(typeCounts.get("GRAPHQL")).toBe(1);
    expect(typeCounts.get("DTO")).toBe(1);

    const evidence = store.evidences.get(start.body.data.evidenceId as string);
    expect(evidence?.kind).toBe("BACKEND_API_INDEX_SUMMARY");

    const result = await request(app).get(`/api/v1/code-analysis/backend/api-index/${executionId}/result`);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.totalArtifacts).toBe(4);
  });

  it("retorna error cuando repositoryPath no existe", async () => {
    const executionId = await createExecution();

    const response = await request(app).post("/api/v1/code-analysis/backend/api-index/start").send({
      executionId,
      repositoryPath: path.join(tempRepositoryPath, "missing"),
      maxFiles: 50
    });

    expect(response.status).toBe(422);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("repository_path_not_found");
  });
});
