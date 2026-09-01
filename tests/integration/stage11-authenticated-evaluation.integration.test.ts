import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore, store } from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

beforeEach(async () => {
  resetStore();

  const labApp = buildLaboratoryServer();
  labServer = await new Promise<ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]>>((resolve, reject) => {
    const started = labApp.listen(0, "127.0.0.1", () => resolve(started));
    started.on("error", reject);
  });

  const address = labServer.address() as AddressInfo;
  labBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!labServer) {
      resolve();
      return;
    }

    labServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  labServer = undefined;
  labBaseUrl = "";
});

describe("Etapa 11 T01 evaluacion autenticada minima", () => {
  it("ejecuta login, consulta perfil, genera evidencia y cierra sesion", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E11-T01" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E11-T01" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["127.0.0.1"],
        allowSubdomains: false,
        permittedOperations: ["SCAN_PASSIVE", "AUTH_SYNTHETIC"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: `${labBaseUrl}/sitio-f`
      });

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "VALIDATED",
        operation: "AUTH_SYNTHETIC",
        entryUrl: `${labBaseUrl}/sitio-f`
      });

    const executionId = execution.body.data.id as string;

    const run = await request(app)
      .post("/api/v1/auth/evaluations/start")
      .send({
        executionId,
        entryUrl: `${labBaseUrl}/sitio-f`,
        username: "analista.synthetic",
        password: "synthetic-password",
        role: "cliente"
      });

    expect(run.status).toBe(200);
    expect(run.body.ok).toBe(true);
    expect(run.body.data.executionId).toBe(executionId);
    expect(run.body.data.profile.role).toBe("cliente");
    expect(run.body.data.profile.panel).toBe("cliente");
    expect(run.body.data.loggedOut).toBe(true);

    const evidence = store.evidences.get(run.body.data.evidenceId as string);
    expect(evidence?.kind).toBe("AUTH_SESSION_PROFILE");

    const finalExecution = store.executions.get(executionId);
    expect(finalExecution?.state).toBe("COMPLETED");
  });

  it("retorna 400 con executionId inexistente", async () => {
    const response = await request(app)
      .post("/api/v1/auth/evaluations/start")
      .send({
        executionId: "non-existent",
        entryUrl: `${labBaseUrl}/sitio-f`,
        username: "analista.synthetic",
        password: "synthetic-password",
        role: "cliente"
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.errorCode).toBe("invalid_execution_id");
  });
});
