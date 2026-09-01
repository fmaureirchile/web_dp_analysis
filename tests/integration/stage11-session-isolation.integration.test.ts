import { type AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function createExecutionForRole(role: "cliente" | "supervisor"): Promise<string> {
  const org = await request(app).post("/api/v1/organizations").send({ name: `Org E11-T02 ${role}` });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: `Project E11-T02 ${role}` });

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

  return execution.body.data.id as string;
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

describe("Etapa 11 T02 aislamiento de sesiones por rol/ejecucion", () => {
  it("mantiene sesiones separadas entre ejecuciones con roles distintos", async () => {
    const executionCliente = await createExecutionForRole("cliente");
    const executionSupervisor = await createExecutionForRole("supervisor");

    const runCliente = await request(app)
      .post("/api/v1/auth/evaluations/start")
      .send({
        executionId: executionCliente,
        entryUrl: `${labBaseUrl}/sitio-f`,
        username: "analista.cliente",
        password: "synthetic-password",
        role: "cliente"
      });

    expect(runCliente.status).toBe(200);
    expect(runCliente.body.ok).toBe(true);
    expect(runCliente.body.data.profile.role).toBe("cliente");
    expect(runCliente.body.data.sessionScopeId).toBe(`${executionCliente}:cliente`);

    const statusSupervisorBefore = await fetch(`${labBaseUrl}/sitio-f/session/status?clientId=${executionSupervisor}:supervisor`);
    const statusSupervisorBeforePayload = (await statusSupervisorBefore.json()) as { session: { authenticated: boolean } };
    expect(statusSupervisorBeforePayload.session.authenticated).toBe(false);

    const runSupervisor = await request(app)
      .post("/api/v1/auth/evaluations/start")
      .send({
        executionId: executionSupervisor,
        entryUrl: `${labBaseUrl}/sitio-f`,
        username: "analista.supervisor",
        password: "synthetic-password",
        role: "supervisor"
      });

    expect(runSupervisor.status).toBe(200);
    expect(runSupervisor.body.ok).toBe(true);
    expect(runSupervisor.body.data.profile.role).toBe("supervisor");
    expect(runSupervisor.body.data.profile.panel).toBe("supervisor");
    expect(runSupervisor.body.data.sessionScopeId).toBe(`${executionSupervisor}:supervisor`);

    expect(runSupervisor.body.data.evidenceId).not.toBe(runCliente.body.data.evidenceId);

    const statusClienteAfter = await fetch(`${labBaseUrl}/sitio-f/session/status?clientId=${executionCliente}:cliente`);
    const statusClienteAfterPayload = (await statusClienteAfter.json()) as { session: { authenticated: boolean; lastAction: string } };
    expect(statusClienteAfterPayload.session.authenticated).toBe(false);
    expect(statusClienteAfterPayload.session.lastAction).toBe("logout");

    const statusSupervisorAfter = await fetch(`${labBaseUrl}/sitio-f/session/status?clientId=${executionSupervisor}:supervisor`);
    const statusSupervisorAfterPayload = (await statusSupervisorAfter.json()) as { session: { authenticated: boolean; lastAction: string } };
    expect(statusSupervisorAfterPayload.session.authenticated).toBe(false);
    expect(statusSupervisorAfterPayload.session.lastAction).toBe("logout");
  });
});
