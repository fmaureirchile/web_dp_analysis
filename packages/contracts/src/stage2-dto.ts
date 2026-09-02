import { EvidenceLevel, ExecutionState, ReviewState } from "../../domain/src";

export interface CreateOrganizationDto {
  name: string;
}

export interface CreateProjectDto {
  organizationId: string;
  name: string;
}

export interface CreateAuthorizationDto {
  projectId: string;
  validFrom: string;
  validTo: string;
  allowedDomains?: string[];
  allowSubdomains?: boolean;
  excludedPaths?: string[];
  permittedOperations?: string[];
  prohibitedActions?: string[];
  maxRequestsPerMinute?: number;
  maxConcurrentExecutions?: number;
  maxDepth?: number;
  maxDurationSeconds?: number;
  agentId?: string;
  emergencyContact?: string;
}

export interface CreateTargetDto {
  projectId: string;
  authorizationId: string;
  baseUrl: string;
}

export interface CreateExecutionDto {
  projectId: string;
  authorizationId: string;
  targetId: string;
  state?: ExecutionState;
  operation?: string;
  entryUrl?: string;
  redirectUrl?: string;
}

export interface ToggleKillSwitchDto {
  active: boolean;
}

export interface ScopeSimulationDto {
  authorizationId: string;
  url: string;
  operation: string;
  redirectUrl?: string;
}

export interface CreatePageDto {
  executionId: string;
  url: string;
  title?: string;
}

export interface CreateFormFieldDto {
  pageId: string;
  formId?: string;
  name: string;
  type: string;
  required: boolean;
}

export interface CreateObservationDto {
  executionId: string;
  pageId?: string;
  formFieldId?: string;
  description: string;
  reviewState?: ReviewState;
}

export interface CreateEvidenceDto {
  executionId: string;
  level: EvidenceLevel;
  kind: string;
  location: string;
}

export interface CreateFindingDto {
  projectId: string;
  summary: string;
  evidenceIds: string[];
  reviewState?: ReviewState;
}

export interface CreateReviewDecisionDto {
  findingId: string;
  reviewState: ReviewState;
  comment: string;
}

