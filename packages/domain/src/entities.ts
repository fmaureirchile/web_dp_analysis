import { DataStorageMode, EvidenceLevel, ExecutionState, ReviewState } from "./enums";

export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
}

export interface Organization extends BaseEntity {
  name: string;
}

export interface User extends BaseEntity {
  organizationId: EntityId;
  email: string;
  displayName: string;
}

export interface Project extends BaseEntity {
  organizationId: EntityId;
  name: string;
}

export interface Authorization extends BaseEntity {
  projectId: EntityId;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  validFrom: string;
  validTo: string;
  allowedDomains: string[];
  allowSubdomains: boolean;
  excludedPaths: string[];
  permittedOperations: string[];
  prohibitedActions: string[];
  maxRequestsPerMinute: number;
  maxConcurrentExecutions: number;
  maxDepth: number;
  maxDurationSeconds: number;
  agentId: string;
  emergencyContact: string;
  killSwitchActive: boolean;
  killSwitchActivatedAt?: string;
}

export interface Target extends BaseEntity {
  projectId: EntityId;
  authorizationId: EntityId;
  baseUrl: string;
}

export interface ScanProfile extends BaseEntity {
  projectId: EntityId;
  name: string;
}

export interface Execution extends BaseEntity {
  projectId: EntityId;
  authorizationId: EntityId;
  targetId: EntityId;
  state: ExecutionState;
  operation: string;
  entryUrl?: string;
  redirectUrl?: string;
}

export interface BrowserSession extends BaseEntity {
  executionId: EntityId;
  browserName: string;
}

export interface Page extends BaseEntity {
  executionId: EntityId;
  url: string;
  title?: string;
}

export interface Form extends BaseEntity {
  pageId: EntityId;
  action?: string;
  method?: string;
}

export interface FormField extends BaseEntity {
  pageId: EntityId;
  formId?: EntityId;
  name: string;
  type: string;
  required: boolean;
}

export interface DataObservation extends BaseEntity {
  executionId: EntityId;
  pageId?: EntityId;
  formFieldId?: EntityId;
  description: string;
  reviewState: ReviewState;
}

export interface DataCategory extends BaseEntity {
  code: string;
  description: string;
}

export interface NetworkRequest extends BaseEntity {
  executionId: EntityId;
  url: string;
  method: string;
}

export interface StorageArtifact extends BaseEntity {
  executionId: EntityId;
  key: string;
  valueMode: DataStorageMode;
}

export interface ThirdParty extends BaseEntity {
  executionId: EntityId;
  domain: string;
}

export interface ConsentState extends BaseEntity {
  executionId: EntityId;
  state: "UNKNOWN" | "ACCEPTED" | "REJECTED";
}

export interface PolicyDocument extends BaseEntity {
  projectId: EntityId;
  url: string;
  kind: "PRIVACY" | "COOKIES" | "TERMS";
}

export interface Evidence extends BaseEntity {
  executionId: EntityId;
  level: EvidenceLevel;
  kind: string;
  location: string;
}

export interface Finding extends BaseEntity {
  projectId: EntityId;
  reviewState: ReviewState;
  summary: string;
  evidenceIds: EntityId[];
}

export interface ReviewDecision extends BaseEntity {
  findingId: EntityId;
  reviewState: ReviewState;
  comment: string;
}

export interface Report extends BaseEntity {
  projectId: EntityId;
  findingIds: EntityId[];
  generatedAt: string;
}
