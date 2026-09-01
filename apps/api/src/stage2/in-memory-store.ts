import { randomUUID } from "node:crypto";
import {
  type DynamicObservationErrorDto,
  type DynamicObservationResultDto,
  type DynamicObservationSuccessDto,
  type PassiveSinglePageCrawlErrorDto,
  type PassiveSinglePageCrawlResultDto
} from "../../../../packages/contracts/src";
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
  getExecutionById,
  getLatestEvidenceByExecutionIdAndKind,
  listEvidencesByExecutionIdAndKind,
  getPassiveSinglePageResultByExecutionId,
  isPrismaPersistenceEnabled,
  listExecutionsByStateAndWindow,
  persistEvidence,
  persistPassiveSinglePageResult,
  persistAuthorization,
  persistExecution,
  persistOrganization,
  persistProject,
  persistScopeAudit,
  persistTarget,
  updateExecutionState,
  updateAuthorizationKillSwitch
} from "./prisma-persistence";

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

type PassiveHtmlEvidenceRecord = {
  evidenceId: string;
  executionId: string;
  entryUrl: string;
  fetchedAt: string;
  statusHttp: number;
  contentType?: string;
  contentLength?: number;
  html: string;
  title?: string;
};

type PassiveSinglePageCrawlResultRecord = {
  executionId: string;
  result: PassiveSinglePageCrawlResultDto;
  updatedAt: string;
};

type DynamicObservationResultRecord = {
  executionId: string;
  result: DynamicObservationResultDto;
  updatedAt: string;
};

type BrowserDomSnapshotRecord = {
  evidenceId: string;
  executionId: string;
  pageUrl: string;
  capturedAt: string;
  html: string;
  title?: string;
};

type BrowserScreenshotRecord = {
  evidenceId: string;
  executionId: string;
  pageUrl: string;
  capturedAt: string;
  dataUrl: string;
};

type ExecutionStateTransitionRecord = {
  executionId: string;
  from: ExecutionState;
  to: ExecutionState;
  reason: string;
  correlationId: string;
  timestamp: string;
};

type CrawlerOperationalEventRecord = {
  id: string;
  executionId: string;
  correlationId: string;
  event: string;
  detail?: string;
  timestamp: string;
};

const ALLOWED_EXECUTION_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  [ExecutionState.DRAFT]: [ExecutionState.VALIDATED, ExecutionState.CANCELLED],
  [ExecutionState.VALIDATED]: [ExecutionState.QUEUED, ExecutionState.FAILED, ExecutionState.CANCELLED],
  [ExecutionState.QUEUED]: [ExecutionState.RUNNING, ExecutionState.FAILED, ExecutionState.CANCELLED],
  [ExecutionState.RUNNING]: [ExecutionState.COMPLETED, ExecutionState.COMPLETED_WITH_WARNINGS, ExecutionState.FAILED, ExecutionState.PAUSED],
  [ExecutionState.PAUSED]: [ExecutionState.RUNNING, ExecutionState.CANCELLED, ExecutionState.FAILED],
  [ExecutionState.COMPLETED]: [],
  [ExecutionState.COMPLETED_WITH_WARNINGS]: [],
  [ExecutionState.FAILED]: [],
  [ExecutionState.CANCELLED]: []
};

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

