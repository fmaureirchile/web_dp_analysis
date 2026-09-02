import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import request from "supertest";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";

let tempRepositoryPath = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function createExecution(): Promise<string> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org E12-T01" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E12-T01" });

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
  tempRepositoryPath = await mkdtemp(path.join(tmpdir(), "e12-frontend-index-"));
});

afterEach(async () => {
  if (tempRepositoryPath) {
    await rm(tempRepositoryPath, { recursive: true, force: true });
  }
  tempRepositoryPath = "";
});

describe("Etapa 12 T01 indexacion frontend minima", () => {
  it("indexa repositorio frontend y permite consultar resultado por executionId", async () => {
    await writeFile(
      path.join(tempRepositoryPath, "package.json"),
      JSON.stringify({ name: "frontend-sample", dependencies: { react: "18.3.0" } }, null, 2),
      "utf8"
    );

    await mkdir(path.join(tempRepositoryPath, "src"), { recursive: true });
    await mkdir(path.join(tempRepositoryPath, "public"), { recursive: true });

    await writeFile(path.join(tempRepositoryPath, "src", "App.tsx"), "export function App() { return <div>Hello</div>; }\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "src", "main.ts"), "console.log('main');\n", "utf8");
    await writeFile(path.join(tempRepositoryPath, "public", "index.html"), "<html><body>ok</body></html>\n", "utf8");

    const executionId = await createExecution();

    const start = await request(app).post("/api/v1/code-analysis/frontend/index/start").send({
      executionId,
      repositoryPath: tempRepositoryPath,
      maxFiles: 50
    });

    expect(start.status).toBe(200);
    expect(start.body.ok).toBe(true);
    expect(start.body.data.executionId).toBe(executionId);
    expect(start.body.data.framework).toBe("REACT");
    expect(start.body.data.totalFiles).toBe(3);

    const samplePaths = (start.body.data.sampleFiles as Array<{ relativePath: string }>).map((item) => item.relativePath);
    expect(samplePaths).toContain("src/App.tsx");
    expect(samplePaths).toContain("src/main.ts");
    expect(samplePaths).toContain("public/index.html");

    const evidence = store.evidences.get(start.body.data.evidenceId as string);
    expect(evidence?.kind).toBe("FRONTEND_INDEX_SUMMARY");

    const result = await request(app).get(`/api/v1/code-analysis/frontend/index/${executionId}/result`);
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.executionId).toBe(executionId);
    expect(result.body.data.totalFiles).toBe(3);
  });

  it("retorna error cuando repositoryPath no existe", async () => {
    const executionId = await createExecution();
    const response = await request(app).post("/api/v1/code-analysis/frontend/index/start").send({
      executionId,
      repositoryPath: path.join(tempRepositoryPath, "missing"),
      maxFiles: 50
    });

    expect(response.status).toBe(422);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("repository_path_not_found");
  });
});
