import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";

describe("Etapa 2 chain", () => {
  beforeEach(() => {
    resetStore();
  });

  it("debe construir cadena Organization->Project->Authorization->Target->Execution->Page->Field->Observation->Evidence->Finding->ReviewDecision", async () => {
    const cid = "cid-stage2-1";

    const organization = await request(app).post("/api/v1/organizations").set("x-correlation-id", cid).send({ name: "Org A" });
    expect(organization.status).toBe(201);

    const project = await request(app)
      .post("/api/v1/projects")
      .set("x-correlation-id", cid)
      .send({ organizationId: organization.body.data.id, name: "Project A" });
    expect(project.status).toBe(201);

    const authorization = await request(app)
      .post("/api/v1/authorizations")
      .set("x-correlation-id", cid)
      .send({ projectId: project.body.data.id, validFrom: "2026-07-01T00:00:00.000Z", validTo: "2026-12-31T00:00:00.000Z" });
    expect(authorization.status).toBe(201);

    const target = await request(app)
      .post("/api/v1/targets")
      .set("x-correlation-id", cid)
      .send({ projectId: project.body.data.id, authorizationId: authorization.body.data.id, baseUrl: "https://example.local" });
    expect(target.status).toBe(201);

    const execution = await request(app)
      .post("/api/v1/executions")
      .set("x-correlation-id", cid)
      .send({ projectId: project.body.data.id, authorizationId: authorization.body.data.id, targetId: target.body.data.id });
    expect(execution.status).toBe(201);

    const page = await request(app)
      .post("/api/v1/pages")
      .set("x-correlation-id", cid)
      .send({ executionId: execution.body.data.id, url: "https://example.local/form", title: "Form" });
    expect(page.status).toBe(201);

    const field = await request(app)
      .post("/api/v1/form-fields")
      .set("x-correlation-id", cid)
      .send({ pageId: page.body.data.id, name: "email", type: "email", required: true });
    expect(field.status).toBe(201);

    const observation = await request(app)
      .post("/api/v1/observations")
      .set("x-correlation-id", cid)
      .send({
        executionId: execution.body.data.id,
        pageId: page.body.data.id,
        formFieldId: field.body.data.id,
        description: "Observed email field"
      });
    expect(observation.status).toBe(201);

    const evidence = await request(app)
      .post("/api/v1/evidences")
      .set("x-correlation-id", cid)
      .send({ executionId: execution.body.data.id, level: "E2", kind: "HTML", location: "s3://bucket/evidence-1" });
    expect(evidence.status).toBe(201);

    const finding = await request(app)
      .post("/api/v1/findings")
      .set("x-correlation-id", cid)
      .send({ projectId: project.body.data.id, summary: "Possible discrepancy", evidenceIds: [evidence.body.data.id] });
    expect(finding.status).toBe(201);

    const decision = await request(app)
      .post("/api/v1/review-decisions")
      .set("x-correlation-id", cid)
      .send({ findingId: finding.body.data.id, reviewState: "CONFIRMED", comment: "Reviewed by analyst" });
    expect(decision.status).toBe(201);

    expect(decision.headers["x-correlation-id"]).toBe(cid);
  });
});
