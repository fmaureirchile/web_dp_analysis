export type ConsentScenarioStatus = "COMPLIANT" | "DEFECTIVE" | "INCONCLUSIVE";

export type ConsentRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ConsentScenarioSignalDto {
  trackingBeforeConsent: boolean;
  trackingAfterReject: boolean;
  rejectAvailable: boolean;
  granularChoiceAvailable: boolean;
  revokeAvailable: boolean;
}

export interface ConsentScenarioEvaluationDto {
  status: ConsentScenarioStatus;
  code:
    | "BASELINE_OK"
    | "TRACKING_BEFORE_CONSENT"
    | "TRACKING_AFTER_REJECT"
    | "REJECT_NOT_AVAILABLE"
    | "PARTIAL_CONTROLS";
  riskLevel: ConsentRiskLevel;
  reason: string;
}
