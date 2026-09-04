import { promises as fs } from "node:fs";
import { type AddressInfo } from "node:net";
import path from "node:path";

import request from "supertest";

import { app } from "../apps/api/src/server";
import { resetStore, store } from "../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../test-lab/sites/lab-server";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function buildExecution(entryUrl: string): Promise<string> {
  const organization = await request(app).post("/api/v1/organizations").send({ name: `Org ${Math.random()}` });
  const project = await request(app)
    .post("/api/v1/projects")
    .send({ organizationId: organization.body.data.id, name: `Project ${Math.random()}` });

  const authorization = await request(app)
    .post("/api/v1/authorizations")
    .send({
      projectId: project.body.data.id,
      validFrom: isoNowPlus(-60),
      validTo: isoNowPlus(60),
      allowedDomains: ["127.0.0.1", "localhost"],
      allowSubdomains: false,
      permittedOperations: ["SCAN_PASSIVE"]
    });

  const target = await request(app)
    .post("/api/v1/targets")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      baseUrl: entryUrl
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl
    });

  return execution.body.data.id as string;
}

async function main(): Promise<void> {
  resetStore();

  const labApp = buildLaboratoryServer();
  const labServer = await new Promise<ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]>>((resolve, reject) => {
    const started = labApp.listen(0, "127.0.0.1", () => resolve(started));
    started.on("error", reject);
  });

  try {
    const address = labServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const baselineExecutionId = await buildExecution(`${baseUrl}/sitio-a/storage-cookie`);
    const currentExecutionId = await buildExecution(`${baseUrl}/sitio-d`);
    const retentionExecutionId = await buildExecution(`${baseUrl}/sitio-a/storage-cookie`);

    const baselineRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: baselineExecutionId, entryUrl: `${baseUrl}/sitio-a/storage-cookie`, timeoutMs: 10000 });

    const currentRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: currentExecutionId, entryUrl: `${baseUrl}/sitio-d`, timeoutMs: 10000 });

    const retentionRun = await request(app)
      .post("/api/v1/browser/observations/start")
      .send({ executionId: retentionExecutionId, entryUrl: `${baseUrl}/sitio-a/storage-cookie`, timeoutMs: 10000 });

    const comparison = await request(app)
      .post("/api/v1/monitoring/version-comparisons/start")
      .send({ baselineExecutionId, currentExecutionId });

    const purge = await request(app).post(`/api/v1/privacy/executions/${currentExecutionId}/purge`).send({});

    const retentionExecution = store.executions.get(retentionExecutionId);
    if (retentionExecution) {
      store.executions.set(retentionExecutionId, {
        ...retentionExecution,
        updatedAt: new Date(Date.now() - 120 * 60_000).toISOString()
      });
    }

    const retention = await request(app).post("/api/v1/privacy/retention/apply").send({
      windowMinutes: 60,
      states: ["COMPLETED", "FAILED"]
    });

    const evidence = {
      executedAt: new Date().toISOString(),
      baseUrl,
      executionIds: {
        baselineExecutionId,
        currentExecutionId,
        retentionExecutionId
      },
      status: {
        baselineRun: baselineRun.status,
        currentRun: currentRun.status,
        retentionRun: retentionRun.status,
        comparison: comparison.status,
        purge: purge.status,
        retention: retention.status
      },
      comparisonSummary: {
        ok: comparison.body.ok,
        changes: comparison.body.data?.totals?.changes,
        newEndpoints: comparison.body.data?.totals?.newEndpoints,
        alert: comparison.body.data?.alert
      },
      purgeSummary: {
        ok: purge.body.ok,
        deletedCounts: purge.body.data?.deletedCounts
      },
      retentionSummary: {
        ok: retention.body.ok,
        candidateExecutions: retention.body.data?.candidateExecutions,
        purgedExecutions: retention.body.data?.purgedExecutions,
        deletedTotals: retention.body.data?.deletedTotals
      }
    };

    const outputDir = path.join(process.cwd(), "docs", "etapa-17", "evidencias");
    await fs.mkdir(outputDir, { recursive: true });
    const dateToken = new Date().toISOString().slice(0, 10);
    const outputPath = path.join(outputDir, `piloto-e2e-controlado-${dateToken}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    process.stdout.write(`[pilot:e2e:stage17] OK\n`);
    process.stdout.write(`evidence_file=${outputPath}\n`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      labServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

main().catch((error) => {
  process.stderr.write(`[pilot:e2e:stage17] FAIL ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
