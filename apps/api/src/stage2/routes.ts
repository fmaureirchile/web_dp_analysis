import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  type OperationalExecutionItemDto,
  type OperationalExecutionListDto,
  type OperationalExecutionStateFilter,
  type PassiveSinglePageCrawlErrorDto,
  type PassiveSinglePageCrawlResultDto,
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
  StartPassiveSinglePageCrawlDto,
  CreateTargetDto,
  ScopeSimulationDto,
  ToggleKillSwitchDto
} from "../../../../packages/contracts/src";
import {
  evaluatePassiveSinglePageScope,
  extractHtmlTitle,
  fetchPassiveSinglePageHtml
} from "../../../worker-crawler/src";
import { ExecutionState, ReviewState } from "../../../../packages/domain/src";
import {
  appendCrawlerOperationalEvent,
  createAuthorization,
  createEvidence,
  createExecution,
  createPassiveHtmlEvidence,
  createFinding,
  createFormField,
  createObservation,
  createOrganization,
  createPage,
  createProject,
  createReviewDecision,
  createTarget,
  getExecutionByIdWithFallback,
  getPassiveSinglePageCrawlResult,
  listOperationalExecutions,
  recordPassiveSinglePageCrawlError,
  recordPassiveSinglePageCrawlSuccess,
  simulateScope,
  store,
  transitionExecutionState,
  toggleAuthorizationKillSwitch
} from "./in-memory-store";

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

function crawlerError(
  executionId: string,
  entryUrl: string,
  errorCode: PassiveSinglePageCrawlErrorDto["errorCode"],
  message: string
): PassiveSinglePageCrawlErrorDto {
  return {
    executionId,
    entryUrl,
    errorCode,
    message
  };
}

function crawlerErrorStatus(errorCode: PassiveSinglePageCrawlErrorDto["errorCode"]): 400 | 403 | 422 {
  if (errorCode === "invalid_entry_url") {
    return 400;
  }

  if (errorCode === "authorization_scope_rejected") {
    return 403;
  }

  return 422;
}

function isHttpEntryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const OPERATIONAL_ALLOWED_STATES: ExecutionState[] = [
  ExecutionState.COMPLETED,
  ExecutionState.COMPLETED_WITH_WARNINGS,
  ExecutionState.FAILED
];

function parseOperationalStates(raw: string | undefined): ExecutionState[] | undefined {
  if (!raw || raw.trim().length === 0) {
    return [ExecutionState.COMPLETED, ExecutionState.FAILED];
  }

  const values = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return [ExecutionState.COMPLETED, ExecutionState.FAILED];
  }

  const parsed: ExecutionState[] = [];
  for (const value of values) {
    if (!(value in ExecutionState)) {
      return undefined;
    }
    const state = ExecutionState[value as keyof typeof ExecutionState];
    if (!OPERATIONAL_ALLOWED_STATES.includes(state)) {
      return undefined;
    }
    parsed.push(state);
  }

  return Array.from(new Set(parsed));
}