export interface EvidenceQueryItemDto {
  evidenceId: string;
  executionId: string;
  level: EvidenceLevel;
  kind: string;
  location: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceQueryResultDto {
  executionId: string;
  kind?: string;
  from?: string;
  to?: string;
  cursor?: string;
  nextCursor?: string;
  limit: number;
  items: EvidenceQueryItemDto[];
}

export interface ReviewObservationItemDto {
  observationId: string;
  executionId: string;
  pageId?: string;
  formFieldId?: string;
  description: string;
  reviewState: ReviewState;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewExecutionViewDto {
  executionId: string;
  executionState: ExecutionState;
  entryUrl?: string;
  generatedAt: string;
  evidenceCount: number;
  observationCount: number;
  evidences: EvidenceQueryItemDto[];
  observations: ReviewObservationItemDto[];
}

export interface ExecutiveSummaryByKindDto {
  kind: string;
  count: number;
  evidenceIds: string[];
}

export interface ExecutiveSummaryByLevelDto {
  level: EvidenceLevel;
  count: number;
  evidenceIds: string[];
}

export interface ExecutiveSummaryReportDto {
  executionId: string;
  executionState: ExecutionState;
  entryUrl?: string;
  generatedAt: string;
  totals: {
    evidences: number;
    observations: number;
  };
  evidenceByKind: ExecutiveSummaryByKindDto[];
  evidenceByLevel: ExecutiveSummaryByLevelDto[];
}

export interface FormInventoryFieldDto {
  formFieldId: string;
  pageId: string;
  name: string;
  type: string;
  required: boolean;
  observationIds: string[];
  observationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormInventoryPageDto {
  pageId: string;
  url: string;
  title?: string;
  fieldCount: number;
  observationCount: number;
  fields: FormInventoryFieldDto[];
}

export interface FormInventoryReportDto {
  executionId: string;
  executionState: ExecutionState;
  entryUrl?: string;
  pageId?: string;
  generatedAt: string;
  totals: {
    pages: number;
    fields: number;
    observations: number;
  };
  pages: FormInventoryPageDto[];
}

export interface ThirdPartyInventoryItemDto {
  domain: string;
  requestCount: number;
  requestIds: string[];
  urls: string[];
}

export interface CookieInventoryItemDto {
  key: string;
  occurrenceCount: number;
  classificationLabel?: import("./stage7-dto").DataClassificationLabel;
  valueMasked: boolean;
  latestObservedAt: string;
  pageUrls: string[];
}

export interface TrackingInventoryReportDto {
  executionId: string;
  executionState: ExecutionState;
  entryUrl?: string;
  generatedAt: string;
  totals: {
    thirdParties: number;
    cookies: number;
    networkRequests: number;
    cookieObservations: number;
  };
  thirdParties: ThirdPartyInventoryItemDto[];
  cookies: CookieInventoryItemDto[];
}

export type FrontendFramework = "REACT" | "NEXT" | "VUE" | "ANGULAR" | "SVELTE" | "UNKNOWN";

export interface FrontendIndexedFileDto {
  relativePath: string;
  extension: string;
  bytes: number;
}

export interface FrontendFileTypeCountDto {
  extension: string;
  count: number;
}

export interface StartFrontendRepositoryIndexDto {
  executionId: string;
  repositoryPath: string;
  maxFiles?: number;
}

export type FrontendRepositoryIndexErrorCode =
  | "invalid_execution_id"
  | "invalid_repository_path"
  | "repository_path_not_found"
  | "indexing_failed"
  | "result_not_available";

export interface FrontendRepositoryIndexSuccessDto {
  executionId: string;
  repositoryPath: string;
  indexedAt: string;
  framework: FrontendFramework;
  totalFiles: number;
  totalBytes: number;
  fileTypeCounts: FrontendFileTypeCountDto[];
  sampleFiles: FrontendIndexedFileDto[];
  evidenceId: string;
}

export interface FrontendRepositoryIndexErrorDto {
  executionId: string;
  repositoryPath: string;
  errorCode: FrontendRepositoryIndexErrorCode;
  message: string;
}

export interface FrontendRepositoryIndexResultDto {
  ok: boolean;
  data?: FrontendRepositoryIndexSuccessDto;
  error?: FrontendRepositoryIndexErrorDto;
}

export type FrontendCapturePatternRule =
  | "FORM_INPUT"
  | "NETWORK_FETCH"
  | "COOKIE_ACCESS"
  | "STORAGE_ACCESS"
  | "ANALYTICS_BEACON";

export interface FrontendPatternMatchDto {
  rule: FrontendCapturePatternRule;
  line: number;
  snippet: string;
}

export interface FrontendFilePatternDetectionsDto {
  relativePath: string;
  matches: FrontendPatternMatchDto[];
}

export interface StartFrontendPatternDetectionDto {
  executionId: string;
  repositoryPath: string;
  maxFiles?: number;
  maxMatchesPerFile?: number;
}

export type FrontendPatternDetectionErrorCode =
  | "invalid_execution_id"
  | "invalid_repository_path"
  | "repository_path_not_found"
  | "detection_failed"
  | "result_not_available";

export interface FrontendPatternDetectionSuccessDto {
  executionId: string;
  repositoryPath: string;
  detectedAt: string;
  totalFilesScanned: number;
  totalFilesWithMatches: number;
  totalMatches: number;
  files: FrontendFilePatternDetectionsDto[];
  evidenceId: string;
}

export interface FrontendPatternDetectionErrorDto {
  executionId: string;
  repositoryPath: string;
  errorCode: FrontendPatternDetectionErrorCode;
  message: string;
}

export interface FrontendPatternDetectionResultDto {
  ok: boolean;
  data?: FrontendPatternDetectionSuccessDto;
  error?: FrontendPatternDetectionErrorDto;
}

export interface FrontendStaticFindingsRuleSummaryDto {
  rule: FrontendCapturePatternRule;
  matchCount: number;
  filesCount: number;
}

export interface FrontendStaticFindingsFileSummaryDto {
  relativePath: string;
  matchCount: number;
  rules: FrontendCapturePatternRule[];
}

export interface FrontendStaticFindingsViewDto {
  executionId: string;
  generatedAt: string;
  totals: {
    scannedFiles: number;
    filesWithMatches: number;
    matches: number;
    distinctRules: number;
  };
  byRule: FrontendStaticFindingsRuleSummaryDto[];
  files: FrontendStaticFindingsFileSummaryDto[];
  evidenceId: string;
}

export type BackendApiArtifactType = "OPENAPI" | "GRAPHQL" | "ROUTE" | "DTO";

export interface BackendApiIndexedArtifactDto {
  relativePath: string;
  artifactType: BackendApiArtifactType;
  bytes: number;
}

export interface BackendApiArtifactTypeCountDto {
  artifactType: BackendApiArtifactType;
  count: number;
}

export interface StartBackendApiIndexDto {
  executionId: string;
  repositoryPath: string;
  maxFiles?: number;
}

export type BackendApiIndexErrorCode =
  | "invalid_execution_id"
  | "invalid_repository_path"
  | "repository_path_not_found"
  | "indexing_failed"
  | "result_not_available";

export interface BackendApiIndexSuccessDto {
  executionId: string;
  repositoryPath: string;
  indexedAt: string;
  totalArtifacts: number;
  artifactTypeCounts: BackendApiArtifactTypeCountDto[];
  artifacts: BackendApiIndexedArtifactDto[];
  evidenceId: string;
}

export interface BackendApiIndexErrorDto {
  executionId: string;
  repositoryPath: string;
  errorCode: BackendApiIndexErrorCode;
  message: string;
}

export interface BackendApiIndexResultDto {
  ok: boolean;
  data?: BackendApiIndexSuccessDto;
  error?: BackendApiIndexErrorDto;
}

export type BackendProcessingRule =
  | "ROUTE_HANDLER"
  | "CONTROLLER_USAGE"
  | "SERVICE_USAGE"
  | "INTEGRATION_USAGE";

export interface BackendProcessingMatchDto {
  rule: BackendProcessingRule;
  line: number;
  snippet: string;
}

export interface BackendProcessingFileDetectionsDto {
  relativePath: string;
  matches: BackendProcessingMatchDto[];
}

export interface StartBackendProcessingDetectionDto {
  executionId: string;
  repositoryPath: string;
  maxFiles?: number;
  maxMatchesPerFile?: number;
}

export type BackendProcessingDetectionErrorCode =
  | "invalid_execution_id"
  | "invalid_repository_path"
  | "repository_path_not_found"
  | "detection_failed"
  | "result_not_available";

export interface BackendProcessingDetectionSuccessDto {
  executionId: string;
  repositoryPath: string;
  detectedAt: string;
  totalFilesScanned: number;
  totalFilesWithMatches: number;
  totalMatches: number;
  files: BackendProcessingFileDetectionsDto[];
  evidenceId: string;
}

export interface BackendProcessingDetectionErrorDto {
  executionId: string;
  repositoryPath: string;
  errorCode: BackendProcessingDetectionErrorCode;
  message: string;
}

export interface BackendProcessingDetectionResultDto {
  ok: boolean;
  data?: BackendProcessingDetectionSuccessDto;
  error?: BackendProcessingDetectionErrorDto;
}

export interface BackendProcessingFlowRuleSummaryDto {
  rule: BackendProcessingRule;
  matchCount: number;
  filesCount: number;
}

export interface BackendProcessingFlowFileSummaryDto {
  relativePath: string;
  artifactType?: BackendApiArtifactType;
  matchCount: number;
  rules: BackendProcessingRule[];
}

export interface BackendProcessingFlowViewDto {
  executionId: string;
  generatedAt: string;
  totals: {
    apiArtifacts: number;
    filesWithProcessingMatches: number;
    processingMatches: number;
    distinctProcessingRules: number;
  };
  byRule: BackendProcessingFlowRuleSummaryDto[];
  files: BackendProcessingFlowFileSummaryDto[];
  evidenceIds: {
    apiIndexEvidenceId: string;
    processingEvidenceId: string;
  };
}

export type AuthenticatedEvaluationRole = "cliente" | "supervisor";

export type AuthenticatedEvaluationErrorCode =
  | "invalid_execution_id"
  | "invalid_entry_url"
  | "authentication_failed"
  | "profile_fetch_failed"
  | "internal_error";

export interface StartAuthenticatedEvaluationDto {
  executionId: string;
  entryUrl: string;
  username: string;
  password: string;
  role: AuthenticatedEvaluationRole;
  correlationId?: string;
}

export interface AuthenticatedEvaluationProfileDto {
  username: string;
  role: AuthenticatedEvaluationRole;
  panel: string;
  sections: string[];
  syntheticDataAccess: string;
}

export interface AuthenticatedEvaluationSuccessDto {
  steps: Array<{
    step: "LOGIN" | "PROFILE" | "LOGOUT";
    statusHttp: number;
    evidenceId: string;
    evidenceKind: string;
    evidenceLocation: string;
    timestamp: string;
  }>;
  executionId: string;
  entryUrl: string;
  role: AuthenticatedEvaluationRole;
  sessionScopeId: string;
  authenticatedAt: string;
  profile: AuthenticatedEvaluationProfileDto;
  evidenceId: string;
  loggedOut: boolean;
}

export interface AuthenticatedEvaluationErrorDto {
  executionId: string;
  entryUrl: string;
  errorCode: AuthenticatedEvaluationErrorCode;
  message: string;
}

export interface AuthenticatedEvaluationResultDto {
  ok: boolean;
  data?: AuthenticatedEvaluationSuccessDto;
  error?: AuthenticatedEvaluationErrorDto;
}
