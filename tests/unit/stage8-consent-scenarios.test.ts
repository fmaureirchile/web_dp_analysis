import { describe, expect, it } from "vitest";

import { evaluateConsentScenario } from "../../packages/domain/src/consent-scenarios";

describe("stage8 consent scenarios baseline", () => {
  it("marca defectuoso cuando hay tracking despues de rechazo", () => {
    const result = evaluateConsentScenario({
      trackingBeforeConsent: false,
      trackingAfterReject: true,
      rejectAvailable: true,
      granularChoiceAvailable: true,
      revokeAvailable: true
    });

    expect(result.status).toBe("DEFECTIVE");
    expect(result.code).toBe("TRACKING_AFTER_REJECT");
    expect(result.riskLevel).toBe("HIGH");
  });

  it("marca defectuoso cuando hay tracking antes de consentimiento", () => {
    const result = evaluateConsentScenario({
      trackingBeforeConsent: true,
      trackingAfterReject: false,
      rejectAvailable: true,
      granularChoiceAvailable: true,
      revokeAvailable: true
    });

    expect(result.status).toBe("DEFECTIVE");
    expect(result.code).toBe("TRACKING_BEFORE_CONSENT");
  });

  it("marca compliant en baseline correcto", () => {
    const result = evaluateConsentScenario({
      trackingBeforeConsent: false,
      trackingAfterReject: false,
      rejectAvailable: true,
      granularChoiceAvailable: true,
      revokeAvailable: true
    });

    expect(result.status).toBe("COMPLIANT");
    expect(result.code).toBe("BASELINE_OK");
    expect(result.riskLevel).toBe("LOW");
  });

  it("marca inconcluso cuando faltan controles no criticos", () => {
    const result = evaluateConsentScenario({
      trackingBeforeConsent: false,
      trackingAfterReject: false,
      rejectAvailable: true,
      granularChoiceAvailable: false,
      revokeAvailable: true
    });

    expect(result.status).toBe("INCONCLUSIVE");
    expect(result.code).toBe("PARTIAL_CONTROLS");
    expect(result.riskLevel).toBe("MEDIUM");
  });
});