function parseIso(raw: string | undefined): string | undefined {
  if (!raw || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function parseLimit(raw: string | undefined): number | undefined {
  if (!raw || raw.trim().length === 0) {
    return 50;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    return undefined;
  }

  return parsed;
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

  router.post("/crawler/passive/single-page", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartPassiveSinglePageCrawlDto;

    if (!body || typeof body.executionId !== "string" || typeof body.entryUrl !== "string") {
      const invalidPayload = crawlerError(
        body?.executionId ?? "unknown_execution",
        body?.entryUrl ?? "unknown_entry_url",
        "internal_error",
        "invalid_request_payload"
      );
      return res.status(400).setHeader("x-correlation-id", cid).json(invalidPayload);
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(crawlerError(body.executionId, body.entryUrl, "internal_error", "execution_id_not_found"));
    }

      const traceCorrelationId = body.correlationId ?? cid;

    if (!isHttpEntryUrl(body.entryUrl)) {
      const invalidUrlError = crawlerError(
        body.executionId,
        body.entryUrl,
        "invalid_entry_url",
        "invalid_entry_url:unsupported_protocol"
      );
      await recordPassiveSinglePageCrawlError(body.executionId, invalidUrlError, cid);
      appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_result_error", invalidUrlError.errorCode);
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(invalidUrlError);
    }

    if (execution.state !== ExecutionState.VALIDATED) {
      appendCrawlerOperationalEvent(
        body.executionId,
        traceCorrelationId,
        "crawl_result_error",
        `execution_invalid_state:${execution.state}`
      );
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(
          crawlerError(
            body.executionId,
            body.entryUrl,
            "internal_error",
            `execution_invalid_state_for_passive_crawl:${execution.state}`
          )
        );
    }

    try {
      await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "passive_crawl_queued");
      await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "passive_crawl_started");
      appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_started", body.entryUrl);

      const gate = await evaluatePassiveSinglePageScope(
        {
          request: body,
          authorizationId: execution.authorizationId,
          operation: execution.operation,
          correlationId: body.correlationId ?? cid
        },
        {
          runScopeSimulation: async (input) =>
            simulateScope(input.authorizationId, input.entryUrl, input.operation, undefined, input.correlationId)
        }
      );

      if (!gate.allowed) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "authorization_scope_rejected");
        await recordPassiveSinglePageCrawlError(body.executionId, gate.error, cid);
        appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_result_error", gate.error.errorCode);
        return res.status(403).setHeader("x-correlation-id", cid).json(gate.error);
      }

      const fetchResult = await fetchPassiveSinglePageHtml(body);
      if (!fetchResult.ok) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, fetchResult.error.errorCode);
        await recordPassiveSinglePageCrawlError(body.executionId, fetchResult.error, cid);
        appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_result_error", fetchResult.error.errorCode);
        return res
          .status(crawlerErrorStatus(fetchResult.error.errorCode))
          .setHeader("x-correlation-id", cid)
          .json(fetchResult.error);
      }

      const title = extractHtmlTitle(fetchResult.data.html);
      const evidence = await createPassiveHtmlEvidence(
        body.executionId,
        {
          entryUrl: fetchResult.data.entryUrl,
          fetchedAt: fetchResult.data.fetchedAt,
          statusHttp: fetchResult.data.statusHttp,
          contentType: fetchResult.data.contentType,
          contentLength: fetchResult.data.contentLength,
          html: fetchResult.data.html,
          title
        },
        cid
      );

      const result = await recordPassiveSinglePageCrawlSuccess(
        body.executionId,
        {
        executionId: body.executionId,
        entryUrl: fetchResult.data.entryUrl,
        statusHttp: fetchResult.data.statusHttp,
        title,
        evidenceId: evidence.id,
        fetchedAt: fetchResult.data.fetchedAt,
        contentType: fetchResult.data.contentType,
        contentLength: fetchResult.data.contentLength
        },
        cid
      );

      await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "passive_crawl_completed");
      appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_result_success", evidence.id);

      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "internal_error");
      }

      const internalError = crawlerError(body.executionId, body.entryUrl, "internal_error", (error as Error).message);
      await recordPassiveSinglePageCrawlError(body.executionId, internalError, cid);
      appendCrawlerOperationalEvent(body.executionId, traceCorrelationId, "crawl_result_error", internalError.errorCode);

      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(internalError);
    }
  });

  router.get("/crawler/passive/single-page/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(crawlerError(executionId, "unknown_entry_url", "internal_error", "execution_id_not_found"));
    }

    const result = await getPassiveSinglePageCrawlResult(executionId);
    if (!result) {
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(
          crawlerError(
            executionId,
            execution.entryUrl ?? "unknown_entry_url",
            "internal_error",
            "passive_crawl_result_not_available"
          )
        );
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/crawler/passive/executions/operational", async (req, res) => {
    const cid = correlationId(req);

    const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim().length > 0
      ? req.query.projectId.trim()
      : undefined;
    const states = parseOperationalStates(typeof req.query.states === "string" ? req.query.states : undefined);
    const from = parseIso(typeof req.query.from === "string" ? req.query.from : undefined);
    const to = parseIso(typeof req.query.to === "string" ? req.query.to : undefined);
    const limit = parseLimit(typeof req.query.limit === "string" ? req.query.limit : undefined);

    if (!states) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_states_filter" });
    }

    if (
      typeof req.query.from === "string" && req.query.from.trim().length > 0 && !from
    ) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_from_filter" });
    }

    if (
      typeof req.query.to === "string" && req.query.to.trim().length > 0 && !to
    ) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_to_filter" });
    }

    if (from && to && Date.parse(from) > Date.parse(to)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_time_window" });
    }

    if (!limit) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_limit_filter" });
    }

    const rows = await listOperationalExecutions({
      states,
      from,
      to,
      projectId,
      limit
    });

    const items: OperationalExecutionItemDto[] = [];
    for (const row of rows) {
      const result = await getPassiveSinglePageCrawlResult(row.executionId);
      const item: OperationalExecutionItemDto = {
        executionId: row.executionId,
        state: row.state as OperationalExecutionStateFilter,
        entryUrl: row.entryUrl,
        updatedAt: row.updatedAt,
        resultAvailable: Boolean(result),
        statusHttp: result?.data?.statusHttp,
        title: result?.data?.title,
        evidenceId: result?.data?.evidenceId,
        errorCode: result?.error?.errorCode
      };

      items.push(item);
    }

    const response: OperationalExecutionListDto = {
      states: states as OperationalExecutionStateFilter[],
      from,
      to,
      limit,
      items
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: response });
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
