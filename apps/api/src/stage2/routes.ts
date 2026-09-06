import { randomUUID } from "node:crypto";
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

  return router;
}
