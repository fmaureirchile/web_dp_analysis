import { randomUUID } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import {
  DynamicObservationResultDto,
  DynamicObservationSuccessDto,
  CreateAuthorizationDto,
  CreateEvidenceDto,
  CreateExecutionDto,
  CreateFindingDto,
  CreateFormFieldDto,
  CreateObservationDto,
  CreateOrganizationDto,
  CreatePageDto,
  CreateProjectDto,
  CreateReviewDecisionDto,
  CreateTargetDto,
  PassiveSinglePageCrawlResultDto,
  ScopeSimulationDto,
  StartDynamicObservationDto,
  StartPassiveSinglePageCrawlDto,
  ToggleKillSwitchDto
} from "../../../../packages/contracts/src";
import { EvidenceLevel, ExecutionState, ReviewState } from "../../../../packages/domain/src";
import { captureDynamicObservation } from "../../../worker-browser/src/dynamic-observation";
import {
  evaluatePassiveSinglePageScope,
  extractHtmlTitle,
  fetchPassiveSinglePageHtml
} from "../../../worker-crawler/src";
import {
  createAuthorization,
  createEvidence,
  createExecution,
  createFinding,
  createFormField,
  createObservation,
  createOrganization,
  createPage,
  createProject,
  createReviewDecision,
  createTarget,
  deleteDynamicObservationResult,
  deletePassiveSinglePageResult,
  getDynamicObservationResult,
  getPassiveSinglePageResult,
  simulateScope,
  saveDynamicObservationResult,
  savePassiveSinglePageResult,
  store,
  transitionExecutionState,
  toggleAuthorizationKillSwitch
} from "./in-memory-store";

const OPERATIONAL_STATES = ["COMPLETED", "COMPLETED_WITH_WARNINGS", "FAILED"] as const;

type OperationalState = (typeof OPERATIONAL_STATES)[number];

type VersionComparisonProbableCause =
  | "SITE_CHANGE"
  | "DOCUMENTATION_GAP"
  | "RULE_CHANGE_OR_INSTRUMENTATION"
  | "NO_CHANGES";

type VersionComparisonChange = {
  kind: "NEW_THIRD_PARTY" | "REMOVED_THIRD_PARTY" | "NEW_COOKIE" | "REMOVED_COOKIE" | "NEW_ENDPOINT";
  value: string;
  severity: "INFO" | "WARNING";
  probableCause: VersionComparisonProbableCause;
  message: string;
  requiresValidation: true;
};

type VersionComparisonResult =
  | {
      ok: true;
      data: {
        baselineExecutionId: string;
        currentExecutionId: string;
        analyzedAt: string;
        totals: {
          changes: number;
          newThirdParties: number;
          removedThirdParties: number;
          newCookies: number;
          removedCookies: number;
          newEndpoints: number;
        };
        alert: {
          status: "NO_CHANGES" | "CHANGES_DETECTED";
          probableCause: VersionComparisonProbableCause;
          message: string;
        };
        changes: VersionComparisonChange[];
      };
    }
  | {
      ok: false;
      error: {
        baselineExecutionId: string;
        currentExecutionId: string;
        errorCode: "invalid_execution_id" | "tracking_inventory_not_available" | "result_not_available";
        message: string;
      };
    };

const versionComparisonResults = new Map<string, VersionComparisonResult>();

type FileItem = {
  absolutePath: string;
  relativePath: string;
};

type RuleMatch = {
  rule: string;
  line: number;
  value?: string;
};

type FrontendIndexResult = {
  ok: true;
  data: {
    executionId: string;
    framework: "REACT" | "UNKNOWN";
    totalFiles: number;
    sampleFiles: Array<{ relativePath: string }>;
    evidenceId: string;
  };
};

type FrontendPatternResult = {
  ok: true;
  data: {
    executionId: string;
    totalFilesScanned: number;
    totalFilesWithMatches: number;
    totalMatches: number;
    files: Array<{ relativePath: string; matches: RuleMatch[] }>;
    evidenceId: string;
  };
};

type BackendApiIndexResult = {
  ok: true;
  data: {
    executionId: string;
    totalArtifacts: number;
    artifactTypeCounts: Array<{ artifactType: "OPENAPI" | "ROUTE" | "GRAPHQL" | "DTO"; count: number }>;
    artifacts: Array<{ relativePath: string; artifactType: "OPENAPI" | "ROUTE" | "GRAPHQL" | "DTO" }>;
    evidenceId: string;
  };
};

type BackendProcessingResult = {
  ok: true;
  data: {
    executionId: string;
    totalFilesScanned: number;
    totalFilesWithMatches: number;
    totalMatches: number;
    files: Array<{ relativePath: string; matches: RuleMatch[] }>;
    evidenceId: string;
  };
};

const frontendIndexResults = new Map<string, FrontendIndexResult>();
const frontendPatternResults = new Map<string, FrontendPatternResult>();
const backendApiIndexResults = new Map<string, BackendApiIndexResult>();
const backendProcessingResults = new Map<string, BackendProcessingResult>();
const legalDiscrepancyResults = new Map<string, { ok: true; data: { executionId: string; totals: { discrepancies: number; observedCategories: number }; discrepancies: Array<{ kind: string; message: string }> } }>();

