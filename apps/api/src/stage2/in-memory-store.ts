import { randomUUID } from "node:crypto";
import {
  Authorization,
  DataObservation,
  Evidence,
  EvidenceLevel,
  Execution,
  ExecutionState,
  Finding,
  FormField,
  Organization,
  Page,
  Project,
  ReviewDecision,
  ReviewState,
  Target
} from "../../../../packages/domain/src";
import {
  countActiveExecutions,
  countScopeRequestsLastMinute,
  isPrismaPersistenceEnabled,
  persistAuthorization,
  persistExecution,
  persistOrganization,
  persistProject,
  persistScopeAudit,
  persistTarget,
  updateAuthorizationKillSwitch
} from "./prisma-persistence";
import { DynamicObservationResultDto, PassiveSinglePageCrawlResultDto } from "../../../../packages/contracts/src";

type ScopeAuditRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  correlationId: string;
  authorizationId: string;
  url: string;
  operation: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
};

const durablePassiveSinglePageResults = new Map<string, PassiveSinglePageCrawlResultDto>();
const durableDynamicObservationResults = new Map<string, DynamicObservationResultDto>();

function nowIso(): string {
  return new Date().toISOString();
}

function baseEntity(correlationId: string): { id: string; createdAt: string; updatedAt: string; correlationId: string } {
  const now = nowIso();
  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    correlationId
  };
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function normalizePath(value: string): string {
  if (value.trim().length === 0) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error("invalid_url");
  }
}

function matchesAllowedDomain(hostname: string, allowedDomain: string, allowSubdomains: boolean): boolean {
  if (hostname === allowedDomain) {
    return true;
  }

  return allowSubdomains && hostname.endsWith(`.${allowedDomain}`);
}

function isTerminalState(state: ExecutionState): boolean {
  return (
    state === ExecutionState.COMPLETED ||
    state === ExecutionState.COMPLETED_WITH_WARNINGS ||
    state === ExecutionState.FAILED ||
    state === ExecutionState.CANCELLED
  );
}

function ensureDomainAllowed(url: URL, authorization: Authorization, errorMessage: string): void {
  if (authorization.allowedDomains.length === 0) {
    return;
  }

  const hostname = normalizeDomain(url.hostname);
  const isAllowed = authorization.allowedDomains.some((domain) =>
    matchesAllowedDomain(hostname, normalizeDomain(domain), authorization.allowSubdomains)
  );

  if (!isAllowed) {
    throw new Error(errorMessage);
  }
}

function ensurePathAllowed(url: URL, authorization: Authorization): void {
  if (authorization.excludedPaths.length === 0) {
    return;
  }

  const currentPath = normalizePath(url.pathname);
  const isExcluded = authorization.excludedPaths.some((excludedPath) =>
    currentPath.startsWith(normalizePath(excludedPath))
  );

  if (isExcluded) {
    throw new Error("route_excluded_by_authorization");
  }
}

function assertAuthorizationWindow(authorization: Authorization): void {
  const now = Date.now();
  const validFromTs = Date.parse(authorization.validFrom);
  const validToTs = Date.parse(authorization.validTo);

  if (Number.isNaN(validFromTs) || Number.isNaN(validToTs)) {
    throw new Error("authorization_invalid_window");
  }

  if (authorization.status !== "ACTIVE") {
    throw new Error("authorization_not_active");
  }

  if (now < validFromTs || now > validToTs) {
    throw new Error("authorization_out_of_validity");
  }

  if (authorization.killSwitchActive) {
    throw new Error("kill_switch_active");
  }
}

async function assertRateLimit(authorizationId: string, maxRequestsPerMinute: number): Promise<void> {
  const now = Date.now();
  const windowStart = now - 60_000;
  const currentWindowCount = isPrismaPersistenceEnabled()
    ? await countScopeRequestsLastMinute(authorizationId, new Date(windowStart).toISOString())
    : store.scopeAuditRequests.filter(
        (entry) => entry.authorizationId === authorizationId && Date.parse(entry.timestamp) >= windowStart
      ).length;

  if (currentWindowCount >= maxRequestsPerMinute) {
    throw new Error("rate_limit_exceeded");
  }
}

async function assertConcurrency(authorizationId: string, maxConcurrentExecutions: number): Promise<void> {
  const concurrencyStates = new Set<ExecutionState>([ExecutionState.QUEUED, ExecutionState.RUNNING]);
  const activeCount = isPrismaPersistenceEnabled()
    ? await countActiveExecutions(authorizationId)
    : Array.from(store.executions.values()).filter(
        (execution) => execution.authorizationId === authorizationId && concurrencyStates.has(execution.state)
      ).length;

  if (activeCount >= maxConcurrentExecutions) {
    throw new Error("concurrency_limit_exceeded");
  }
}

