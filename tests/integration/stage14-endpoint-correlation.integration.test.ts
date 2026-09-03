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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E14-T01" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E14-T01" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e14-endpoint-correlation-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 14 T01 correlacion inicial por endpoint", () => {
  it("correlaciona endpoint observado en frontend y backend", async () => {
    await mkdir(path.join(tempRepositoryPath, "apps", "web", "src"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "services"), { recursive: true });

    await writeFile(
      path.join(tempRepositoryPath, "apps", "web", "src", "client.ts"),
      "export async function loadUsers(){ return fetch('/users'); }\n",
      "utf8"
    );
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

    const frontend = await request(app).post("/api/v1/code-analysis/frontend/patterns/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200,
      maxMatchesPerFile: 5
    });
    expect(frontend.status).toBe(200);

    const backend = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 200,
      maxMatchesPerFile: 5
    });
    expect(backend.status).toBe(200);

    const correlation = await request(app).get(`/api/v1/lineage/correlations/${executionId}/by-endpoint`);

    expect(correlation.status).toBe(200);
    expect(correlation.body.data.executionId).toBe(executionId);
    expect(correlation.body.data.totals.correlatedEndpoints).toBeGreaterThanOrEqual(1);

    const usersLink = (correlation.body.data.correlations as Array<{ endpoint: string; status: string; confidence: number }>).find((item) => item.endpoint === "/users");
    expect(usersLink).toBeDefined();
    expect(usersLink?.status).toBe("INFERRED_HIGH");
    expect(usersLink?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("retorna 422 cuando faltan resultados previos", async () => {
    const executionId = await createExecution();
    const response = await request(app).get(`/api/v1/lineage/correlations/${executionId}/by-endpoint`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("frontend_pattern_detection_result_not_available");
  });
});