function versionComparisonKey(baselineExecutionId: string, currentExecutionId: string): string {
  return `${baselineExecutionId}::${currentExecutionId}`;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function collectThirdParties(result: DynamicObservationSuccessDto): Set<string> {
  return new Set(
    uniqueSorted(
      result.network
        .map((item) => item.thirdPartyDomain?.trim().toLowerCase())
        .filter((item): item is string => typeof item === "string" && item.length > 0)
    )
  );
}

function collectCookies(result: DynamicObservationSuccessDto): Set<string> {
  return new Set(
    uniqueSorted(
      result.storage
        .filter((item) => item.kind === "COOKIE")
        .map((item) => item.key.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  );
}

function normalizeEndpointSignature(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function collectEndpoints(result: DynamicObservationSuccessDto): Set<string> {
  return new Set(uniqueSorted(result.network.map((item) => normalizeEndpointSignature(item.url)).filter((item) => item.length > 0)));
}

function versionComparisonError(
  baselineExecutionId: string,
  currentExecutionId: string,
  errorCode: "invalid_execution_id" | "tracking_inventory_not_available" | "result_not_available",
  message: string
): VersionComparisonResult {
  return {
    ok: false,
    error: {
      baselineExecutionId,
      currentExecutionId,
      errorCode,
      message
    }
  };
}

function isClosedExecutionState(state: ExecutionState): boolean {
  return (
    state === ExecutionState.COMPLETED ||
    state === ExecutionState.COMPLETED_WITH_WARNINGS ||
    state === ExecutionState.FAILED ||
    state === ExecutionState.CANCELLED
  );
}

function purgeExecutionArtifacts(executionId: string): {
  dynamicObservationResult: number;
  passiveSinglePageResult: number;
  evidences: number;
  versionComparisons: number;
} {
  const dynamicObservationResult = deleteDynamicObservationResult(executionId) ? 1 : 0;
  const passiveSinglePageResult = deletePassiveSinglePageResult(executionId) ? 1 : 0;

  let evidences = 0;
  for (const [evidenceId, evidence] of Array.from(store.evidences.entries())) {
    if (evidence.executionId === executionId) {
      store.evidences.delete(evidenceId);
      evidences += 1;
    }
  }

  let versionComparisons = 0;
  for (const key of Array.from(versionComparisonResults.keys())) {
    const [baselineExecutionId, currentExecutionId] = key.split("::");
    if (baselineExecutionId === executionId || currentExecutionId === executionId) {
      versionComparisonResults.delete(key);
      versionComparisons += 1;
    }
  }

  return {
    dynamicObservationResult,
    passiveSinglePageResult,
    evidences,
    versionComparisons
  };
}

function parseStatesFilter(raw: unknown): OperationalState[] {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [...OPERATIONAL_STATES];
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 0) {
    return [...OPERATIONAL_STATES];
  }

  if (uniqueValues.some((value) => !OPERATIONAL_STATES.includes(value as OperationalState))) {
    throw new Error("invalid_states_filter");
  }

  return uniqueValues as OperationalState[];
}

function parseIsoFilter(raw: unknown, errorCode: string): string | undefined {
  if (typeof raw === "undefined") {
    return undefined;
  }

  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
    throw new Error(errorCode);
  }

  return raw;
}

function parseLimitFilter(raw: unknown): number {
  if (typeof raw === "undefined") {
    return 50;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error("invalid_limit_filter");
  }

  return value;
}

function parseCursorFilter(raw: unknown): number {
  if (typeof raw === "undefined") {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("invalid_cursor");
  }

  return value;
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

async function collectRepositoryFiles(repositoryPath: string, maxFiles: number): Promise<FileItem[]> {
  try {
    const info = await stat(repositoryPath);
    if (!info.isDirectory()) {
      throw new Error("repository_path_not_found");
    }
  } catch {
    throw new Error("repository_path_not_found");
  }

  const collected: FileItem[] = [];
  const queue: string[] = [repositoryPath];

  while (queue.length > 0 && collected.length < maxFiles) {
    const current = queue.shift()!;
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (collected.length >= maxFiles) {
        break;
      }

      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
      } else if (entry.isFile()) {
        collected.push({
          absolutePath,
          relativePath: toPosixPath(path.relative(repositoryPath, absolutePath))
        });
      }
    }
  }

  return collected;
}

function matchesFrontendCandidate(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  return (
    normalized.endsWith(".ts") ||
    normalized.endsWith(".tsx") ||
    normalized.endsWith(".js") ||
    normalized.endsWith(".jsx") ||
    normalized.endsWith(".html")
  );
}

function detectFrontendRules(content: string, maxMatchesPerFile: number): RuleMatch[] {
  const rules: Array<{ rule: string; pattern: RegExp }> = [
    { rule: "FORM_INPUT", pattern: /<input\b/i },
    { rule: "NETWORK_FETCH", pattern: /\bfetch\s*\(/i },
    { rule: "COOKIE_ACCESS", pattern: /document\.cookie/i },
    { rule: "STORAGE_ACCESS", pattern: /\b(localStorage|sessionStorage)\b/i },
    { rule: "ANALYTICS_BEACON", pattern: /sendBeacon\s*\(/i }
  ];

  const lines = content.split(/\r?\n/);
  const matches: RuleMatch[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const candidate of rules) {
      if (candidate.pattern.test(line)) {
        const fetchMatch = line.match(/\bfetch\s*\(\s*["'`](\/[^"'`]*)["'`]/i);
        matches.push({
          rule: candidate.rule,
          line: index + 1,
          value: candidate.rule === "NETWORK_FETCH" ? fetchMatch?.[1] : undefined
        });
        if (matches.length >= maxMatchesPerFile) {
          return matches;
        }
      }
    }
  }

  return matches;
}

function detectBackendProcessingRules(content: string, maxMatchesPerFile: number): RuleMatch[] {
  const rules: Array<{ rule: string; pattern: RegExp }> = [
    { rule: "ROUTE_HANDLER", pattern: /\brouter\.(get|post|put|patch|delete)\s*\(/i },
    { rule: "CONTROLLER_USAGE", pattern: /controller/i },
    { rule: "SERVICE_USAGE", pattern: /service/i },
    { rule: "INTEGRATION_USAGE", pattern: /\b(prisma|axios|fetch)\b/i }
  ];

  const lines = content.split(/\r?\n/);
  const matches: RuleMatch[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const candidate of rules) {
      if (candidate.pattern.test(line)) {
        const endpointMatch = line.match(/\brouter\.(?:get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*)["'`]/i);
        matches.push({
          rule: candidate.rule,
          line: index + 1,
          value: candidate.rule === "ROUTE_HANDLER" ? endpointMatch?.[1] : undefined
        });
        if (matches.length >= maxMatchesPerFile) {
          return matches;
        }
      }
    }
  }

  return matches;
}

function persistEvidenceLocation(evidenceId: string, location: string): void {
  const existing = store.evidences.get(evidenceId);
  if (!existing) {
    return;
  }

  store.evidences.set(evidenceId, { ...existing, location });
}

function correlationId(req: Request): string {
  const value = req.header("x-correlation-id");
  return value && value.trim().length > 0 ? value : randomUUID();
}

function ok<T>(res: Response, data: T, cid: string): void {
  res.status(201).setHeader("x-correlation-id", cid).json({ data });
}

function notFound(res: Response, message: string, cid: string): void {
  res.status(400).setHeader("x-correlation-id", cid).json({ error: message });
}

export function createStage2Router(): Router {
  const router = Router();

  router.post("/organizations", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateOrganizationDto;
    try {
      ok(res, await createOrganization(body.name, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.get("/organizations/:id", (req, res) => {
    const cid = correlationId(req);
    const entity = store.organizations.get(req.params.id);
    if (!entity) return notFound(res, "organization_not_found", cid);
    res.setHeader("x-correlation-id", cid).json({ data: entity });
  });

  router.post("/projects", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateProjectDto;
    try {
      ok(res, await createProject(body.organizationId, body.name, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/authorizations", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateAuthorizationDto;
    try {
      ok(
        res,
        await createAuthorization(
          body.projectId,
          body.validFrom,
          body.validTo,
          {
            allowedDomains: body.allowedDomains,
            allowSubdomains: body.allowSubdomains,
            excludedPaths: body.excludedPaths,
            permittedOperations: body.permittedOperations,
            prohibitedActions: body.prohibitedActions,
            maxRequestsPerMinute: body.maxRequestsPerMinute,
            maxConcurrentExecutions: body.maxConcurrentExecutions,
            maxDepth: body.maxDepth,
            maxDurationSeconds: body.maxDurationSeconds,
            agentId: body.agentId,
            emergencyContact: body.emergencyContact
          },
          cid
        ),
        cid
      );
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/authorizations/:id/kill-switch", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as ToggleKillSwitchDto;
    try {
      ok(res, await toggleAuthorizationKillSwitch(req.params.id, body.active, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/targets", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateTargetDto;
    try {
      ok(res, await createTarget(body.projectId, body.authorizationId, body.baseUrl, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/executions", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateExecutionDto;
    try {
      ok(
        res,
        await createExecution(
          body.projectId,
          body.authorizationId,
          body.targetId,
          body.state ?? ExecutionState.DRAFT,
          body.operation ?? "SCAN_PASSIVE",
          body.entryUrl,
          body.redirectUrl,
          cid
        ),
        cid
      );
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/crawler/passive/single-page", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartPassiveSinglePageCrawlDto;
    const execution = store.executions.get(body.executionId);

    if (!execution) {
      return res.status(404).setHeader("x-correlation-id", cid).json({ errorCode: "execution_not_found" });
    }

    try {
      transitionExecutionState(execution.id, ExecutionState.QUEUED, cid);
      transitionExecutionState(execution.id, ExecutionState.RUNNING, cid);

      const scopeResult = await evaluatePassiveSinglePageScope(
        {
          request: body,
          authorizationId: execution.authorizationId,
          operation: execution.operation,
          correlationId: cid
        },
        {
          runScopeSimulation: async (input) =>
            simulateScope(input.authorizationId, input.entryUrl, input.operation, undefined, input.correlationId)
        }
      );

      if (!scopeResult.allowed) {
        transitionExecutionState(execution.id, ExecutionState.FAILED, cid);
        const errorResult: PassiveSinglePageCrawlResultDto = { ok: false, error: scopeResult.error };
        savePassiveSinglePageResult(execution.id, errorResult);
        return res.status(403).setHeader("x-correlation-id", cid).json(scopeResult.error);
      }

      const fetched = await fetchPassiveSinglePageHtml(body);

      if (!fetched.ok) {
        transitionExecutionState(execution.id, ExecutionState.FAILED, cid);
        const errorResult: PassiveSinglePageCrawlResultDto = { ok: false, error: fetched.error };
        savePassiveSinglePageResult(execution.id, errorResult);
        return res.status(422).setHeader("x-correlation-id", cid).json(fetched.error);
      }

      const evidence = createEvidence(execution.id, EvidenceLevel.E2, "PASSIVE_HTML", "memory://passive-html/pending", cid);
      persistEvidenceLocation(evidence.id, `memory://passive-html/${evidence.id}`);

      const successData = {
        executionId: execution.id,
        entryUrl: body.entryUrl,
        statusHttp: fetched.data.statusHttp,
        title: extractHtmlTitle(fetched.data.html),
        evidenceId: evidence.id,
        fetchedAt: fetched.data.fetchedAt,
        contentType: fetched.data.contentType,
        contentLength: fetched.data.contentLength
      };

      transitionExecutionState(execution.id, ExecutionState.COMPLETED, cid);
      const successResult: PassiveSinglePageCrawlResultDto = { ok: true, data: successData };
      savePassiveSinglePageResult(execution.id, successResult);

      return res.status(200).setHeader("x-correlation-id", cid).json(successResult);
    } catch (error) {
      const message = (error as Error).message;
      transitionExecutionState(execution.id, ExecutionState.FAILED, cid);
      const errorResult: PassiveSinglePageCrawlResultDto = {
        ok: false,
        error: {
          executionId: execution.id,
          entryUrl: body.entryUrl,
          errorCode: "internal_error",
          message
        }
      };
      savePassiveSinglePageResult(execution.id, errorResult);
      return res.status(422).setHeader("x-correlation-id", cid).json(errorResult.error);
    }
  });

  router.get("/crawler/passive/single-page/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = getPassiveSinglePageResult(req.params.executionId);

    if (!result) {
      return res.status(404).setHeader("x-correlation-id", cid).json({ error: "result_not_found" });
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/crawler/passive/executions/operational", (req, res) => {
    const cid = correlationId(req);

    try {
      const states = parseStatesFilter(req.query.states);
      const from = parseIsoFilter(req.query.from, "invalid_from_filter");
      const to = parseIsoFilter(req.query.to, "invalid_to_filter");
      const limit = parseLimitFilter(req.query.limit);
      const fromTs = from ? Date.parse(from) : undefined;
      const toTs = to ? Date.parse(to) : undefined;

      const items = Array.from(store.executions.values())
        .filter((execution) => states.includes(execution.state as OperationalState))
        .filter((execution) => {
          const executionTs = Date.parse(execution.updatedAt);
          if (typeof fromTs === "number" && executionTs < fromTs) return false;
          if (typeof toTs === "number" && executionTs > toTs) return false;
          return true;
        })
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, limit)
        .map((execution) => {
          const result = getPassiveSinglePageResult(execution.id);
          const success = result?.ok ? result.data : undefined;
          const failure = result && !result.ok ? result.error : undefined;

          return {
            executionId: execution.id,
            state: execution.state,
            entryUrl: execution.entryUrl,
            updatedAt: execution.updatedAt,
            resultAvailable: Boolean(result),
            statusHttp: success?.statusHttp,
            title: success?.title,
            evidenceId: success?.evidenceId,
            errorCode: failure?.errorCode
          };
        });

      return res.status(200).setHeader("x-correlation-id", cid).json({
        data: {
          states,
          from,
          to,
          limit,
          items
        }
      });
    } catch (error) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: (error as Error).message });
    }
  });

  router.post("/browser/observations/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartDynamicObservationDto;
    const execution = store.executions.get(body.executionId);

    if (!execution) {
      return res.status(404).setHeader("x-correlation-id", cid).json({ errorCode: "invalid_execution_id" });
    }

    transitionExecutionState(execution.id, ExecutionState.QUEUED, cid);
    transitionExecutionState(execution.id, ExecutionState.RUNNING, cid);

    const captured = await captureDynamicObservation(body);

    if (!captured.ok) {
      transitionExecutionState(execution.id, ExecutionState.FAILED, cid);
      const errorResult: DynamicObservationResultDto = { ok: false, error: captured.error };
      saveDynamicObservationResult(execution.id, errorResult);
      return res.status(422).setHeader("x-correlation-id", cid).json(captured.error);
    }

    const domEvidence = createEvidence(
      execution.id,
      EvidenceLevel.E2,
      "BROWSER_DOM_SNAPSHOT",
      "memory://browser-dom/pending",
      cid
    );
    const screenshotEvidence = createEvidence(
      execution.id,
      EvidenceLevel.E2,
      "BROWSER_SCREENSHOT",
      "memory://browser-screenshot/pending",
      cid
    );

    persistEvidenceLocation(domEvidence.id, `memory://browser-dom/${domEvidence.id}`);
    persistEvidenceLocation(screenshotEvidence.id, `memory://browser-screenshot/${screenshotEvidence.id}`);

    const successData: DynamicObservationSuccessDto = {
      executionId: execution.id,
      entryUrl: captured.data.entryUrl,
      completedAt: captured.data.completedAt,
      pageSnapshots: [
        {
          pageUrl: captured.data.entryUrl,
          title: captured.data.title,
          capturedAt: captured.data.completedAt,
          domEvidenceId: domEvidence.id,
          screenshotEvidenceId: screenshotEvidence.id
        }
      ],
      network: captured.data.network,
      storage: captured.data.storage,
      events: captured.data.events,
      consentEvaluation: captured.data.consentEvaluation
    };

    transitionExecutionState(execution.id, ExecutionState.COMPLETED, cid);
    const successResult: DynamicObservationResultDto = { ok: true, data: successData };
    saveDynamicObservationResult(execution.id, successResult);

    return res.status(200).setHeader("x-correlation-id", cid).json(successResult);
  });

  router.get("/browser/observations/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = getDynamicObservationResult(req.params.executionId);

    if (!result) {
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json({
          executionId: req.params.executionId,
          errorCode: "internal_error",
          message: "dynamic_observation_result_not_available"
        });
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/monitoring/version-comparisons/start", (req, res) => {
    const cid = correlationId(req);
    const baselineExecutionId = String(req.body?.baselineExecutionId ?? "").trim();
    const currentExecutionId = String(req.body?.currentExecutionId ?? "").trim();

    if (baselineExecutionId.length === 0 || currentExecutionId.length === 0) {
      const failure = versionComparisonError(
        baselineExecutionId || "unknown_baseline",
        currentExecutionId || "unknown_current",
        "invalid_execution_id",
        "baseline_execution_id_and_current_execution_id_required"
      );
      return res.status(400).setHeader("x-correlation-id", cid).json(failure);
    }

    if (!store.executions.has(baselineExecutionId) || !store.executions.has(currentExecutionId)) {
      const failure = versionComparisonError(
        baselineExecutionId,
        currentExecutionId,
        "invalid_execution_id",
        "execution_id_not_found"
      );
      return res.status(400).setHeader("x-correlation-id", cid).json(failure);
    }

    const baselineDynamic = getDynamicObservationResult(baselineExecutionId);
    const currentDynamic = getDynamicObservationResult(currentExecutionId);
    if (!baselineDynamic?.ok || !baselineDynamic.data || !currentDynamic?.ok || !currentDynamic.data) {
      const failure = versionComparisonError(
        baselineExecutionId,
        currentExecutionId,
        "tracking_inventory_not_available",
        "dynamic_observation_result_not_available"
      );
      versionComparisonResults.set(versionComparisonKey(baselineExecutionId, currentExecutionId), failure);
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    const baselineThirdParties = collectThirdParties(baselineDynamic.data);
    const currentThirdParties = collectThirdParties(currentDynamic.data);
    const baselineCookies = collectCookies(baselineDynamic.data);
    const currentCookies = collectCookies(currentDynamic.data);
    const baselineEndpoints = collectEndpoints(baselineDynamic.data);
    const currentEndpoints = collectEndpoints(currentDynamic.data);

    const newEndpoints = uniqueSorted(Array.from(currentEndpoints).filter((item) => !baselineEndpoints.has(item)));
    const changes: VersionComparisonChange[] = [];

    for (const item of uniqueSorted(currentThirdParties)) {
      if (!baselineThirdParties.has(item)) {
        changes.push({
          kind: "NEW_THIRD_PARTY",
          value: item,
          severity: "WARNING",
          probableCause: newEndpoints.length > 0 ? "SITE_CHANGE" : "DOCUMENTATION_GAP",
          message: `No se observo ${item} en baseline y ahora si se observo. Existe un cambio tecnico probable. Requiere validacion.`,
          requiresValidation: true
        });
      }
    }

    for (const item of uniqueSorted(baselineThirdParties)) {
      if (!currentThirdParties.has(item)) {
        changes.push({
          kind: "REMOVED_THIRD_PARTY",
          value: item,
          severity: "INFO",
          probableCause: "RULE_CHANGE_OR_INSTRUMENTATION",
          message: `Se observo ${item} en baseline y ahora no se observo. Existe un cambio tecnico probable. Requiere validacion.`,
          requiresValidation: true
        });
      }
    }

    for (const item of uniqueSorted(currentCookies)) {
      if (!baselineCookies.has(item)) {
        changes.push({
          kind: "NEW_COOKIE",
          value: item,
          severity: "WARNING",
          probableCause: newEndpoints.length > 0 ? "SITE_CHANGE" : "DOCUMENTATION_GAP",
          message: `No se observo cookie ${item} en baseline y ahora si se observo. Existe un cambio tecnico probable. Requiere validacion.`,
          requiresValidation: true
        });
      }
    }

    for (const item of uniqueSorted(baselineCookies)) {
      if (!currentCookies.has(item)) {
        changes.push({
          kind: "REMOVED_COOKIE",
          value: item,
          severity: "INFO",
          probableCause: "RULE_CHANGE_OR_INSTRUMENTATION",
          message: `Se observo cookie ${item} en baseline y ahora no se observo. Existe un cambio tecnico probable. Requiere validacion.`,
          requiresValidation: true
        });
      }
    }

    for (const item of newEndpoints) {
      changes.push({
        kind: "NEW_ENDPOINT",
        value: item,
        severity: "WARNING",
        probableCause: "SITE_CHANGE",
        message: `No se observo endpoint ${item} en baseline y ahora si se observo. Existe un cambio tecnico probable. Requiere validacion.`,
        requiresValidation: true
      });
    }

    const probableCause: VersionComparisonProbableCause =
      changes.length === 0
        ? "NO_CHANGES"
        : changes.some((item) => item.kind === "NEW_ENDPOINT")
          ? "SITE_CHANGE"
          : changes.some((item) => item.kind === "NEW_THIRD_PARTY" || item.kind === "NEW_COOKIE")
            ? "DOCUMENTATION_GAP"
            : "RULE_CHANGE_OR_INSTRUMENTATION";

    const result: VersionComparisonResult = {
      ok: true,
      data: {
        baselineExecutionId,
        currentExecutionId,
        analyzedAt: new Date().toISOString(),
        totals: {
          changes: changes.length,
          newThirdParties: changes.filter((item) => item.kind === "NEW_THIRD_PARTY").length,
          removedThirdParties: changes.filter((item) => item.kind === "REMOVED_THIRD_PARTY").length,
          newCookies: changes.filter((item) => item.kind === "NEW_COOKIE").length,
          removedCookies: changes.filter((item) => item.kind === "REMOVED_COOKIE").length,
          newEndpoints: changes.filter((item) => item.kind === "NEW_ENDPOINT").length
        },
        alert: {
          status: changes.length === 0 ? "NO_CHANGES" : "CHANGES_DETECTED",
          probableCause,
          message:
            changes.length === 0
              ? "No se observaron cambios entre baseline y actual."
              : "Existe un cambio tecnico probable entre baseline y actual. Requiere validacion."
        },
        changes
      }
    };

    versionComparisonResults.set(versionComparisonKey(baselineExecutionId, currentExecutionId), result);
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/monitoring/version-comparisons/:baselineExecutionId/:currentExecutionId/result", (req, res) => {
    const cid = correlationId(req);
    const { baselineExecutionId, currentExecutionId } = req.params;

    if (!store.executions.has(baselineExecutionId) || !store.executions.has(currentExecutionId)) {
      const failure = versionComparisonError(
        baselineExecutionId,
        currentExecutionId,
        "invalid_execution_id",
        "execution_id_not_found"
      );
      return res.status(400).setHeader("x-correlation-id", cid).json(failure);
    }

    const result = versionComparisonResults.get(versionComparisonKey(baselineExecutionId, currentExecutionId));
    if (!result) {
      const failure = versionComparisonError(
        baselineExecutionId,
        currentExecutionId,
        "result_not_available",
        "version_comparison_result_not_available"
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/privacy/executions/:executionId/purge", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: "invalid_execution_id",
          message: "execution_id_not_found"
        }
      });
    }

    const deletedCounts = purgeExecutionArtifacts(executionId);

    return res.status(200).setHeader("x-correlation-id", cid).json({
      ok: true,
      data: {
        executionId,
        purgedAt: new Date().toISOString(),
        deletedCounts
      }
    });
  });

  router.post("/privacy/retention/apply", (req, res) => {
    const cid = correlationId(req);
    const windowMinutes = Number(req.body?.windowMinutes);

    if (!Number.isInteger(windowMinutes) || windowMinutes <= 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          errorCode: "invalid_window_minutes",
          message: "window_minutes_must_be_positive_integer"
        }
      });
    }

    const threshold = Date.now() - windowMinutes * 60_000;
    const candidates = Array.from(store.executions.values()).filter((execution) => {
      if (!isClosedExecutionState(execution.state)) {
        return false;
      }
      const updatedAtTs = Date.parse(execution.updatedAt);
      return Number.isFinite(updatedAtTs) && updatedAtTs < threshold;
    });

    let purgedExecutions = 0;
    const deletedTotals = {
      dynamicObservationResult: 0,
      passiveSinglePageResult: 0,
      evidences: 0,
      versionComparisons: 0
    };

    for (const execution of candidates) {
      const deleted = purgeExecutionArtifacts(execution.id);
      purgedExecutions += 1;
      deletedTotals.dynamicObservationResult += deleted.dynamicObservationResult;
      deletedTotals.passiveSinglePageResult += deleted.passiveSinglePageResult;
      deletedTotals.evidences += deleted.evidences;
      deletedTotals.versionComparisons += deleted.versionComparisons;
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      ok: true,
      data: {
        windowMinutes,
        candidateExecutions: candidates.length,
        purgedExecutions,
        deletedTotals,
        appliedAt: new Date().toISOString()
      }
    });
  });

  router.post("/scope/simulations", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as ScopeSimulationDto;
    try {
      res.status(200).setHeader("x-correlation-id", cid).json({
        data: await simulateScope(body.authorizationId, body.url, body.operation, body.redirectUrl, cid)
      });
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.get("/scope/audits", (req, res) => {
    const cid = correlationId(req);
    res.status(200).setHeader("x-correlation-id", cid).json({ data: store.scopeAuditRequests });
  });

  router.post("/pages", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreatePageDto;
    try {
      ok(res, createPage(body.executionId, body.url, body.title, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/form-fields", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateFormFieldDto;
    try {
      ok(res, createFormField(body.pageId, body.name, body.type, body.required, body.formId, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/observations", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateObservationDto;
    try {
      ok(
        res,
        createObservation(
          body.executionId,
          body.description,
          body.reviewState ?? ReviewState.PENDING,
          body.pageId,
          body.formFieldId,
          cid
        ),
        cid
      );
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/evidences", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateEvidenceDto;
    try {
      ok(res, createEvidence(body.executionId, body.level, body.kind, body.location, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/findings", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateFindingDto;
    try {
      ok(res, createFinding(body.projectId, body.summary, body.evidenceIds, body.reviewState ?? ReviewState.PENDING, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.post("/review-decisions", (req, res) => {
    const cid = correlationId(req);
    const body = req.body as CreateReviewDecisionDto;
    try {
      ok(res, createReviewDecision(body.findingId, body.reviewState, body.comment, cid), cid);
    } catch (error) {
      notFound(res, (error as Error).message, cid);
    }
  });

  router.get("/evidences", (req, res) => {
    const cid = correlationId(req);
    const executionId = typeof req.query.executionId === "string" ? req.query.executionId : "";
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;

    if (executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_required" });
    }

    try {
      const from = parseIsoFilter(req.query.from, "invalid_from_filter");
      const to = parseIsoFilter(req.query.to, "invalid_to_filter");
      const limit = parseLimitFilter(req.query.limit);
      const cursor = parseCursorFilter(req.query.cursor);

      if (from && to && Date.parse(from) > Date.parse(to)) {
        return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_time_window" });
      }

      const fromTs = from ? Date.parse(from) : undefined;
      const toTs = to ? Date.parse(to) : undefined;

      const allItems = Array.from(store.evidences.values())
        .filter((item) => item.executionId === executionId)
        .filter((item) => (kind ? item.kind === kind : true))
        .filter((item) => {
          const createdAtTs = Date.parse(item.createdAt);
          if (typeof fromTs === "number" && createdAtTs < fromTs) return false;
          if (typeof toTs === "number" && createdAtTs > toTs) return false;
          return true;
        })
        .sort((left, right) => {
          const delta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
          if (delta !== 0) return delta;
          return left.id.localeCompare(right.id);
        });

      const pageItems = allItems.slice(cursor, cursor + limit);
      const nextCursor = cursor + limit < allItems.length ? String(cursor + limit) : undefined;

      return res.status(200).setHeader("x-correlation-id", cid).json({
        data: {
          executionId,
          kind,
          from,
          to,
          limit,
          cursor: String(cursor),
          nextCursor,
          items: pageItems.map((item) => ({
            evidenceId: item.id,
            level: item.level,
            kind: item.kind,
            location: item.location,
            createdAt: item.createdAt
          }))
        }
      });
    } catch (error) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: (error as Error).message });
    }
  });

  router.get("/reports/executions/:executionId/executive-summary", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const evidences = Array.from(store.evidences.values()).filter((item) => item.executionId === executionId);
    const observations = Array.from(store.observations.values()).filter((item) => item.executionId === executionId);

    const byKindMap = new Map<string, { kind: string; count: number; evidenceIds: string[] }>();
    const byLevelMap = new Map<string, { level: string; count: number; evidenceIds: string[] }>();

    for (const evidence of evidences) {
      const byKind = byKindMap.get(evidence.kind) ?? { kind: evidence.kind, count: 0, evidenceIds: [] };
      byKind.count += 1;
      byKind.evidenceIds.push(evidence.id);
      byKindMap.set(evidence.kind, byKind);

      const byLevel = byLevelMap.get(evidence.level) ?? { level: evidence.level, count: 0, evidenceIds: [] };
      byLevel.count += 1;
      byLevel.evidenceIds.push(evidence.id);
      byLevelMap.set(evidence.level, byLevel);
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          evidences: evidences.length,
          observations: observations.length
        },
        evidenceByKind: Array.from(byKindMap.values()).sort((left, right) => left.kind.localeCompare(right.kind)),
        evidenceByLevel: Array.from(byLevelMap.values()).sort((left, right) => left.level.localeCompare(right.level))
      }
    });
  });

  router.get("/reports/executions/:executionId/form-inventory", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const pageId = typeof req.query.pageId === "string" ? req.query.pageId : undefined;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const pages = Array.from(store.pages.values()).filter((item) => item.executionId === executionId);
    if (pageId && !pages.some((item) => item.id === pageId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "page_id_not_found" });
    }

    const selectedPages = pageId ? pages.filter((item) => item.id === pageId) : pages;
    const selectedPageIds = new Set(selectedPages.map((item) => item.id));
    const fields = Array.from(store.formFields.values()).filter((item) => selectedPageIds.has(item.pageId));
    const observations = Array.from(store.observations.values()).filter(
      (item) => item.executionId === executionId && (!item.pageId || selectedPageIds.has(item.pageId))
    );

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          pages: selectedPages.length,
          fields: fields.length,
          observations: observations.length
        },
        pages: selectedPages.map((page) => {
          const pageFields = fields.filter((item) => item.pageId === page.id);
          return {
            pageId: page.id,
            url: page.url,
            title: page.title,
            fields: pageFields.map((field) => ({
              fieldId: field.id,
              formId: field.formId,
              name: field.name,
              type: field.type,
              required: field.required,
              observations: observations.filter((item) => item.formFieldId === field.id).length
            }))
          };
        })
      }
    });
  });

  router.get("/reports/executions/:executionId/tracking-inventory", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const dynamic = getDynamicObservationResult(executionId);
    if (!dynamic?.ok || !dynamic.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "tracking_inventory_not_available" });
    }

    const thirdPartyMap = new Map<string, { domain: string; requestIds: Set<string>; urls: Set<string>; requestCount: number }>();
    for (const item of dynamic.data.network) {
      if (!item.thirdPartyDomain) continue;
      const key = normalizeDomain(item.thirdPartyDomain);
      const row =
        thirdPartyMap.get(key) ?? { domain: key, requestIds: new Set<string>(), urls: new Set<string>(), requestCount: 0 };
      row.requestCount += 1;
      row.requestIds.add(item.requestId);
      row.urls.add(item.url);
      thirdPartyMap.set(key, row);
    }

    const cookieItems = dynamic.data.storage.filter((item) => item.kind === "COOKIE");
    const cookieMap = new Map<string, { key: string; observations: number }>();
    for (const item of cookieItems) {
      const key = normalizeDomain(item.key);
      const row = cookieMap.get(key) ?? { key, observations: 0 };
      row.observations += 1;
      cookieMap.set(key, row);
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          thirdParties: thirdPartyMap.size,
          cookies: cookieMap.size,
          cookieObservations: cookieItems.length
        },
        thirdParties: Array.from(thirdPartyMap.values())
          .map((item) => ({
            domain: item.domain,
            requestCount: item.requestCount,
            requestIds: Array.from(item.requestIds),
            urls: Array.from(item.urls)
          }))
          .sort((left, right) => left.domain.localeCompare(right.domain)),
        cookies: Array.from(cookieMap.values()).sort((left, right) => left.key.localeCompare(right.key))
      }
    });
  });

  router.post("/auth/evaluations/start", async (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const entryUrl = String(req.body?.entryUrl ?? "").trim();
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    const role = String(req.body?.role ?? "").trim().toLowerCase();

    const execution = store.executions.get(executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: "invalid_execution_id",
          message: "execution_id_not_found"
        }
      });
    }

    if (!entryUrl || !username || !password || (role !== "cliente" && role !== "supervisor")) {
      return res.status(400).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: "invalid_entry_url",
          message: "invalid_authenticated_evaluation_input"
        }
      });
    }

    const sessionScopeId = `${execution.id}:${role}`;
    transitionExecutionState(execution.id, ExecutionState.QUEUED, cid);
    transitionExecutionState(execution.id, ExecutionState.RUNNING, cid);

    try {
      const login = await fetch(`${entryUrl}/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-synthetic-client-id": sessionScopeId
        },
        body: JSON.stringify({ username, password, role })
      });

      if (login.status !== 200) {
        throw new Error(`auth_login_failed:${login.status}`);
      }

      const profile = await fetch(`${entryUrl}/profile`, {
        method: "GET",
        headers: {
          "x-synthetic-client-id": sessionScopeId
        }
      });

      if (profile.status !== 200) {
        throw new Error(`auth_profile_failed:${profile.status}`);
      }

      const profilePayload = (await profile.json()) as {
        profile: {
          username: string;
          role: string;
          panel: string;
        };
      };

      const logout = await fetch(`${entryUrl}/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-synthetic-client-id": sessionScopeId
        },
        body: JSON.stringify({})
      });

      if (logout.status !== 200) {
        throw new Error(`auth_logout_failed:${logout.status}`);
      }

      const loginEvidence = createEvidence(execution.id, EvidenceLevel.E2, "AUTH_STEP_LOGIN", "memory://auth-step-login/pending", cid);
      const profileEvidence = createEvidence(execution.id, EvidenceLevel.E2, "AUTH_STEP_PROFILE", "memory://auth-step-profile/pending", cid);
      const logoutEvidence = createEvidence(execution.id, EvidenceLevel.E2, "AUTH_STEP_LOGOUT", "memory://auth-step-logout/pending", cid);
      const summaryEvidence = createEvidence(
        execution.id,
        EvidenceLevel.E2,
        "AUTH_SESSION_PROFILE",
        "memory://auth-session-profile/pending",
        cid
      );

      const loginLocation = `memory://auth-step-login/${loginEvidence.id}`;
      const profileLocation = `memory://auth-step-profile/${profileEvidence.id}`;
      const logoutLocation = `memory://auth-step-logout/${logoutEvidence.id}`;
      const summaryLocation = `memory://auth-session-profile/${summaryEvidence.id}`;

      persistEvidenceLocation(loginEvidence.id, loginLocation);
      persistEvidenceLocation(profileEvidence.id, profileLocation);
      persistEvidenceLocation(logoutEvidence.id, logoutLocation);
      persistEvidenceLocation(summaryEvidence.id, summaryLocation);

      transitionExecutionState(execution.id, ExecutionState.COMPLETED, cid);
      return res.status(200).setHeader("x-correlation-id", cid).json({
        ok: true,
        data: {
          executionId: execution.id,
          sessionScopeId,
          profile: profilePayload.profile,
          loggedOut: true,
          evidenceId: summaryEvidence.id,
          steps: [
            {
              step: "LOGIN",
              statusHttp: login.status,
              evidenceId: loginEvidence.id,
              evidenceKind: loginEvidence.kind,
              evidenceLocation: loginLocation
            },
            {
              step: "PROFILE",
              statusHttp: profile.status,
              evidenceId: profileEvidence.id,
              evidenceKind: profileEvidence.kind,
              evidenceLocation: profileLocation
            },
            {
              step: "LOGOUT",
              statusHttp: logout.status,
              evidenceId: logoutEvidence.id,
              evidenceKind: logoutEvidence.kind,
              evidenceLocation: logoutLocation
            }
          ]
        }
      });
    } catch (error) {
      transitionExecutionState(execution.id, ExecutionState.FAILED, cid);
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId: execution.id,
          errorCode: "internal_error",
          message: (error as Error).message
        }
      });
    }
  });

  router.post("/code-analysis/frontend/index/start", async (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const repositoryPath = String(req.body?.repositoryPath ?? "").trim();
    const maxFiles = parseLimitFilter(req.body?.maxFiles);

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ ok: false, error: { errorCode: "invalid_execution_id" } });
    }

    try {
      const files = (await collectRepositoryFiles(repositoryPath, maxFiles)).filter((item) => matchesFrontendCandidate(item.relativePath));

      let framework: "REACT" | "UNKNOWN" = "UNKNOWN";
      try {
        const packageJsonPath = path.join(repositoryPath, "package.json");
        const content = await readFile(packageJsonPath, "utf8");
        const parsed = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        if (parsed.dependencies?.react || parsed.devDependencies?.react) {
          framework = "REACT";
        }
      } catch {
        framework = "UNKNOWN";
      }

      const evidence = createEvidence(executionId, EvidenceLevel.E2, "FRONTEND_INDEX_SUMMARY", "memory://frontend-index/pending", cid);
      persistEvidenceLocation(evidence.id, `memory://frontend-index/${evidence.id}`);

      const result: FrontendIndexResult = {
        ok: true,
        data: {
          executionId,
          framework,
          totalFiles: files.length,
          sampleFiles: files.map((item) => ({ relativePath: item.relativePath })),
          evidenceId: evidence.id
        }
      };

      frontendIndexResults.set(executionId, result);
      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: (error as Error).message,
          message: (error as Error).message
        }
      });
    }
  });

  router.get("/code-analysis/frontend/index/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = frontendIndexResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ ok: false, error: "frontend_index_result_not_available" });
    }
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/code-analysis/frontend/patterns/start", async (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const repositoryPath = String(req.body?.repositoryPath ?? "").trim();
    const maxFiles = parseLimitFilter(req.body?.maxFiles);
    const maxMatchesPerFile = Number.isInteger(req.body?.maxMatchesPerFile) ? Number(req.body.maxMatchesPerFile) : 10;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ ok: false, error: { errorCode: "invalid_execution_id" } });
    }

    try {
      const files = (await collectRepositoryFiles(repositoryPath, maxFiles)).filter((item) => matchesFrontendCandidate(item.relativePath));
      const analyzed: Array<{ relativePath: string; matches: RuleMatch[] }> = [];

      for (const file of files) {
        const content = await readFile(file.absolutePath, "utf8");
        const matches = detectFrontendRules(content, maxMatchesPerFile);
        analyzed.push({ relativePath: file.relativePath, matches });
      }

      const filesWithMatches = analyzed.filter((item) => item.matches.length > 0);
      const totalMatches = filesWithMatches.reduce((acc, item) => acc + item.matches.length, 0);

      const evidence = createEvidence(executionId, EvidenceLevel.E2, "FRONTEND_PATTERN_SUMMARY", "memory://frontend-pattern/pending", cid);
      persistEvidenceLocation(evidence.id, `memory://frontend-pattern/${evidence.id}`);

      const result: FrontendPatternResult = {
        ok: true,
        data: {
          executionId,
          totalFilesScanned: files.length,
          totalFilesWithMatches: filesWithMatches.length,
          totalMatches,
          files: filesWithMatches,
          evidenceId: evidence.id
        }
      };

      frontendPatternResults.set(executionId, result);
      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: (error as Error).message,
          message: (error as Error).message
        }
      });
    }
  });

  router.get("/code-analysis/frontend/patterns/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = frontendPatternResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ ok: false, error: "frontend_pattern_detection_result_not_available" });
    }
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/code-analysis/frontend/findings/:executionId/view", (req, res) => {
    const cid = correlationId(req);
    const result = frontendPatternResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const byRule = new Map<string, { rule: string; matchCount: number; files: Set<string> }>();
    for (const file of result.data.files) {
      for (const match of file.matches) {
        const row = byRule.get(match.rule) ?? { rule: match.rule, matchCount: 0, files: new Set<string>() };
        row.matchCount += 1;
        row.files.add(file.relativePath);
        byRule.set(match.rule, row);
      }
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId: req.params.executionId,
        totals: {
          scannedFiles: result.data.totalFilesScanned,
          filesWithMatches: result.data.totalFilesWithMatches,
          matches: result.data.totalMatches,
          distinctRules: byRule.size
        },
        byRule: Array.from(byRule.values())
          .map((item) => ({ rule: item.rule, matchCount: item.matchCount, filesCount: item.files.size }))
          .sort((left, right) => left.rule.localeCompare(right.rule)),
        files: result.data.files
          .map((item) => ({
            relativePath: item.relativePath,
            matchCount: item.matches.length,
            rules: Array.from(new Set(item.matches.map((match) => match.rule))).sort((left, right) => left.localeCompare(right))
          }))
          .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
      }
    });
  });

  router.post("/code-analysis/backend/api-index/start", async (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const repositoryPath = String(req.body?.repositoryPath ?? "").trim();
    const maxFiles = parseLimitFilter(req.body?.maxFiles);

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ ok: false, error: { errorCode: "invalid_execution_id" } });
    }

    try {
      const files = await collectRepositoryFiles(repositoryPath, maxFiles);
      const artifacts: Array<{ relativePath: string; artifactType: "OPENAPI" | "ROUTE" | "GRAPHQL" | "DTO" }> = [];

      for (const file of files) {
        const normalized = file.relativePath.toLowerCase();
        if (normalized.endsWith("openapi.yaml")) {
          artifacts.push({ relativePath: file.relativePath, artifactType: "OPENAPI" });
        } else if (normalized.includes("/routes/") && normalized.endsWith(".ts")) {
          artifacts.push({ relativePath: file.relativePath, artifactType: "ROUTE" });
        } else if (normalized.endsWith(".graphql")) {
          artifacts.push({ relativePath: file.relativePath, artifactType: "GRAPHQL" });
        } else if (normalized.endsWith(".dto.ts")) {
          artifacts.push({ relativePath: file.relativePath, artifactType: "DTO" });
        }
      }

      const typeOrder: Array<"OPENAPI" | "ROUTE" | "GRAPHQL" | "DTO"> = ["OPENAPI", "ROUTE", "GRAPHQL", "DTO"];
      const artifactTypeCounts = typeOrder
        .map((artifactType) => ({ artifactType, count: artifacts.filter((item) => item.artifactType === artifactType).length }))
        .filter((item) => item.count > 0);

      const evidence = createEvidence(executionId, EvidenceLevel.E2, "BACKEND_API_INDEX_SUMMARY", "memory://backend-api-index/pending", cid);
      persistEvidenceLocation(evidence.id, `memory://backend-api-index/${evidence.id}`);

      const result: BackendApiIndexResult = {
        ok: true,
        data: {
          executionId,
          totalArtifacts: artifacts.length,
          artifactTypeCounts,
          artifacts,
          evidenceId: evidence.id
        }
      };

      backendApiIndexResults.set(executionId, result);
      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: (error as Error).message,
          message: (error as Error).message
        }
      });
    }
  });

  router.get("/code-analysis/backend/api-index/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = backendApiIndexResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ ok: false, error: "backend_api_index_result_not_available" });
    }
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/code-analysis/backend/processing/start", async (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const repositoryPath = String(req.body?.repositoryPath ?? "").trim();
    const maxFiles = parseLimitFilter(req.body?.maxFiles);
    const maxMatchesPerFile = Number.isInteger(req.body?.maxMatchesPerFile) ? Number(req.body.maxMatchesPerFile) : 10;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ ok: false, error: { errorCode: "invalid_execution_id" } });
    }

    try {
      const files = await collectRepositoryFiles(repositoryPath, maxFiles);
      const candidates = files.filter((item) => item.relativePath.toLowerCase().endsWith(".ts"));
      const analyzed: Array<{ relativePath: string; matches: RuleMatch[] }> = [];

      for (const file of candidates) {
        const content = await readFile(file.absolutePath, "utf8");
        const matches = detectBackendProcessingRules(content, maxMatchesPerFile);
        analyzed.push({ relativePath: file.relativePath, matches });
      }

      const filesWithMatches = analyzed.filter((item) => item.matches.length > 0);
      const totalMatches = filesWithMatches.reduce((acc, item) => acc + item.matches.length, 0);

      const evidence = createEvidence(executionId, EvidenceLevel.E2, "BACKEND_PROCESSING_SUMMARY", "memory://backend-processing/pending", cid);
      persistEvidenceLocation(evidence.id, `memory://backend-processing/${evidence.id}`);

      const result: BackendProcessingResult = {
        ok: true,
        data: {
          executionId,
          totalFilesScanned: candidates.length,
          totalFilesWithMatches: filesWithMatches.length,
          totalMatches,
          files: filesWithMatches,
          evidenceId: evidence.id
        }
      };

      backendProcessingResults.set(executionId, result);
      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: (error as Error).message,
          message: (error as Error).message
        }
      });
    }
  });

  router.get("/code-analysis/backend/processing/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = backendProcessingResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ ok: false, error: "backend_processing_result_not_available" });
    }
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/review/executions/:executionId/view", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;

    if (!store.executions.has(executionId)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const evidences = Array.from(store.evidences.values()).filter((item) => item.executionId === executionId);
    const observations = Array.from(store.observations.values()).filter((item) => item.executionId === executionId);

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        evidenceCount: evidences.length,
        observationCount: observations.length,
        evidences,
        observations
      }
    });
  });

  router.get("/code-analysis/backend/processing-flow/:executionId/view", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const apiIndex = backendApiIndexResults.get(executionId);
    if (!apiIndex) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_api_index_result_not_available" });
    }

    const processing = backendProcessingResults.get(executionId);
    if (!processing) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_result_not_available" });
    }

    const byRule = new Map<string, { rule: string; matchCount: number; files: Set<string> }>();
    for (const file of processing.data.files) {
      for (const match of file.matches) {
        const row = byRule.get(match.rule) ?? { rule: match.rule, matchCount: 0, files: new Set<string>() };
        row.matchCount += 1;
        row.files.add(file.relativePath);
        byRule.set(match.rule, row);
      }
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          apiArtifacts: apiIndex.data.totalArtifacts,
          filesWithProcessingMatches: processing.data.totalFilesWithMatches,
          processingMatches: processing.data.totalMatches,
          distinctProcessingRules: byRule.size
        },
        byRule: Array.from(byRule.values()).map((item) => ({ rule: item.rule, matchCount: item.matchCount, filesCount: item.files.size })),
        evidenceIds: {
          apiIndexEvidenceId: apiIndex.data.evidenceId,
          processingEvidenceId: processing.data.evidenceId
        }
      }
    });
  });

  router.get("/lineage/correlations/:executionId/by-endpoint", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const frontend = frontendPatternResults.get(executionId);
    if (!frontend) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const backend = backendProcessingResults.get(executionId);
    if (!backend) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_result_not_available" });
    }

    const frontendEndpoints = new Set(
      frontend.data.files
        .flatMap((file) => file.matches)
        .filter((match) => match.rule === "NETWORK_FETCH" && typeof match.value === "string")
        .map((match) => match.value as string)
    );
    const backendEndpoints = new Set(
      backend.data.files
        .flatMap((file) => file.matches)
        .filter((match) => match.rule === "ROUTE_HANDLER" && typeof match.value === "string")
        .map((match) => match.value as string)
    );

    const correlated = Array.from(frontendEndpoints).filter((endpoint) => backendEndpoints.has(endpoint));
    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          correlatedEndpoints: correlated.length
        },
        correlations: correlated.map((endpoint) => ({ endpoint, status: "INFERRED_HIGH", confidence: 0.9 }))
      }
    });
  });

  router.get("/lineage/correlations/:executionId/by-dto-processing", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const apiIndex = backendApiIndexResults.get(executionId);
    if (!apiIndex) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_api_index_result_not_available" });
    }

    const processing = backendProcessingResults.get(executionId);
    if (!processing) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_result_not_available" });
    }

    const dtoArtifacts = apiIndex.data.artifacts.filter((item) => item.artifactType === "DTO");
    const processingRefs = processing.data.files.flatMap((file) =>
      file.matches.map((match) => ({ relativePath: file.relativePath, rule: match.rule, line: match.line }))
    );

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          dtoArtifacts: dtoArtifacts.length
        },
        correlations: dtoArtifacts.map((dto) => ({
          dto,
          status: "INFERRED_HIGH",
          confidence: 0.8,
          processingReferences: processingRefs
        }))
      }
    });
  });

  router.get("/lineage/views/:executionId/consolidated", (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const frontend = frontendPatternResults.get(executionId);
    if (!frontend) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const byEndpointFrontend = frontend.data.files
      .flatMap((file) => file.matches)
      .filter((match) => match.rule === "NETWORK_FETCH" && typeof match.value === "string")
      .map((match) => match.value as string);

    const byEndpointBackend = (backendProcessingResults.get(executionId)?.data.files ?? [])
      .flatMap((file) => file.matches)
      .filter((match) => match.rule === "ROUTE_HANDLER" && typeof match.value === "string")
      .map((match) => match.value as string);

    const nodes = new Set<string>();
    const edges: Array<{ type: string; from: string; to: string }> = [];

    for (const endpoint of byEndpointFrontend) {
      nodes.add(`frontend:${endpoint}`);
    }
    for (const endpoint of byEndpointBackend) {
      nodes.add(`backend:${endpoint}`);
    }

    for (const endpoint of byEndpointFrontend) {
      if (byEndpointBackend.includes(endpoint)) {
        edges.push({ type: "CALLS_ENDPOINT", from: `frontend:${endpoint}`, to: `backend:${endpoint}` });
      }
    }

    const apiIndex = backendApiIndexResults.get(executionId);
    if (apiIndex) {
      const dtoArtifacts = apiIndex.data.artifacts.filter((item) => item.artifactType === "DTO");
      for (const dto of dtoArtifacts) {
        nodes.add(`dto:${dto.relativePath}`);
        edges.push({ type: "MAPPED_TO_PROCESSING", from: `dto:${dto.relativePath}`, to: "backend:processing" });
      }
    }

    return res.status(200).setHeader("x-correlation-id", cid).json({
      data: {
        executionId,
        totals: {
          nodes: nodes.size,
          edges: edges.length
        },
        nodes: Array.from(nodes).map((id) => ({ id })),
        edges
      }
    });
  });

  router.post("/legal-analysis/discrepancies/start", (req, res) => {
    const cid = correlationId(req);
    const executionId = String(req.body?.executionId ?? "").trim();
    const dynamic = getDynamicObservationResult(executionId);
    if (!dynamic?.ok || !dynamic.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId,
          errorCode: "tracking_inventory_not_available",
          message: "dynamic_observation_result_not_available"
        }
      });
    }

    const declaredThirdParties = new Set((req.body?.declaredThirdParties ?? []).map((value: string) => normalizeDomain(String(value))));
    const declaredPurposes = (req.body?.declaredPurposes ?? []).map((value: string) => normalizeDomain(String(value)));

    const discrepancies: Array<{ kind: string; message: string }> = [];
    const observedThirdParties = new Set(
      dynamic.data.network
        .map((item) => item.thirdPartyDomain)
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .map((item) => normalizeDomain(item))
    );

    for (const domain of observedThirdParties) {
      if (!declaredThirdParties.has(domain)) {
        discrepancies.push({
          kind: "THIRD_PARTY_OBSERVED_NOT_DECLARED",
          message: `Existe una posible discrepancia: tercero observado no declarado (${domain}). Requiere validacion.`
        });
      }
    }

    const observedCategories = new Set<string>();
    if (dynamic.data.storage.some((item) => item.kind === "COOKIE")) {
      observedCategories.add("COOKIE_TRACKING");
    }
    if (dynamic.data.network.length > 0) {
      observedCategories.add("NETWORK_COLLECTION");
    }

    const purposeCompatible = declaredPurposes.some((item: string) => item.includes("analit") || item.includes("seguridad"));
    if (observedCategories.size > 0 && !purposeCompatible) {
      discrepancies.push({
        kind: "PURPOSE_NOT_FOUND_FOR_OBSERVED_CATEGORY",
        message: "No se encontro finalidad declarada para categorias observadas. Existe una posible discrepancia. Requiere validacion."
      });
    }

    if (dynamic.data.consentEvaluation?.code === "TRACKING_AFTER_REJECT") {
      discrepancies.push({
        kind: "TRACKING_AFTER_REJECT",
        message: "Existe una posible discrepancia: tracking posterior al rechazo. Requiere validacion."
      });
    }

    if (dynamic.data.consentEvaluation?.code === "TRACKING_BEFORE_CONSENT") {
      discrepancies.push({
        kind: "CAPTURE_BEFORE_INFORMATION",
        message: "Existe una posible discrepancia: captura previa a informacion y decision. Requiere validacion."
      });
    }

    const result = {
      ok: true as const,
      data: {
        executionId,
        totals: {
          discrepancies: discrepancies.length,
          observedCategories: observedCategories.size
        },
        discrepancies
      }
    };

    legalDiscrepancyResults.set(executionId, result);
    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/legal-analysis/discrepancies/:executionId/result", (req, res) => {
    const cid = correlationId(req);
    const result = legalDiscrepancyResults.get(req.params.executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json({
        ok: false,
        error: {
          executionId: req.params.executionId,
          errorCode: "result_not_available",
          message: "legal_discrepancies_result_not_available"
        }
      });
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  return router;
}