async function appendScopeAudit(
  authorizationId: string,
  url: string,
  operation: string,
  allowed: boolean,
  reason: string,
  correlationId: string
): Promise<void> {
  const entry: ScopeAuditRecord = {
    ...baseEntity(correlationId),
    authorizationId,
    url,
    operation,
    allowed,
    reason,
    timestamp: nowIso()
  };

  store.scopeAuditRequests.push(entry);
  await persistScopeAudit(entry);
}

export const store = {
  organizations: new Map<string, Organization>(),
  projects: new Map<string, Project>(),
  authorizations: new Map<string, Authorization>(),
  targets: new Map<string, Target>(),
  executions: new Map<string, Execution>(),
  pages: new Map<string, Page>(),
  formFields: new Map<string, FormField>(),
  observations: new Map<string, DataObservation>(),
  evidences: new Map<string, Evidence>(),
  findings: new Map<string, Finding>(),
  reviewDecisions: new Map<string, ReviewDecision>(),
  scopeAuditRequests: [] as ScopeAuditRecord[],
  passiveSinglePageResults: new Map<string, PassiveSinglePageCrawlResultDto>(),
  dynamicObservationResults: new Map<string, DynamicObservationResultDto>()
};

export function resetStore(): void {
  store.organizations.clear();
  store.projects.clear();
  store.authorizations.clear();
  store.targets.clear();
  store.executions.clear();
  store.pages.clear();
  store.formFields.clear();
  store.observations.clear();
  store.evidences.clear();
  store.findings.clear();
  store.reviewDecisions.clear();
  store.scopeAuditRequests = [];
  store.passiveSinglePageResults.clear();
  store.dynamicObservationResults.clear();

  if (!isPrismaPersistenceEnabled()) {
    durablePassiveSinglePageResults.clear();
    durableDynamicObservationResults.clear();
  }
}

export function transitionExecutionState(executionId: string, state: ExecutionState, correlationId: string): Execution {
  const execution = store.executions.get(executionId);
  if (!execution) {
    throw new Error("execution_id_not_found");
  }

  const updated: Execution = {
    ...execution,
    state,
    correlationId,
    updatedAt: nowIso()
  };
  store.executions.set(executionId, updated);
  return updated;
}

export function savePassiveSinglePageResult(executionId: string, result: PassiveSinglePageCrawlResultDto): void {
  store.passiveSinglePageResults.set(executionId, result);
  if (isPrismaPersistenceEnabled()) {
    durablePassiveSinglePageResults.set(executionId, result);
  }
}

export function getPassiveSinglePageResult(executionId: string): PassiveSinglePageCrawlResultDto | undefined {
  return store.passiveSinglePageResults.get(executionId) ?? durablePassiveSinglePageResults.get(executionId);
}

export function deletePassiveSinglePageResult(executionId: string): boolean {
  const deletedFromMemory = store.passiveSinglePageResults.delete(executionId);
  const deletedFromDurable = durablePassiveSinglePageResults.delete(executionId);
  return deletedFromMemory || deletedFromDurable;
}

export function saveDynamicObservationResult(executionId: string, result: DynamicObservationResultDto): void {
  store.dynamicObservationResults.set(executionId, result);
  if (isPrismaPersistenceEnabled()) {
    durableDynamicObservationResults.set(executionId, result);
  }
}

export function getDynamicObservationResult(executionId: string): DynamicObservationResultDto | undefined {
  return store.dynamicObservationResults.get(executionId) ?? durableDynamicObservationResults.get(executionId);
}

export function deleteDynamicObservationResult(executionId: string): boolean {
  const deletedFromMemory = store.dynamicObservationResults.delete(executionId);
  const deletedFromDurable = durableDynamicObservationResults.delete(executionId);
  return deletedFromMemory || deletedFromDurable;
}

export async function createOrganization(name: string, correlationId: string): Promise<Organization> {
  const entity: Organization = { ...baseEntity(correlationId), name };
  store.organizations.set(entity.id, entity);
  await persistOrganization(entity);
  return entity;
}

export async function createProject(organizationId: string, name: string, correlationId: string): Promise<Project> {
  if (!store.organizations.has(organizationId)) {
    throw new Error("organization_id_not_found");
  }

  const entity: Project = { ...baseEntity(correlationId), organizationId, name };
  store.projects.set(entity.id, entity);
  await persistProject(entity);
  return entity;
}

