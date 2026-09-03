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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E14-T03" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E14-T03" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e14-lineage-consolidated-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 14 T03 vista minima de linaje consolidado", () => {
  it("expone nodos y aristas preliminares por executionId", async () => {
    await mkdir(path.join(tempRepositoryPath, "apps", "web", "src"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "contracts"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "controllers"), { recursive: true });

    await writeFile(path.join(tempRepositoryPath, "apps", "web", "src", "client.ts"), "export async function loadUsers(){ return fetch('/users'); }\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "apps", "api", "src", "routes", "users.routes.ts"), "router.get('/users', () => controller.list());\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "apps", "api", "src", "contracts", "user-profile.dto.ts"), "export interface UserProfileDto { id: string; }\n", "utf8");
    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "controllers", "user.controller.ts"),
      "type UserProfileDto = { id: string };\nexport const controller = { map: (input: UserProfileDto) => input };\n",
      "utf8"
    );

    const executionId = await createExecution();

    const frontend = await request(app).post("/api/v1/code-analysis/frontend/patterns/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200,
      maxMatchesPerFile: 5
    });
    expect(frontend.status).toBe(200);

    const apiIndex = await request(app).post("/api/v1/code-analysis/backend/api-index/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200
    });
    expect(apiIndex.status).toBe(200);

    const processing = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200,
      maxMatchesPerFile: 5
    });
    expect(processing.status).toBe(200);

    const response = await request(app).get(`/api/v1/lineage/views/${executionId}/consolidated`);

    expect(response.status).toBe(200);
    expect(response.body.data.executionId).toBe(executionId);
    expect(response.body.data.totals.nodes).toBeGreaterThanOrEqual(3);
    expect(response.body.data.totals.edges).toBeGreaterThanOrEqual(2);

    const endpointEdge = (response.body.data.edges as Array<{ type: string }>).find((edge) => edge.type === "CALLS_ENDPOINT");
    expect(endpointEdge).toBeDefined();

    const dtoEdge = (response.body.data.edges as Array<{ type: string }>).find((edge) => edge.type === "MAPPED_TO_PROCESSING");
    expect(dtoEdge).toBeDefined();
  });

  it("retorna 422 cuando faltan resultados previos", async () => {
    const executionId = await createExecution();
    const response = await request(app).get(`/api/v1/lineage/views/${executionId}/consolidated`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("frontend_pattern_detection_result_not_available");
  });
});
