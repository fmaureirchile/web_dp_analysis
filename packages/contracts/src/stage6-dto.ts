export type BrowserObservationProtocol = "FETCH" | "XHR" | "BEACON";

export type BrowserObservationEventType =
  | "PAGE_LOAD"
  | "CLICK"
  | "SPA_NAVIGATION"
  | "MODAL_OPEN"
  | "FORM_INTERACTION";

export type BrowserStorageKind = "COOKIE" | "LOCAL_STORAGE" | "SESSION_STORAGE";

export type BrowserObservationErrorCode =
  | "invalid_execution_id"
  | "invalid_entry_url"
  | "authorization_scope_rejected"
  | "browser_timeout"
  | "internal_error";

export interface StartDynamicObservationDto {
  executionId: string;
  entryUrl: string;
  correlationId?: string;
  timeoutMs?: number;
  maxEvents?: number;
}

export interface BrowserPageSnapshotDto {
  pageUrl: string;
  title?: string;
  capturedAt: string;
  domEvidenceId: string;
  screenshotEvidenceId: string;
}

export interface BrowserNetworkObservationItemDto {
  requestId: string;
  pageUrl: string;
  protocol: BrowserObservationProtocol;
  method: string;
  url: string;
  statusHttp?: number;
  thirdPartyDomain?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface BrowserStorageObservationItemDto {
  pageUrl: string;
  kind: BrowserStorageKind;
  key: string;
  valueMasked: boolean;
  valueEvidenceId?: string;
  observedAt: string;
}

export interface BrowserInteractionEventDto {
  eventType: BrowserObservationEventType;
  pageUrl: string;
  target?: string;
  timestamp: string;
}

export interface DynamicObservationSuccessDto {
  executionId: string;
  entryUrl: string;
  completedAt: string;
  pageSnapshots: BrowserPageSnapshotDto[];
  network: BrowserNetworkObservationItemDto[];
  storage: BrowserStorageObservationItemDto[];
  events: BrowserInteractionEventDto[];
}

export interface DynamicObservationErrorDto {
  executionId: string;
  entryUrl: string;
  errorCode: BrowserObservationErrorCode;
  message: string;
}

export interface DynamicObservationResultDto {
  ok: boolean;
  data?: DynamicObservationSuccessDto;
  error?: DynamicObservationErrorDto;
}
