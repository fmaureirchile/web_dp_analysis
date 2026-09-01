import {
  type ConsentScenarioEvaluationDto,
  type ConsentScenarioSignalDto
} from "../../contracts/src";
import { evaluateConsentScenario } from "./consent-scenarios";

export interface LabSiteBConsentStatusPayload {
  consent: {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
    revoked: boolean;
    lastAction: "initial" | "accept_all" | "reject_all" | "customize" | "revoke";
  };
}

export interface LabSiteCTrackingEventsPayload {
  rejected: boolean;
  defectFlags: {
    trackingBeforeConsent: boolean;
    trackingAfterReject: boolean;
  };
}

export function adaptSiteBConsentToSignals(_payload: LabSiteBConsentStatusPayload): ConsentScenarioSignalDto {
  return {
    trackingBeforeConsent: false,
    trackingAfterReject: false,
    rejectAvailable: true,
    granularChoiceAvailable: true,
    revokeAvailable: true
  };
}

export function adaptSiteCTrackingToSignals(payload: LabSiteCTrackingEventsPayload): ConsentScenarioSignalDto {
  return {
    trackingBeforeConsent: payload.defectFlags.trackingBeforeConsent,
    trackingAfterReject: payload.defectFlags.trackingAfterReject,
    rejectAvailable: payload.rejected || payload.defectFlags.trackingAfterReject,
    granularChoiceAvailable: false,
    revokeAvailable: false
  };
}

export function evaluateConsentFromLabSiteB(payload: LabSiteBConsentStatusPayload): ConsentScenarioEvaluationDto {
  return evaluateConsentScenario(adaptSiteBConsentToSignals(payload));
}

export function evaluateConsentFromLabSiteC(payload: LabSiteCTrackingEventsPayload): ConsentScenarioEvaluationDto {
  return evaluateConsentScenario(adaptSiteCTrackingToSignals(payload));
}