export async function createAuthorization(
  projectId: string,
  validFrom: string,
  validTo: string,
  options: {
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
  },
  correlationId: string
): Promise<Authorization> {
  if (!store.projects.has(projectId)) {
    throw new Error("project_id_not_found");
  }

  const validFromTs = Date.parse(validFrom);
  const validToTs = Date.parse(validTo);
  if (Number.isNaN(validFromTs) || Number.isNaN(validToTs) || validFromTs >= validToTs) {
    throw new Error("invalid_authorization_window");
  }

  const entity: Authorization = {
    ...baseEntity(correlationId),
    projectId,
    status: "ACTIVE",
    validFrom,
    validTo,
    allowedDomains: (options.allowedDomains ?? []).map((domain) => normalizeDomain(domain)).filter((domain) => domain.length > 0),
    allowSubdomains: options.allowSubdomains ?? true,
    excludedPaths: (options.excludedPaths ?? []).map((path) => normalizePath(path.trim())).filter((path) => path.length > 0),
    permittedOperations: options.permittedOperations ?? ["SCAN_PASSIVE"],
    prohibitedActions: options.prohibitedActions ?? [],
    maxRequestsPerMinute: options.maxRequestsPerMinute ?? 60,
    maxConcurrentExecutions: options.maxConcurrentExecutions ?? 5,
    maxDepth: options.maxDepth ?? 3,
    maxDurationSeconds: options.maxDurationSeconds ?? 180,
    agentId: options.agentId ?? "stage3-agent",
    emergencyContact: options.emergencyContact ?? "security@example.local",
    killSwitchActive: false
  };
  store.authorizations.set(entity.id, entity);
  await persistAuthorization(entity);
  return entity;
}

export async function createTarget(
  projectId: string,
  authorizationId: string,
  baseUrl: string,
  correlationId: string
): Promise<Target> {
  if (!store.projects.has(projectId)) {
    throw new Error("project_id_not_found");
  }

  if (!store.authorizations.has(authorizationId)) {
    throw new Error("authorization_id_not_found");
  }

  const authorization = store.authorizations.get(authorizationId)!;
  if (authorization.projectId !== projectId) {
    throw new Error("authorization_project_mismatch");
  }

  const parsedUrl = parseUrl(baseUrl);
  ensureDomainAllowed(parsedUrl, authorization, "domain_not_authorized");
  ensurePathAllowed(parsedUrl, authorization);

  const entity: Target = { ...baseEntity(correlationId), projectId, authorizationId, baseUrl };
  store.targets.set(entity.id, entity);
  await persistTarget(entity);
  return entity;
}

export async function createExecution(
  projectId: string,
  authorizationId: string,
  targetId: string,
  state: ExecutionState,
  operation: string,
  entryUrl: string | undefined,
  redirectUrl: string | undefined,
  correlationId: string
): Promise<Execution> {
  if (!store.projects.has(projectId)) {
    throw new Error("project_id_not_found");
  }

  if (!store.authorizations.has(authorizationId)) {
    throw new Error("authorization_id_not_found");
  }

  if (!store.targets.has(targetId)) {
    throw new Error("target_id_not_found");
  }

  const authorization = store.authorizations.get(authorizationId)!;
  const target = store.targets.get(targetId)!;

  if (target.authorizationId !== authorizationId || target.projectId !== projectId) {
    throw new Error("target_scope_mismatch");
  }

  assertAuthorizationWindow(authorization);
  await assertRateLimit(authorizationId, authorization.maxRequestsPerMinute);
  await assertConcurrency(authorizationId, authorization.maxConcurrentExecutions);

  if (!authorization.permittedOperations.includes(operation)) {
    throw new Error("operation_not_permitted");
  }

  if (authorization.prohibitedActions.includes(operation)) {
    throw new Error("operation_explicitly_prohibited");
  }

  if (entryUrl) {
    const parsedEntry = parseUrl(entryUrl);
    ensureDomainAllowed(parsedEntry, authorization, "domain_not_authorized");
    ensurePathAllowed(parsedEntry, authorization);
  }

  if (redirectUrl) {
    const parsedRedirect = parseUrl(redirectUrl);
    try {
      ensureDomainAllowed(parsedRedirect, authorization, "domain_not_authorized");
      ensurePathAllowed(parsedRedirect, authorization);
    } catch {
      throw new Error("redirect_out_of_scope");
    }
  }

  await appendScopeAudit(authorizationId, entryUrl ?? target.baseUrl, operation, true, "execution_allowed", correlationId);

  const entity: Execution = {
    ...baseEntity(correlationId),
    projectId,
    authorizationId,
    targetId,
    state,
    operation,
    entryUrl,
    redirectUrl
  };
  store.executions.set(entity.id, entity);
  await persistExecution(entity);
  return entity;
}