function isConcurrencyTrackedState(state: ExecutionState): boolean {
  return state === ExecutionState.QUEUED || state === ExecutionState.RUNNING;
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
  const activeCount = isPrismaPersistenceEnabled()
    ? await countActiveExecutions(authorizationId)
    : Array.from(store.executions.values()).filter(
        (execution) => execution.authorizationId === authorizationId && isConcurrencyTrackedState(execution.state)
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
  passiveHtmlEvidences: new Map<string, PassiveHtmlEvidenceRecord>(),
  executionTransitions: [] as ExecutionStateTransitionRecord[],
  crawlerOperationalEvents: [] as CrawlerOperationalEventRecord[],
  passiveSinglePageResults: new Map<string, PassiveSinglePageCrawlResultRecord>(),
  dynamicObservationResults: new Map<string, DynamicObservationResultRecord>(),
  browserDomSnapshots: new Map<string, BrowserDomSnapshotRecord>(),
  browserScreenshots: new Map<string, BrowserScreenshotRecord>()
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
  store.passiveHtmlEvidences.clear();
  store.executionTransitions = [];
  store.crawlerOperationalEvents = [];
  store.passiveSinglePageResults.clear();
  store.dynamicObservationResults.clear();
  store.browserDomSnapshots.clear();
  store.browserScreenshots.clear();
}

export function appendCrawlerOperationalEvent(
  executionId: string,
  correlationId: string,
  event: string,
  detail?: string
): void {
  store.crawlerOperationalEvents.push({
    id: randomUUID(),
    executionId,
    correlationId,
    event,
    detail,
    timestamp: nowIso()
  });
}

export function listCrawlerOperationalEventsByExecutionId(executionId: string): Array<{
  executionId: string;
  correlationId: string;
  event: string;
  detail?: string;
  timestamp: string;
}> {
  return store.crawlerOperationalEvents
    .filter((entry) => entry.executionId === executionId)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((entry) => ({
      executionId: entry.executionId,
      correlationId: entry.correlationId,
      event: entry.event,
      detail: entry.detail,
      timestamp: entry.timestamp
    }));
}

export async function recordPassiveSinglePageCrawlSuccess(
  executionId: string,
  data: NonNullable<PassiveSinglePageCrawlResultDto["data"]>,
  correlationId: string
): Promise<PassiveSinglePageCrawlResultDto> {
  const result: PassiveSinglePageCrawlResultDto = {
    ok: true,
    data
  };

  store.passiveSinglePageResults.set(executionId, {
    executionId,
    result,
    updatedAt: nowIso()
  });

  await persistPassiveSinglePageResult({
    executionId,
    ok: true,
    entryUrl: data.entryUrl,
    statusHttp: data.statusHttp,
    title: data.title,
    evidenceId: data.evidenceId,
    fetchedAt: data.fetchedAt,
    contentType: data.contentType,
    contentLength: data.contentLength,
    correlationId
  });

  return result;
}

export async function recordPassiveSinglePageCrawlError(
  executionId: string,
  error: PassiveSinglePageCrawlErrorDto,
  correlationId: string
): Promise<PassiveSinglePageCrawlResultDto> {
  const result: PassiveSinglePageCrawlResultDto = {
    ok: false,
    error
  };

  store.passiveSinglePageResults.set(executionId, {
    executionId,
    result,
    updatedAt: nowIso()
  });

  await persistPassiveSinglePageResult({
    executionId,
    ok: false,
    entryUrl: error.entryUrl,
    errorCode: error.errorCode,
    errorMessage: error.message,
    correlationId
  });

  return result;
}

export async function getPassiveSinglePageCrawlResult(executionId: string): Promise<PassiveSinglePageCrawlResultDto | undefined> {
  const inMemory = store.passiveSinglePageResults.get(executionId)?.result;
  if (inMemory) {
    return inMemory;
  }

  if (!isPrismaPersistenceEnabled()) {
    return undefined;
  }

  const persisted = await getPassiveSinglePageResultByExecutionId(executionId);
  if (!persisted) {
    return undefined;
  }

  let hydrated: PassiveSinglePageCrawlResultDto;
  if (
    persisted.ok &&
    persisted.statusHttp !== undefined &&
    persisted.evidenceId !== undefined &&
    persisted.evidenceId.length > 0 &&
    persisted.fetchedAt !== undefined
  ) {
    const statusHttp: number = persisted.statusHttp;
    const evidenceId: string = persisted.evidenceId;
    const fetchedAt: Date = persisted.fetchedAt;

    hydrated = {
      ok: true,
      data: {
        executionId: persisted.executionId,
        entryUrl: persisted.entryUrl,
        statusHttp,
        title: persisted.title,
        evidenceId,
        fetchedAt: fetchedAt.toISOString(),
        contentType: persisted.contentType,
        contentLength: persisted.contentLength
      }
    };
  } else {
    hydrated = {
      ok: false,
      error: {
        executionId: persisted.executionId,
        entryUrl: persisted.entryUrl,
        errorCode: (persisted.errorCode as PassiveSinglePageCrawlErrorDto["errorCode"]) ?? "internal_error",
        message: persisted.errorMessage ?? "persisted_error_without_message"
      }
    };
  }

  store.passiveSinglePageResults.set(executionId, {
    executionId,
    result: hydrated,
    updatedAt: nowIso()
  });

  return hydrated;
}

export async function createBrowserDomEvidence(
  executionId: string,
  input: {
    pageUrl: string;
    capturedAt: string;
    html: string;
    title?: string;
  },
  correlationId: string
): Promise<Evidence> {
  const evidence = createEvidence(executionId, EvidenceLevel.E2, "BROWSER_DOM_SNAPSHOT", "memory://browser-dom/pending", correlationId);
  const location = `memory://browser-dom/${evidence.id}`;
  const updatedEvidence: Evidence = {
    ...evidence,
    location,
    updatedAt: nowIso(),
    correlationId
  };

  store.evidences.set(updatedEvidence.id, updatedEvidence);
  store.browserDomSnapshots.set(updatedEvidence.id, {
    evidenceId: updatedEvidence.id,
    executionId,
    pageUrl: input.pageUrl,
    capturedAt: input.capturedAt,
    html: input.html,
    title: input.title
  });

  await persistEvidence(updatedEvidence);
  return updatedEvidence;
}

export async function createBrowserScreenshotEvidence(
  executionId: string,
  input: {
    pageUrl: string;
    capturedAt: string;
    dataUrl: string;
  },
  correlationId: string
): Promise<Evidence> {
  const evidence = createEvidence(executionId, EvidenceLevel.E2, "BROWSER_SCREENSHOT", "memory://browser-screenshot/pending", correlationId);
  const location = `memory://browser-screenshot/${evidence.id}`;
  const updatedEvidence: Evidence = {
    ...evidence,
    location,
    updatedAt: nowIso(),
    correlationId
  };

  store.evidences.set(updatedEvidence.id, updatedEvidence);
  store.browserScreenshots.set(updatedEvidence.id, {
    evidenceId: updatedEvidence.id,
    executionId,
    pageUrl: input.pageUrl,
    capturedAt: input.capturedAt,
    dataUrl: input.dataUrl
  });

  await persistEvidence(updatedEvidence);
  return updatedEvidence;
}

export function recordDynamicObservationSuccess(
  executionId: string,
  data: DynamicObservationSuccessDto
): DynamicObservationResultDto {
  const result: DynamicObservationResultDto = {
    ok: true,
    data
  };

  store.dynamicObservationResults.set(executionId, {
    executionId,
    result,
    updatedAt: nowIso()
  });

  return result;
}

export function recordDynamicObservationError(
  executionId: string,
  error: DynamicObservationErrorDto
): DynamicObservationResultDto {
  const result: DynamicObservationResultDto = {
    ok: false,
    error
  };

  store.dynamicObservationResults.set(executionId, {
    executionId,
    result,
    updatedAt: nowIso()
  });

  return result;
}

export function getDynamicObservationResult(executionId: string): DynamicObservationResultDto | undefined {
  return store.dynamicObservationResults.get(executionId)?.result;
}

export async function getExecutionByIdWithFallback(executionId: string): Promise<Execution | undefined> {
  const inMemory = store.executions.get(executionId);
  if (inMemory) {
    return inMemory;
  }

  if (!isPrismaPersistenceEnabled()) {
    return undefined;
  }

  const persisted = await getExecutionById(executionId);
  if (!persisted) {
    return undefined;
  }

  const hydrated: Execution = {
    id: persisted.id,
    projectId: persisted.projectId,
    authorizationId: persisted.authorizationId,
    targetId: persisted.targetId,
    state: persisted.state,
    operation: persisted.operation,
    entryUrl: persisted.entryUrl,
    redirectUrl: persisted.redirectUrl,
    correlationId: persisted.correlationId,
    createdAt: persisted.createdAt.toISOString(),
    updatedAt: persisted.updatedAt.toISOString()
  };

  store.executions.set(hydrated.id, hydrated);
  return hydrated;
}

export async function listOperationalExecutions(input: {
  states: ExecutionState[];
  from?: string;
  to?: string;
  limit: number;
}): Promise<Array<{ executionId: string; state: ExecutionState; entryUrl?: string; updatedAt: string }>> {
  if (isPrismaPersistenceEnabled()) {
    const rows = await listExecutionsByStateAndWindow(input);
    return rows.map((row) => ({
      executionId: row.id,
      state: row.state,
      entryUrl: row.entryUrl,
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  const fromTs = input.from ? Date.parse(input.from) : undefined;
  const toTs = input.to ? Date.parse(input.to) : undefined;

  return Array.from(store.executions.values())
    .filter((execution) => input.states.includes(execution.state))
    .filter((execution) => {
      const updatedTs = Date.parse(execution.updatedAt);
      if (fromTs !== undefined && updatedTs < fromTs) return false;
      if (toTs !== undefined && updatedTs > toTs) return false;
      return true;
    })
    .sort((a, b) => {
      const byUpdatedAt = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      if (byUpdatedAt !== 0) return byUpdatedAt;
      return a.id.localeCompare(b.id);
    })
    .slice(0, input.limit)
    .map((execution) => ({
      executionId: execution.id,
      state: execution.state,
      entryUrl: execution.entryUrl,
      updatedAt: execution.updatedAt
    }));
}

export async function transitionExecutionState(
  executionId: string,
  nextState: ExecutionState,
  correlationId: string,
  reason: string
): Promise<Execution> {
  const execution = store.executions.get(executionId);
  if (!execution) {
    throw new Error("execution_id_not_found");
  }

  const allowedTargets = ALLOWED_EXECUTION_TRANSITIONS[execution.state] ?? [];
  if (!allowedTargets.includes(nextState)) {
    throw new Error(`execution_state_transition_not_allowed:${execution.state}->${nextState}`);
  }

  const updated: Execution = {
    ...execution,
    state: nextState,
    updatedAt: nowIso(),
    correlationId
  };

  store.executions.set(updated.id, updated);
  store.executionTransitions.push({
    executionId,
    from: execution.state,
    to: nextState,
    reason,
    correlationId,
    timestamp: nowIso()
  });

  await updateExecutionState({
    executionId,
    state: nextState,
    correlationId,
    updatedAt: updated.updatedAt
  });

  return updated;
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

export async function createPassiveHtmlEvidence(
  executionId: string,
  input: {
    entryUrl: string;
    fetchedAt: string;
    statusHttp: number;
    contentType?: string;
    contentLength?: number;
    html: string;
    title?: string;
  },
  correlationId: string
): Promise<Evidence> {
  const evidence = createEvidence(executionId, EvidenceLevel.E2, "PASSIVE_HTML", "memory://passive-html/pending", correlationId);

  const location = `memory://passive-html/${evidence.id}`;
  const updatedEvidence: Evidence = {
    ...evidence,
    location,
    updatedAt: nowIso(),
    correlationId
  };

  store.evidences.set(updatedEvidence.id, updatedEvidence);
  store.passiveHtmlEvidences.set(updatedEvidence.id, {
    evidenceId: updatedEvidence.id,
    executionId,
    entryUrl: input.entryUrl,
    fetchedAt: input.fetchedAt,
    statusHttp: input.statusHttp,
    contentType: input.contentType,
    contentLength: input.contentLength,
    html: input.html,
    title: input.title
  });

  await persistEvidence(updatedEvidence);

  return updatedEvidence;
}

export async function getPassiveHtmlEvidenceReferenceByExecutionId(
  executionId: string
): Promise<{ executionId: string; evidenceId: string; location: string } | undefined> {
  const inMemoryEvidence = Array.from(store.evidences.values())
    .filter((evidence) => evidence.executionId === executionId && evidence.kind === "PASSIVE_HTML")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  if (inMemoryEvidence) {
    return {
      executionId,
      evidenceId: inMemoryEvidence.id,
      location: inMemoryEvidence.location
    };
  }

  if (!isPrismaPersistenceEnabled()) {
    return undefined;
  }

  const persistedEvidence = await getLatestEvidenceByExecutionIdAndKind(executionId, "PASSIVE_HTML");
  if (!persistedEvidence) {
    return undefined;
  }

  return {
    executionId,
    evidenceId: persistedEvidence.id,
    location: persistedEvidence.location
  };
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

export async function listEvidenceReferencesByExecutionId(input: {
  executionId: string;
  kind?: string;
  limit: number;
}): Promise<Array<{
  evidenceId: string;
  executionId: string;
  level: EvidenceLevel;
  kind: string;
  location: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}>> {
  const inMemory = Array.from(store.evidences.values())
    .filter((evidence) => evidence.executionId === input.executionId)
    .filter((evidence) => (input.kind ? evidence.kind === input.kind : true))
    .sort((a, b) => {
      const byUpdatedAt = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      if (byUpdatedAt !== 0) return byUpdatedAt;
      return a.id.localeCompare(b.id);
    })
    .slice(0, input.limit)
    .map((evidence) => ({
      evidenceId: evidence.id,
      executionId: evidence.executionId,
      level: evidence.level,
      kind: evidence.kind,
      location: evidence.location,
      correlationId: evidence.correlationId,
      createdAt: evidence.createdAt,
      updatedAt: evidence.updatedAt
    }));

  if (inMemory.length > 0 || !isPrismaPersistenceEnabled()) {
    return inMemory;
  }

  const persistedRows = await listEvidencesByExecutionIdAndKind({
    executionId: input.executionId,
    kind: input.kind,
    limit: input.limit
  });

  return persistedRows.map((row) => ({
    evidenceId: row.id,
    executionId: row.executionId,
    level: row.level as EvidenceLevel,
    kind: row.kind,
    location: row.location,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}
