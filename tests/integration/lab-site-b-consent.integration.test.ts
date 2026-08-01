import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - Sitio B consentimiento correcto", () => {
  const app = buildLaboratoryServer();
  const clientId = "integration-site-b-client";

  it("inicia con analitica desactivada", async () => {
    const status = await request(app).get("/sitio-b/consent/status").set("x-synthetic-client-id", clientId);

    expect(status.status).toBe(200);
    expect(status.body.consent.necessary).toBe(true);
    expect(status.body.consent.analytics).toBe(false);
    expect(status.body.consent.marketing).toBe(false);
    expect(status.body.consent.lastAction).toBe("initial");
  });

  it("aceptar habilita analitica y marketing", async () => {
    const accept = await request(app)
      .post("/sitio-b/consent/action")
      .set("x-synthetic-client-id", clientId)
      .send({ action: "accept_all" });

    expect(accept.status).toBe(200);
    expect(accept.body.consent.analytics).toBe(true);
    expect(accept.body.consent.marketing).toBe(true);
    expect(accept.body.consent.lastAction).toBe("accept_all");
  });

  it("rechazar desactiva analitica y marketing", async () => {
    const rejectAll = await request(app)
      .post("/sitio-b/consent/action")
      .set("x-synthetic-client-id", clientId)
      .send({ action: "reject_all" });

    expect(rejectAll.status).toBe(200);
    expect(rejectAll.body.consent.analytics).toBe(false);
    expect(rejectAll.body.consent.marketing).toBe(false);
    expect(rejectAll.body.consent.lastAction).toBe("reject_all");
  });

  it("personalizar respeta categorias enviadas", async () => {
    const customize = await request(app)
      .post("/sitio-b/consent/action")
      .set("x-synthetic-client-id", clientId)
      .send({ action: "customize", categories: { analytics: true, marketing: false } });

    expect(customize.status).toBe(200);
    expect(customize.body.consent.analytics).toBe(true);
    expect(customize.body.consent.marketing).toBe(false);
    expect(customize.body.consent.lastAction).toBe("customize");
  });

  it("revocar restablece preferencias no necesarias", async () => {
    const revoke = await request(app)
      .post("/sitio-b/consent/action")
      .set("x-synthetic-client-id", clientId)
      .send({ action: "revoke" });

    expect(revoke.status).toBe(200);
    expect(revoke.body.consent.analytics).toBe(false);
    expect(revoke.body.consent.marketing).toBe(false);
    expect(revoke.body.consent.revoked).toBe(true);
    expect(revoke.body.consent.lastAction).toBe("revoke");
  });

  it("rechaza acciones no soportadas", async () => {
    const invalidAction = await request(app)
      .post("/sitio-b/consent/action")
      .set("x-synthetic-client-id", clientId)
      .send({ action: "unknown_action" });

    expect(invalidAction.status).toBe(400);
    expect(invalidAction.body.error).toBe("consent_action_not_supported");
  });
});