export async function toggleAuthorizationKillSwitch(
  authorizationId: string,
  active: boolean,
  correlationId: string
): Promise<Authorization> {
  const authorization = store.authorizations.get(authorizationId);
  if (!authorization) {
    throw new Error("authorization_id_not_found");
  }

  const updated: Authorization = {
    ...authorization,
    updatedAt: nowIso(),
    correlationId,
    killSwitchActive: active,
    killSwitchActivatedAt: active ? nowIso() : undefined
  };

  store.authorizations.set(updated.id, updated);
  await updateAuthorizationKillSwitch(authorizationId, active, updated.killSwitchActivatedAt, correlationId);
  return updated;
}

export async function simulateScope(
  authorizationId: string,
  url: string,
  operation: string,
  redirectUrl: string | undefined,
  correlationId: string
): Promise<{ allowed: boolean; reasons: string[] }> {
  const authorization = store.authorizations.get(authorizationId);
  if (!authorization) {
    throw new Error("authorization_id_not_found");
  }

  const reasons: string[] = [];

  try {
    assertAuthorizationWindow(authorization);
  } catch (error) {
    reasons.push((error as Error).message);
  }

  try {
    await assertRateLimit(authorizationId, authorization.maxRequestsPerMinute);
  } catch (error) {
    reasons.push((error as Error).message);
  }

  if (!authorization.permittedOperations.includes(operation)) {
    reasons.push("operation_not_permitted");
  }

  if (authorization.prohibitedActions.includes(operation)) {
    reasons.push("operation_explicitly_prohibited");
  }

  try {
    const parsedUrl = parseUrl(url);
    ensureDomainAllowed(parsedUrl, authorization, "domain_not_authorized");
    ensurePathAllowed(parsedUrl, authorization);
  } catch (error) {
    reasons.push((error as Error).message);
  }

  if (redirectUrl) {
    try {
      const parsedRedirect = parseUrl(redirectUrl);
      ensureDomainAllowed(parsedRedirect, authorization, "domain_not_authorized");
      ensurePathAllowed(parsedRedirect, authorization);
    } catch {
      reasons.push("redirect_out_of_scope");
    }
  }

  const allowed = reasons.length === 0;
  await appendScopeAudit(authorizationId, url, operation, allowed, allowed ? "scope_allowed" : reasons.join(","), correlationId);
  return { allowed, reasons };
}

export function createPage(executionId: string, url: string, title: string | undefined, correlationId: string): Page {
  if (!store.executions.has(executionId)) {
    throw new Error("execution_id_not_found");
  }

  const entity: Page = { ...baseEntity(correlationId), executionId, url, title };
  store.pages.set(entity.id, entity);
  return entity;
}

export function createFormField(
  pageId: string,
  name: string,
  type: string,
  required: boolean,
  formId: string | undefined,
  correlationId: string
): FormField {
  if (!store.pages.has(pageId)) {
    throw new Error("page_id_not_found");
  }

  const entity: FormField = { ...baseEntity(correlationId), pageId, formId, name, type, required };
  store.formFields.set(entity.id, entity);
  return entity;
}

export function createObservation(
  executionId: string,
  description: string,
  reviewState: ReviewState,
  pageId: string | undefined,
  formFieldId: string | undefined,
  correlationId: string
): DataObservation {
  if (!store.executions.has(executionId)) {
    throw new Error("execution_id_not_found");
  }

  const entity: DataObservation = {
    ...baseEntity(correlationId),
    executionId,
    pageId,
    formFieldId,
    description,
    reviewState
  };
  store.observations.set(entity.id, entity);
  return entity;
}

export function createEvidence(
  executionId: string,
  level: EvidenceLevel,
  kind: string,
  location: string,
  correlationId: string
): Evidence {
  if (!store.executions.has(executionId)) {
    throw new Error("execution_id_not_found");
  }

  const entity: Evidence = { ...baseEntity(correlationId), executionId, level, kind, location };
  store.evidences.set(entity.id, entity);
  return entity;
}

export function createFinding(
  projectId: string,
  summary: string,
  evidenceIds: string[],
  reviewState: ReviewState,
  correlationId: string
): Finding {
  if (!store.projects.has(projectId)) {
    throw new Error("project_id_not_found");
  }

  for (const evidenceId of evidenceIds) {
    if (!store.evidences.has(evidenceId)) {
      throw new Error("evidence_id_not_found");
    }
  }

  const entity: Finding = { ...baseEntity(correlationId), projectId, summary, evidenceIds, reviewState };
  store.findings.set(entity.id, entity);
  return entity;
}

export function createReviewDecision(
  findingId: string,
  reviewState: ReviewState,
  comment: string,
  correlationId: string
): ReviewDecision {
  if (!store.findings.has(findingId)) {
    throw new Error("finding_id_not_found");
  }

  const entity: ReviewDecision = { ...baseEntity(correlationId), findingId, reviewState, comment };
  store.reviewDecisions.set(entity.id, entity);
  return entity;
}
