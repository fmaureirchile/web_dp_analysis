import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

describe("Etapa 3 safeguards", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rechaza dominios no autorizados al crear target", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org B" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project B" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        excludedPaths: ["/private"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    expect(authorization.status).toBe(201);

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://outside.local/form"
      });

    expect(target.status).toBe(400);
    expect(target.body.error).toBe("domain_not_authorized");
  });

  it("rechaza rutas excluidas y redireccion fuera de alcance", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org C" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project C" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        excludedPaths: ["/admin"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const deniedTarget = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/admin/panel"
      });

    expect(deniedTarget.status).toBe(400);
    expect(deniedTarget.body.error).toBe("route_excluded_by_authorization");

    const allowedTarget = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/form"
      });

    expect(allowedTarget.status).toBe(201);

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: allowedTarget.body.data.id,
        operation: "SCAN_PASSIVE",
        entryUrl: "https://example.local/form",
        redirectUrl: "https://redirected.local/landing"
      });

    expect(execution.status).toBe(400);
    expect(execution.body.error).toBe("redirect_out_of_scope");
  });

  it("rechaza ejecuciones fuera de vigencia o sin autorizacion", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org D" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project D" });

    const expiredAuthorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-120),
        validTo: isoNowPlus(-60),
        allowedDomains: ["example.local"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: expiredAuthorization.body.data.id,
        baseUrl: "https://example.local/form"
      });

    expect(target.status).toBe(201);

    const expiredExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: expiredAuthorization.body.data.id,
        targetId: target.body.data.id,
        operation: "SCAN_PASSIVE",
        entryUrl: "https://example.local/form"
      });

    expect(expiredExecution.status).toBe(400);
    expect(expiredExecution.body.error).toBe("authorization_out_of_validity");

    const noAuthorizationExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: "missing-authorization",
        targetId: target.body.data.id,
        operation: "SCAN_PASSIVE"
      });

    expect(noAuthorizationExecution.status).toBe(400);
    expect(noAuthorizationExecution.body.error).toBe("authorization_id_not_found");
  });

  it("permite kill switch y simulacion de alcance", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org E" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project E" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        permittedOperations: ["SCAN_PASSIVE"]
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/form"
      });

    expect(target.status).toBe(201);

    const simulation = await request(app)
      .post("/api/v1/scope/simulations")
      .send({
        authorizationId: authorization.body.data.id,
        url: "https://not-allowed.local/form",
        operation: "SCAN_PASSIVE"
      });

    expect(simulation.status).toBe(200);
    expect(simulation.body.data.allowed).toBe(false);
    expect(simulation.body.data.reasons).toContain("domain_not_authorized");

    const toggle = await request(app)
      .post(`/api/v1/authorizations/${authorization.body.data.id}/kill-switch`)
      .send({ active: true });

    expect(toggle.status).toBe(201);
    expect(toggle.body.data.killSwitchActive).toBe(true);

    const execution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        operation: "SCAN_PASSIVE"
      });

    expect(execution.status).toBe(400);
    expect(execution.body.error).toBe("kill_switch_active");
  });

  it("aplica concurrencia solo sobre ejecuciones queued o running", async () => {
    const org = await request(app).post("/api/v1/organizations").send({ name: "Org F" });
    const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project F" });

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .send({
        projectId: project.body.data.id,
        validFrom: isoNowPlus(-60),
        validTo: isoNowPlus(60),
        allowedDomains: ["example.local"],
        permittedOperations: ["SCAN_PASSIVE"],
        maxConcurrentExecutions: 1
      });

    const target = await request(app)
      .post("/api/v1/targets")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        baseUrl: "https://example.local/form"
      });

    expect(target.status).toBe(201);

    const draftExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "DRAFT",
        operation: "SCAN_PASSIVE"
      });

    expect(draftExecution.status).toBe(201);

    const runningExecution = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "RUNNING",
        operation: "SCAN_PASSIVE"
      });

    expect(runningExecution.status).toBe(201);

    const blockedByConcurrency = await request(app)
      .post("/api/v1/executions")
      .send({
        projectId: project.body.data.id,
        authorizationId: authorization.body.data.id,
        targetId: target.body.data.id,
        state: "QUEUED",
        operation: "SCAN_PASSIVE"
      });

    expect(blockedByConcurrency.status).toBe(400);
    expect(blockedByConcurrency.body.error).toBe("concurrency_limit_exceeded");
  });
});
