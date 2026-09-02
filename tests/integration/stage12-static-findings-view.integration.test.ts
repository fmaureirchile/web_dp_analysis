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
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E12-T03" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E12-T03" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e12-static-findings-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 12 T03 vista de hallazgos estaticos", () => {
  it("construye resumen consolidado por regla y archivo", async () => {
    await mkdir(path.join(tempRepositoryPath, "src"), { recursive: true });
    await writeFile(path.join(tempRepositoryPath, "src", "a.ts"), "fetch('/a'); document.cookie='a=1';\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "src", "b.tsx"), "export const B = () => <input onChange={() => localStorage.setItem('k','v')} />;\n", "utf8");

    const executionId = await createExecution();

    const detect = await request(app).post("/api/v1/code-analysis/frontend/patterns/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 50,
      maxMatchesPerFile: 5
    });

    expect(detect.status).toBe(200);
    expect(detect.body.ok).toBe(true);

    const view = await request(app).get(`/api/v1/code-analysis/frontend/findings/${executionId}/view`);

    expect(view.status).toBe(200);
    expect(view.body.data.executionId).toBe(executionId);
    expect(view.body.data.totals.scannedFiles).toBe(2);
    expect(view.body.data.totals.filesWithMatches).toBe(2);
    expect(view.body.data.totals.matches).toBeGreaterThanOrEqual(4);
    expect(view.body.data.totals.distinctRules).toBeGreaterThanOrEqual(4);

    const byRule = view.body.data.byRule as Array<{ rule: string; matchCount: number; filesCount: number }>;
    expect(byRule.find((item) => item.rule === "NETWORK_FETCH")?.matchCount).toBeGreaterThanOrEqual(1);
    expect(byRule.find((item) => item.rule === "COOKIE_ACCESS")?.matchCount).toBeGreaterThanOrEqual(1);
    expect(byRule.find((item) => item.rule === "FORM_INPUT")?.matchCount).toBeGreaterThanOrEqual(1);
    expect(byRule.find((item) => item.rule === "STORAGE_ACCESS")?.matchCount).toBeGreaterThanOrEqual(1);

    const files = view.body.data.files as Array<{ relativePath: string; matchCount: number; rules: string[] }>;
    expect(files).toHaveLength(2);
    expect(files[0].relativePath).toBe("src/a.ts");
    expect(files[1].relativePath).toBe("src/b.tsx");
  });

  it("retorna 422 cuando no existe resultado de deteccion", async () => {
    const executionId = await createExecution();
    const response = await request(app).get(`/api/v1/code-analysis/frontend/findings/${executionId}/view`);

    expect(response.status).toBe(422);
    expect(response.body.error).toBe("frontend_pattern_detection_result_not_available");
  });
});
