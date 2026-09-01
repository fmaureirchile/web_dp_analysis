import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  adaptSiteBConsentToSignals,
  adaptSiteCTrackingToSignals,
  evaluateConsentFromLabSiteB,
  evaluateConsentFromLabSiteC,
  type LabSiteBConsentStatusPayload,
  type LabSiteCTrackingEventsPayload
} from "../../packages/domain/src";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("stage8 consent lab adapter", () => {
  const app = buildLaboratoryServer();

  it("traduce sitio B a baseline de consentimiento correcto", async () => {
    const status = await request(app).get("/sitio-b/consent/status").set("x-synthetic-client-id", "e8-b-client");

    expect(status.status).toBe(200);
    const payload = status.body as LabSiteBConsentStatusPayload;

    const signal = adaptSiteBConsentToSignals(payload);
    expect(signal.rejectAvailable).toBe(true);
    expect(signal.granularChoiceAvailable).toBe(true);
    expect(signal.revokeAvailable).toBe(true);

    const evaluation = evaluateConsentFromLabSiteB(payload);
    expect(evaluation.status).toBe("COMPLIANT");
    expect(evaluation.code).toBe("BASELINE_OK");
  });

  it("traduce sitio C con tracking previo como defecto", async () => {
    await request(app).post("/sitio-c/tracking/boot").set("x-synthetic-client-id", "e8-c-client").send();

    const events = await request(app).get("/sitio-c/tracking/events").set("x-synthetic-client-id", "e8-c-client");
    expect(events.status).toBe(200);
    const payload = events.body as LabSiteCTrackingEventsPayload;

    const signal = adaptSiteCTrackingToSignals(payload);
    expect(signal.trackingBeforeConsent).toBe(true);

    const evaluation = evaluateConsentFromLabSiteC(payload);
    expect(evaluation.status).toBe("DEFECTIVE");
    expect(evaluation.code).toBe("TRACKING_BEFORE_CONSENT");
  });

  it("traduce sitio C con tracking post-rechazo como defecto critico", async () => {
    await request(app).post("/sitio-c/consent/reject").set("x-synthetic-client-id", "e8-c-client-2").send();

    const events = await request(app).get("/sitio-c/tracking/events").set("x-synthetic-client-id", "e8-c-client-2");
    expect(events.status).toBe(200);
    const payload = events.body as LabSiteCTrackingEventsPayload;

    const signal = adaptSiteCTrackingToSignals(payload);
    expect(signal.trackingAfterReject).toBe(true);

    const evaluation = evaluateConsentFromLabSiteC(payload);
    expect(evaluation.status).toBe("DEFECTIVE");
    expect(evaluation.code).toBe("TRACKING_AFTER_REJECT");
    expect(evaluation.riskLevel).toBe("HIGH");
  });
});
