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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E13-T02" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E13-T02" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e13-backend-processing-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 13 T02 deteccion inicial de procesamiento backend", () => {
  it("detecta controladores, servicios e integraciones asociadas a rutas", async () => {
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "controllers"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "apps", "api", "src", "services"), { recursive: true });

    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "routes", "users.routes.ts"),
      "import { usersController } from '../controllers/users.controller';\nimport { usersService } from '../services/users.service';\nrouter.get('/users', usersController.list);\nusersService.list();\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "controllers", "users.controller.ts"),
      "export const usersController = { list: () => ({ ok: true }) };\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRepositoryPath, "apps", "api", "src", "services", "users.service.ts"),
      "import { prisma } from '../db/prisma';\nexport const usersService = { list: () => prisma.user.findMany() };\n",
      "utf8"
    );

    const executionId = await createExecution();

    const start = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 100,
      maxMatchesPerFile: 5
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.executionId).toBe(executionId);
    expect(start.body.data.totalFilesScanned).toBeGreaterThanOrEqual(3);
    expect(start.body.data.totalFilesWithMatches).toBeGreaterThanOrEqual(2);
    expect(start.body.data.totalMatches).toBeGreaterThanOrEqual(4);

    const rules = (start.body.data.files as Array<{ matches: Array<{ rule: string }> }>).flatMap((f) => f.matches.map((m) => m.rule));
    expect(rules).toContain("ROUTE_HANDLER");
    expect(rules).toContain("CONTROLLER_USAGE");
    expect(rules).toContain("SERVICE_USAGE");
    expect(rules).toContain("INTEGRATION_USAGE");

    const evidence = store.evidences.get(start.body.data.evidenceId as string);
    expect(evidence?.kind).toBe("BACKEND_PROCESSING_SUMMARY");

    const result = await request(app).get(`/api/v1/code-analysis/backend/processing/${executionId}/result`);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(executionId);
  });

  it("retorna error cuando repositoryPath no existe", async () => {
    const executionId = await createExecution();

    const response = await request(app).post("/api/v1/code-analysis/backend/processing/start").send({
      executionId,
      repositoryPath: path.join(tempRepositoryPath, "missing"),
      maxFiles: 50,
      maxMatchesPerFile: 5
    });

    expect(response.status).toBe(422);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("repository_path_not_found");
  });
});
