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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E12-T02" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E12-T02" });

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
      baseUrl: "http://127.0.0.1/sitio-a"
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl: "http://127.0.0.1/sitio-a"
    });

  return execution.body.data.id as string;
}

beforeEach(async () => {
  resetStore();
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e12-frontend-pattern-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 12 T02 deteccion inicial de patrones", () => {
  it("detecta patrones basicos por archivo y permite consultar resultado", async () => {
    await mkdir(path.join(tempRepositoryPath, "src"), { recursive: true });
    await writeFile(
      path.join(tempRepositoryPath, "src", "tracking.ts"),
      "export function track(){ fetch('/collect'); navigator.sendBeacon('/beacon', 'ok'); }\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRepositoryPath, "src", "form.tsx"),
      "export function Form(){ return <input name='email' onChange={() => localStorage.setItem('k','v')} /> }\n",
      "utf8"
    );
    await writeFile(path.join(tempRepositoryPath, "src", "cookie.js"), "document.cookie = 'id=123';\n", "utf8");

    const executionId = await createExecution();

    const start = await request(app).post("/api/v1/code-analysis/frontend/patterns/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 50,
      maxMatchesPerFile: 5
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.executionId).toBe(executionId);
    expect(start.body.data.totalFilesScanned).toBe(3);
    expect(start.body.data.totalFilesWithMatches).toBe(3);
    expect(start.body.data.totalMatches).toBeGreaterThanOrEqual(5);

    const allRules = (start.body.data.files as Array<{ matches: Array<{ rule: string }> }>)
      .flatMap((file) => file.matches.map((match) => match.rule));

    expect(allRules).toContain("FORM_INPUT");
    expect(allRules).toContain("NETWORK_FETCH");
    expect(allRules).toContain("COOKIE_ACCESS");
    expect(allRules).toContain("STORAGE_ACCESS");
    expect(allRules).toContain("ANALYTICS_BEACON");

    const evidence = store.evidences.get(start.body.data.evidenceId as string);
    expect(evidence?.kind).toBe("FRONTEND_PATTERN_SUMMARY");

    const result = await request(app).get(`/api/v1/code-analysis/frontend/patterns/${executionId}/result`);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(executionId);
    expect(result.body.data.totalFilesWithMatches).toBe(3);
  });

  it("retorna error cuando repositoryPath no existe", async () => {
    const executionId = await createExecution();

    const response = await request(app).post("/api/v1/code-analysis/frontend/patterns/start").send({
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
