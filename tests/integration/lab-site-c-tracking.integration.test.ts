import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - Sitio C tracking defectuoso", () => {
  const app = buildLaboratoryServer();
  const clientId = "integration-site-c-client";

  it("registra tracking antes de cualquier consentimiento", async () => {
    const boot = await request(app)
      .post("/sitio-c/tracking/boot")
      .set("x-synthetic-client-id", clientId)
      .send();

    expect(boot.status).toBe(200);

    const state = await request(app).get("/sitio-c/tracking/events").set("x-synthetic-client-id", clientId);

    expect(state.status).toBe(200);
    expect(state.body.defectFlags.trackingBeforeConsent).toBe(true);
    expect(state.body.events.some((event: { type: string }) => event.type === "tracking_before_choice")).toBe(true);
  });

  it("mantiene tracking despues de rechazo (defecto esperado)", async () => {
    const reject = await request(app)
      .post("/sitio-c/consent/reject")
      .set("x-synthetic-client-id", clientId)
      .send();

    expect(reject.status).toBe(200);

    const state = await request(app).get("/sitio-c/tracking/events").set("x-synthetic-client-id", clientId);

    expect(state.status).toBe(200);
    expect(state.body.rejected).toBe(true);
    expect(state.body.defectFlags.trackingAfterReject).toBe(true);

    const types = state.body.events.map((event: { type: string }) => event.type);
    expect(types).toContain("consent_rejected");
    expect(types).toContain("tracking_after_reject");
  });

  it("permite pings manuales incluso tras rechazo (defecto controlado)", async () => {
    const ping = await request(app)
      .post("/sitio-c/tracking/ping")
      .set("x-synthetic-client-id", clientId)
      .send();

    expect(ping.status).toBe(200);

    const state = await request(app).get("/sitio-c/tracking/events").set("x-synthetic-client-id", clientId);

    expect(state.status).toBe(200);
    const types = state.body.events.map((event: { type: string }) => event.type);
    expect(types).toContain("tracking_ping");
  });
});
