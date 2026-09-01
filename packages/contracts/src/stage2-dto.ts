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
