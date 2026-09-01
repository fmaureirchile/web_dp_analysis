import {
  type ConsentScenarioEvaluationDto,
  type ConsentScenarioSignalDto
} from "../../contracts/src";

export function evaluateConsentScenario(signal: ConsentScenarioSignalDto): ConsentScenarioEvaluationDto {
  if (signal.trackingAfterReject) {
    return {
      status: "DEFECTIVE",
      code: "TRACKING_AFTER_REJECT",
      riskLevel: "HIGH",
      reason: "tracking_detected_after_reject"
    };
  }

  if (signal.trackingBeforeConsent) {
    return {
      status: "DEFECTIVE",
      code: "TRACKING_BEFORE_CONSENT",
      riskLevel: "HIGH",
      reason: "tracking_detected_before_consent"
    };
  }

  if (!signal.rejectAvailable) {
    return {
      status: "DEFECTIVE",
      code: "REJECT_NOT_AVAILABLE",
      riskLevel: "HIGH",
      reason: "reject_option_not_available"
    };
  }

  if (signal.granularChoiceAvailable && signal.revokeAvailable) {
    return {
      status: "COMPLIANT",
      code: "BASELINE_OK",
      riskLevel: "LOW",
      reason: "baseline_consent_controls_present"
    };
  }

  return {
    status: "INCONCLUSIVE",
    code: "PARTIAL_CONTROLS",
    riskLevel: "MEDIUM",
    reason: "baseline_controls_partially_present"
  };
}
