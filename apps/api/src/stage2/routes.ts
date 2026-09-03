import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import {
  type BackendApiArtifactType,
  type BackendApiIndexedArtifactDto,
  type BackendApiIndexResultDto,
  type BackendProcessingFileDetectionsDto,
  type BackendProcessingFlowViewDto,
  type BackendProcessingMatchDto,
  type BackendProcessingDetectionResultDto,
  type LegalDiscrepancyDetectionResultDto,
  type LegalDiscrepancyItemDto,
  type LineageBackendReferenceDto,
  type LineageConsolidatedViewDto,
  type LineageCorrelationStatus,
  type LineageDtoProcessingCorrelationViewDto,
  type LineageEndpointCorrelationViewDto,
  type LineageFrontendReferenceDto,
  type StartLegalDiscrepancyDetectionDto,
  type StartBackendApiIndexDto,
  type StartBackendProcessingDetectionDto,
  type FrontendFilePatternDetectionsDto,
  type FrontendStaticFindingsViewDto,
  type FrontendPatternDetectionResultDto,
  type FrontendPatternMatchDto,
  type StartFrontendPatternDetectionDto,
  type FrontendFramework,
  type FrontendIndexedFileDto,
  type FrontendRepositoryIndexResultDto,
  type StartFrontendRepositoryIndexDto,
  type AuthenticatedEvaluationResultDto,
  type StartAuthenticatedEvaluationDto,
  type TrackingInventoryReportDto,
  type ExecutiveSummaryReportDto,
  type EvidenceQueryResultDto,
  type FormInventoryReportDto,
  type DynamicObservationErrorDto,
  type DynamicObservationResultDto,
  type OperationalExecutionItemDto,
  type OperationalExecutionListDto,
  type OperationalExecutionStateFilter,
  type PassiveSinglePageCrawlErrorDto,
  type PassiveSinglePageCrawlResultDto,
  type ReviewExecutionViewDto,
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
  StartDynamicObservationDto,
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
import { captureDynamicObservation } from "../../../worker-browser/src/dynamic-observation";
import { EvidenceLevel, ExecutionState, ReviewState } from "../../../../packages/domain/src";
import {
  appendCrawlerOperationalEvent,
  createBrowserDomEvidence,
  createBrowserScreenshotEvidence,
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
  getBackendApiIndexResult,
  getBackendProcessingDetectionResult,
  getFrontendPatternDetectionResult,
  getFrontendRepositoryIndexResult,
  getLegalDiscrepancyDetectionResult,
  getDynamicObservationResult,
  getExecutionByIdWithFallback,
  getPassiveSinglePageCrawlResult,
  listEvidenceReferencesByExecutionId,
  listFormInventoryByExecutionId,
  listObservationReferencesByExecutionId,
  listTrackingInventoryByExecutionId,
  listOperationalExecutions,
  recordBackendApiIndexResult,
  recordBackendProcessingDetectionResult,
  recordFrontendPatternDetectionResult,
  recordFrontendRepositoryIndexResult,
  recordLegalDiscrepancyDetectionResult,
  recordDynamicObservationError,
  recordDynamicObservationSuccess,
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

function dynamicObservationError(
  executionId: string,
  entryUrl: string,
  errorCode: DynamicObservationErrorDto["errorCode"],
  message: string
): DynamicObservationErrorDto {
  return {
    executionId,
    entryUrl,
    errorCode,
    message
  };
}

function dynamicObservationErrorStatus(errorCode: DynamicObservationErrorDto["errorCode"]): 400 | 403 | 422 {
  if (errorCode === "invalid_execution_id" || errorCode === "invalid_entry_url") {
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

function authenticatedEvaluationError(
  executionId: string,
  entryUrl: string,
  errorCode: "invalid_execution_id" | "invalid_entry_url" | "authentication_failed" | "profile_fetch_failed" | "internal_error",
  message: string
): AuthenticatedEvaluationResultDto {
  return {
    ok: false,
    error: {
      executionId,
      entryUrl,
      errorCode,
      message
    }
  };
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

function parseEvidenceLimit(raw: string | undefined): number | undefined {
  if (!raw || raw.trim().length === 0) {
    return 50;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    return undefined;
  }

  return parsed;
}

const FRONTEND_ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".html", ".css", ".scss"]);
const FRONTEND_IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
const BACKEND_API_ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".graphql", ".gql"]);
const BACKEND_API_IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "validate_job_logs", "validate-job-logs"]);

function frontendIndexError(
  executionId: string,
  repositoryPath: string,
  errorCode: "invalid_execution_id" | "invalid_repository_path" | "repository_path_not_found" | "indexing_failed" | "result_not_available",
  message: string
): FrontendRepositoryIndexResultDto {
  return {
    ok: false,
    error: {
      executionId,
      repositoryPath,
      errorCode,
      message
    }
  };
}

function backendApiIndexError(
  executionId: string,
  repositoryPath: string,
  errorCode: "invalid_execution_id" | "invalid_repository_path" | "repository_path_not_found" | "indexing_failed" | "result_not_available",
  message: string
): BackendApiIndexResultDto {
  return {
    ok: false,
    error: {
      executionId,
      repositoryPath,
      errorCode,
      message
    }
  };
}

function backendProcessingDetectionError(
  executionId: string,
  repositoryPath: string,
  errorCode: "invalid_execution_id" | "invalid_repository_path" | "repository_path_not_found" | "detection_failed" | "result_not_available",
  message: string
): BackendProcessingDetectionResultDto {
  return {
    ok: false,
    error: {
      executionId,
      repositoryPath,
      errorCode,
      message
    }
  };
}

const BACKEND_PROCESSING_PATTERNS: Array<{ rule: BackendProcessingMatchDto["rule"]; regex: RegExp }> = [
  { rule: "ROUTE_HANDLER", regex: /\b(router|app)\.(get|post|put|patch|delete|use)\s*\(/i },
  { rule: "CONTROLLER_USAGE", regex: /\bcontroller\b|controllers?\//i },
  { rule: "SERVICE_USAGE", regex: /\bservice\b|services?\//i },
  { rule: "INTEGRATION_USAGE", regex: /\b(prisma|redis|queue|webhook|axios|fetch|smtp|nodemailer|kafka|sqs)\b/i }
];

type BackendProcessingCandidateFile = {
  relativePath: string;
  bytes: number;
};

function detectBackendApiArtifactType(relativePath: string): BackendApiArtifactType | undefined {
  const normalized = relativePath.toLowerCase();
  const fileName = path.basename(normalized);

  if (fileName.includes("openapi") || fileName.includes("swagger")) {
    return "OPENAPI";
  }

  if (normalized.endsWith(".graphql") || normalized.endsWith(".gql") || normalized.includes("graphql")) {
    return "GRAPHQL";
  }

  if (fileName.includes("route") || normalized.includes("/routes/")) {
    return "ROUTE";
  }

  if (fileName.includes("dto") || normalized.includes("/contracts/")) {
    return "DTO";
  }

  return undefined;
}

async function collectBackendApiArtifacts(repositoryPath: string, maxFiles: number): Promise<BackendApiIndexedArtifactDto[]> {
  const artifacts: BackendApiIndexedArtifactDto[] = [];
  const stack: string[] = [repositoryPath];

  while (stack.length > 0 && artifacts.length < maxFiles) {
    const currentDir = stack.pop() as string;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (artifacts.length >= maxFiles) break;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!BACKEND_API_IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!BACKEND_API_ALLOWED_EXTENSIONS.has(extension)) continue;

      const relativePath = path.relative(repositoryPath, absolutePath).replaceAll("\\", "/");
      const artifactType = detectBackendApiArtifactType(relativePath);
      if (!artifactType) continue;

      const stat = await fs.stat(absolutePath);
      artifacts.push({
        relativePath,
        artifactType,
        bytes: stat.size
      });
    }
  }

  artifacts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return artifacts;
}

function frontendPatternDetectionError(
  executionId: string,
  repositoryPath: string,
  errorCode: "invalid_execution_id" | "invalid_repository_path" | "repository_path_not_found" | "detection_failed" | "result_not_available",
  message: string
): FrontendPatternDetectionResultDto {
  return {
    ok: false,
    error: {
      executionId,
      repositoryPath,
      errorCode,
      message
    }
  };
}

const FRONTEND_CAPTURE_PATTERNS: Array<{ rule: FrontendPatternMatchDto["rule"]; regex: RegExp }> = [
  { rule: "FORM_INPUT", regex: /<(input|textarea|select)\b|addEventListener\(\s*["'](?:input|change|submit)["']/i },
  { rule: "NETWORK_FETCH", regex: /\b(fetch\s*\(|axios\.|XMLHttpRequest\b)/i },
  { rule: "COOKIE_ACCESS", regex: /document\.cookie\b/i },
  { rule: "STORAGE_ACCESS", regex: /\b(localStorage|sessionStorage)\b/i },
  { rule: "ANALYTICS_BEACON", regex: /\b(gtag\s*\(|dataLayer\b|fbq\s*\(|analytics\.|sendBeacon\s*\()/i }
];

function lineFromOffset(content: string, offset: number): number {
  return content.slice(0, offset).split(/\r?\n/).length;
}

function extractLineSnippet(content: string, offset: number): string {
  const lineStart = Math.max(content.lastIndexOf("\n", offset - 1) + 1, 0);
  const rawLineEnd = content.indexOf("\n", offset);
  const lineEnd = rawLineEnd === -1 ? content.length : rawLineEnd;
  return content.slice(lineStart, lineEnd).trim().slice(0, 220);
}

async function detectFrontendCapturePatterns(
  repositoryPath: string,
  files: FrontendIndexedFileDto[],
  maxMatchesPerFile: number
): Promise<FrontendFilePatternDetectionsDto[]> {
  const output: FrontendFilePatternDetectionsDto[] = [];

  for (const file of files) {
    const absolutePath = path.join(repositoryPath, file.relativePath);
    let content = "";

    try {
      content = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const matches: FrontendPatternMatchDto[] = [];

    for (const pattern of FRONTEND_CAPTURE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const found = pattern.regex.exec(content);
      if (!found || found.index === undefined) {
        continue;
      }

      matches.push({
        rule: pattern.rule,
        line: lineFromOffset(content, found.index),
        snippet: extractLineSnippet(content, found.index)
      });

      if (matches.length >= maxMatchesPerFile) {
        break;
      }
    }

    if (matches.length > 0) {
      output.push({
        relativePath: file.relativePath,
        matches
      });
    }
  }

  output.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return output;
}

async function detectBackendProcessingPoints(
  repositoryPath: string,
  candidates: BackendProcessingCandidateFile[],
  maxMatchesPerFile: number
): Promise<BackendProcessingFileDetectionsDto[]> {
  const files: BackendProcessingFileDetectionsDto[] = [];

  for (const candidate of candidates) {
    const absolutePath = path.join(repositoryPath, candidate.relativePath);
    let content = "";

    try {
      content = await fs.readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const matches: BackendProcessingMatchDto[] = [];
    for (const pattern of BACKEND_PROCESSING_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const found = pattern.regex.exec(content);
      if (!found || found.index === undefined) {
        continue;
      }

      matches.push({
        rule: pattern.rule,
        line: lineFromOffset(content, found.index),
        snippet: extractLineSnippet(content, found.index)
      });

      if (matches.length >= maxMatchesPerFile) {
        break;
      }
    }

    if (matches.length > 0) {
      files.push({
        relativePath: candidate.relativePath,
        matches
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

function isBackendProcessingCandidate(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  const fileName = path.basename(normalized);

  if (normalized.includes("/apps/api/")) {
    return true;
  }

  return (
    fileName.includes("route") ||
    fileName.includes("controller") ||
    fileName.includes("service") ||
    normalized.includes("/routes/") ||
    normalized.includes("/controllers/") ||
    normalized.includes("/services/") ||
    normalized.includes("/integrations/") ||
    normalized.includes("/webhooks/")
  );
}

async function collectBackendProcessingCandidates(
  repositoryPath: string,
  maxFiles: number
): Promise<BackendProcessingCandidateFile[]> {
  const files: BackendProcessingCandidateFile[] = [];
  const stack: string[] = [repositoryPath];

  while (stack.length > 0 && files.length < maxFiles) {
    const currentDir = stack.pop() as string;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!BACKEND_API_IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!BACKEND_API_ALLOWED_EXTENSIONS.has(extension)) continue;

      const relativePath = path.relative(repositoryPath, absolutePath).replaceAll("\\", "/");
      if (!isBackendProcessingCandidate(relativePath)) continue;

      const stat = await fs.stat(absolutePath);
      files.push({
        relativePath,
        bytes: stat.size
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

async function detectFrontendFramework(repositoryPath: string): Promise<FrontendFramework> {
  const packageJsonPath = path.join(repositoryPath, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {})
    };

    if (deps.react) return "REACT";
    if (deps.next) return "NEXT";
    if (deps.vue) return "VUE";
    if (deps["@angular/core"]) return "ANGULAR";
    if (deps.svelte) return "SVELTE";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

async function collectFrontendFiles(repositoryPath: string, maxFiles: number): Promise<FrontendIndexedFileDto[]> {
  const files: FrontendIndexedFileDto[] = [];
  const stack: string[] = [repositoryPath];

  while (stack.length > 0 && files.length < maxFiles) {
    const currentDir = stack.pop() as string;
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!FRONTEND_IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!FRONTEND_ALLOWED_EXTENSIONS.has(extension)) continue;

      const stat = await fs.stat(absolutePath);
      files.push({
        relativePath: path.relative(repositoryPath, absolutePath).replaceAll("\\", "/"),
        extension,
        bytes: stat.size
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}

function normalizeEndpointCandidate(input: string): string | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname;
    } catch {
      return undefined;
    }
  }

  if (!trimmed.startsWith("/")) {
    return undefined;
  }

  return trimmed;
}

function extractSnippetEndpoints(snippet: string): string[] {
  const endpoints = new Set<string>();
  const regex = /["'`](https?:\/\/[^"'`\s]+|\/[A-Za-z0-9_\-./?=&]+)["'`]/g;

  for (const match of snippet.matchAll(regex)) {
    const candidate = normalizeEndpointCandidate(match[1]);
    if (candidate) {
      endpoints.add(candidate);
    }
  }

  return Array.from(endpoints).sort((a, b) => a.localeCompare(b));
}

function normalizeTokenSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function extractDtoNameFromPath(relativePath: string): string {
  const baseName = path.basename(relativePath).replace(/\.[a-z0-9]+$/i, "");
  return baseName.replace(/([.-_]?dto)$/i, "");
}

function buildDtoCorrelationTokens(dtoName: string): string[] {
  const camelSeparated = dtoName.replace(/([a-z])([A-Z])/g, "$1 $2");
  const words = normalizeTokenSource(camelSeparated)
    .split(/\s+/)
    .filter((value) => value.length >= 3);

  const tokens = new Set<string>(words);
  if (words.length > 1) {
    tokens.add(words.join(""));
  }

  return Array.from(tokens).sort((a, b) => a.localeCompare(b));
}

function endpointNodeId(scope: "frontend" | "backend", endpoint: string): string {
  return `${scope}:endpoint:${endpoint}`;
}

function dtoNodeId(relativePath: string): string {
  return `dto:${relativePath}`;
}

function processingNodeId(relativePath: string): string {
  return `processing:${relativePath}`;
}

function legalDiscrepancyDetectionError(
  executionId: string,
  errorCode: "invalid_execution_id" | "invalid_declared_values" | "tracking_inventory_not_available" | "detection_failed" | "result_not_available",
  message: string
): LegalDiscrepancyDetectionResultDto {
  return {
    ok: false,
    error: {
      executionId,
      errorCode,
      message
    }
  };
}

function normalizeDeclaredValues(values: string[] | undefined): string[] | undefined {
  if (values === undefined) {
    return [];
  }

  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
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

  router.post("/browser/observations/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartDynamicObservationDto;

    if (!body || typeof body.executionId !== "string" || typeof body.entryUrl !== "string") {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(dynamicObservationError(
          body?.executionId ?? "unknown_execution",
          body?.entryUrl ?? "unknown_entry_url",
          "internal_error",
          "invalid_request_payload"
        ));
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(dynamicObservationError(body.executionId, body.entryUrl, "invalid_execution_id", "execution_id_not_found"));
    }

    if (execution.state !== ExecutionState.VALIDATED) {
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(dynamicObservationError(
          body.executionId,
          body.entryUrl,
          "internal_error",
          `execution_invalid_state_for_dynamic_observation:${execution.state}`
        ));
    }

    try {
      await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "dynamic_observation_queued");
      await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "dynamic_observation_started");

      const gate = await evaluatePassiveSinglePageScope(
        {
          request: {
            executionId: body.executionId,
            entryUrl: body.entryUrl,
            correlationId: body.correlationId,
            timeoutMs: body.timeoutMs
          },
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
        const rejected = dynamicObservationError(
          body.executionId,
          body.entryUrl,
          "authorization_scope_rejected",
          gate.error.message
        );
        const result = recordDynamicObservationError(body.executionId, rejected);
        return res.status(403).setHeader("x-correlation-id", cid).json(result.error);
      }

      const observed = await captureDynamicObservation({
        executionId: body.executionId,
        entryUrl: body.entryUrl,
        timeoutMs: body.timeoutMs,
        maxEvents: body.maxEvents
      });

      if (!observed.ok) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, observed.error.errorCode);
        const result = recordDynamicObservationError(body.executionId, observed.error);
        return res
          .status(dynamicObservationErrorStatus(observed.error.errorCode))
          .setHeader("x-correlation-id", cid)
          .json(result.error);
      }

      const domEvidence = await createBrowserDomEvidence(
        body.executionId,
        {
          pageUrl: observed.data.entryUrl,
          capturedAt: observed.data.completedAt,
          html: observed.data.domHtml,
          title: observed.data.title
        },
        cid
      );

      const screenshotEvidence = await createBrowserScreenshotEvidence(
        body.executionId,
        {
          pageUrl: observed.data.entryUrl,
          capturedAt: observed.data.completedAt,
          dataUrl: observed.data.screenshotDataUrl
        },
        cid
      );

      const success: NonNullable<DynamicObservationResultDto["data"]> = {
        executionId: body.executionId,
        entryUrl: observed.data.entryUrl,
        completedAt: observed.data.completedAt,
        pageSnapshots: [
          {
            pageUrl: observed.data.entryUrl,
            title: observed.data.title,
            capturedAt: observed.data.completedAt,
            domEvidenceId: domEvidence.id,
            screenshotEvidenceId: screenshotEvidence.id
          }
        ],
        network: observed.data.network,
        storage: observed.data.storage,
        events: observed.data.events,
        consentEvaluation: observed.data.consentEvaluation
      };

      const result = recordDynamicObservationSuccess(body.executionId, success);
      await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "dynamic_observation_completed");

      return res.status(200).setHeader("x-correlation-id", cid).json(result);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "internal_error");
      }

      const internal = dynamicObservationError(body.executionId, body.entryUrl, "internal_error", (error as Error).message);
      const result = recordDynamicObservationError(body.executionId, internal);
      return res.status(422).setHeader("x-correlation-id", cid).json(result.error);
    }
  });

  router.get("/browser/observations/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(dynamicObservationError(executionId, "unknown_entry_url", "invalid_execution_id", "execution_id_not_found"));
    }

    const result = getDynamicObservationResult(executionId);
    if (!result) {
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(dynamicObservationError(
          executionId,
          execution.entryUrl ?? "unknown_entry_url",
          "internal_error",
          "dynamic_observation_result_not_available"
        ));
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
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

  router.get("/evidences", async (req, res) => {
    const cid = correlationId(req);
    const executionId = typeof req.query.executionId === "string" ? req.query.executionId : undefined;
    const kind = typeof req.query.kind === "string" && req.query.kind.trim().length > 0 ? req.query.kind.trim() : undefined;
    const from = parseIso(typeof req.query.from === "string" ? req.query.from : undefined);
    const to = parseIso(typeof req.query.to === "string" ? req.query.to : undefined);
    const cursor = typeof req.query.cursor === "string" && req.query.cursor.trim().length > 0 ? req.query.cursor.trim() : undefined;
    const limit = parseEvidenceLimit(typeof req.query.limit === "string" ? req.query.limit : undefined);

    if (!executionId || executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_required" });
    }

    if (!limit) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_limit" });
    }

    if (typeof req.query.from === "string" && req.query.from.trim().length > 0 && !from) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_from_filter" });
    }

    if (typeof req.query.to === "string" && req.query.to.trim().length > 0 && !to) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_to_filter" });
    }

    if (from && to && Date.parse(from) > Date.parse(to)) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "invalid_time_window" });
    }

    const execution = await getExecutionByIdWithFallback(executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const result = await listEvidenceReferencesByExecutionId({
      executionId,
      kind,
      from,
      to,
      cursor,
      limit
    });

    const payload: EvidenceQueryResultDto = {
      executionId,
      kind,
      from,
      to,
      cursor,
      nextCursor: result.nextCursor,
      limit,
      items: result.items
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/review/executions/:executionId/view", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const evidences = await listEvidenceReferencesByExecutionId({
      executionId,
      limit: 200
    });
    const observations = listObservationReferencesByExecutionId(executionId);

    const payload: ReviewExecutionViewDto = {
      executionId,
      executionState: execution.state,
      entryUrl: execution.entryUrl,
      generatedAt: new Date().toISOString(),
      evidenceCount: evidences.items.length,
      observationCount: observations.length,
      evidences: evidences.items,
      observations
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/reports/executions/:executionId/executive-summary", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const evidences = await listEvidenceReferencesByExecutionId({
      executionId,
      limit: 200
    });
    const observations = listObservationReferencesByExecutionId(executionId);

    const byKind = new Map<string, { count: number; evidenceIds: string[] }>();
    const byLevel = new Map<string, { count: number; evidenceIds: string[] }>();

    for (const item of evidences.items) {
      const currentKind = byKind.get(item.kind) ?? { count: 0, evidenceIds: [] };
      currentKind.count += 1;
      currentKind.evidenceIds.push(item.evidenceId);
      byKind.set(item.kind, currentKind);

      const currentLevel = byLevel.get(item.level) ?? { count: 0, evidenceIds: [] };
      currentLevel.count += 1;
      currentLevel.evidenceIds.push(item.evidenceId);
      byLevel.set(item.level, currentLevel);
    }

    const payload: ExecutiveSummaryReportDto = {
      executionId,
      executionState: execution.state,
      entryUrl: execution.entryUrl,
      generatedAt: new Date().toISOString(),
      totals: {
        evidences: evidences.items.length,
        observations: observations.length
      },
      evidenceByKind: Array.from(byKind.entries())
        .map(([kind, value]) => ({ kind, count: value.count, evidenceIds: value.evidenceIds }))
        .sort((a, b) => a.kind.localeCompare(b.kind)),
      evidenceByLevel: Array.from(byLevel.entries())
        .map(([level, value]) => ({ level: level as typeof evidences.items[number]["level"], count: value.count, evidenceIds: value.evidenceIds }))
        .sort((a, b) => a.level.localeCompare(b.level))
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/reports/executions/:executionId/form-inventory", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const pageId = typeof req.query.pageId === "string" && req.query.pageId.trim().length > 0 ? req.query.pageId.trim() : undefined;

    const execution = await getExecutionByIdWithFallback(executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    if (pageId) {
      const pageExists = store.pages.get(pageId);
      if (!pageExists || pageExists.executionId !== executionId) {
        return res.status(400).setHeader("x-correlation-id", cid).json({ error: "page_id_not_found" });
      }
    }

    const pages = listFormInventoryByExecutionId({ executionId, pageId });
    const totalFields = pages.reduce((acc, page) => acc + page.fieldCount, 0);
    const totalObservations = pages.reduce((acc, page) => acc + page.observationCount, 0);

    const payload: FormInventoryReportDto = {
      executionId,
      executionState: execution.state,
      entryUrl: execution.entryUrl,
      pageId,
      generatedAt: new Date().toISOString(),
      totals: {
        pages: pages.length,
        fields: totalFields,
        observations: totalObservations
      },
      pages
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/reports/executions/:executionId/tracking-inventory", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const inventory = listTrackingInventoryByExecutionId(executionId);
    const payload: TrackingInventoryReportDto = {
      executionId,
      executionState: execution.state,
      entryUrl: execution.entryUrl,
      generatedAt: new Date().toISOString(),
      totals: {
        thirdParties: inventory.thirdParties.length,
        cookies: inventory.cookies.length,
        networkRequests: inventory.networkRequests,
        cookieObservations: inventory.cookieObservations
      },
      thirdParties: inventory.thirdParties,
      cookies: inventory.cookies
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.post("/auth/evaluations/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartAuthenticatedEvaluationDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        authenticatedEvaluationError("unknown_execution", body.entryUrl ?? "unknown_entry_url", "invalid_execution_id", "execution_id_required")
      );
    }

    if (!body.entryUrl || !isHttpEntryUrl(body.entryUrl)) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        authenticatedEvaluationError(body.executionId, body.entryUrl ?? "unknown_entry_url", "invalid_entry_url", "invalid_entry_url")
      );
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        authenticatedEvaluationError(body.executionId, body.entryUrl, "invalid_execution_id", "execution_id_not_found")
      );
    }

    if (!body.username || !body.password || (body.role !== "cliente" && body.role !== "supervisor")) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        authenticatedEvaluationError(body.executionId, body.entryUrl, "authentication_failed", "invalid_authentication_payload")
      );
    }

    try {
      await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "auth_evaluation_queued");
      await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "auth_evaluation_started");

      const origin = new URL(body.entryUrl).origin;
      const sessionScopeId = `${body.executionId}:${body.role}`;
      const loginUrl = new URL("/sitio-f/auth/login", origin);
      const profileUrl = new URL("/sitio-f/profile", origin);
      const logoutUrl = new URL("/sitio-f/auth/logout", origin);

      const loginResponse = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-synthetic-client-id": sessionScopeId
        },
        body: JSON.stringify({
          username: body.username,
          password: body.password,
          role: body.role
        })
      });

      if (loginResponse.status !== 200) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "auth_evaluation_login_failed");
        return res.status(422).setHeader("x-correlation-id", cid).json(
          authenticatedEvaluationError(body.executionId, body.entryUrl, "authentication_failed", "login_failed")
        );
      }

      const loginEvidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "AUTH_STEP_LOGIN",
        `memory://auth-step-login/${body.executionId}`,
        cid
      );

      const profileResponse = await fetch(profileUrl, {
        method: "GET",
        headers: {
          "x-synthetic-client-id": sessionScopeId
        }
      });

      if (profileResponse.status !== 200) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "auth_evaluation_profile_failed");
        return res.status(422).setHeader("x-correlation-id", cid).json(
          authenticatedEvaluationError(body.executionId, body.entryUrl, "profile_fetch_failed", "profile_fetch_failed")
        );
      }

      const profilePayload = (await profileResponse.json()) as {
        profile: {
          username: string;
          role: "cliente" | "supervisor";
          panel: string;
          sections: string[];
          syntheticDataAccess: string;
        };
      };

      const profileEvidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "AUTH_SESSION_PROFILE",
        `memory://auth-session-profile/${body.executionId}`,
        cid
      );

      const logoutResponse = await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-synthetic-client-id": sessionScopeId
        },
        body: JSON.stringify({})
      });

      const logoutEvidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "AUTH_STEP_LOGOUT",
        `memory://auth-step-logout/${body.executionId}`,
        cid
      );

      await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "auth_evaluation_completed");

      const payload: AuthenticatedEvaluationResultDto = {
        ok: true,
        data: {
          steps: [
            {
              step: "LOGIN",
              statusHttp: loginResponse.status,
              evidenceId: loginEvidence.id,
              evidenceKind: loginEvidence.kind,
              evidenceLocation: loginEvidence.location,
              timestamp: loginEvidence.createdAt
            },
            {
              step: "PROFILE",
              statusHttp: profileResponse.status,
              evidenceId: profileEvidence.id,
              evidenceKind: profileEvidence.kind,
              evidenceLocation: profileEvidence.location,
              timestamp: profileEvidence.createdAt
            },
            {
              step: "LOGOUT",
              statusHttp: logoutResponse.status,
              evidenceId: logoutEvidence.id,
              evidenceKind: logoutEvidence.kind,
              evidenceLocation: logoutEvidence.location,
              timestamp: logoutEvidence.createdAt
            }
          ],
          executionId: body.executionId,
          entryUrl: body.entryUrl,
          role: body.role,
          sessionScopeId,
          authenticatedAt: new Date().toISOString(),
          profile: {
            username: profilePayload.profile.username,
            role: profilePayload.profile.role,
            panel: profilePayload.profile.panel,
            sections: profilePayload.profile.sections,
            syntheticDataAccess: profilePayload.profile.syntheticDataAccess
          },
          evidenceId: profileEvidence.id,
          loggedOut: logoutResponse.status === 200
        }
      };

      return res.status(200).setHeader("x-correlation-id", cid).json(payload);
    } catch (error) {
      await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "auth_evaluation_internal_error");
      return res.status(422).setHeader("x-correlation-id", cid).json(
        authenticatedEvaluationError(body.executionId, body.entryUrl, "internal_error", (error as Error).message)
      );
    }
  });

  router.post("/code-analysis/frontend/index/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartFrontendRepositoryIndexDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendIndexError("unknown_execution", body.repositoryPath ?? "unknown_repository", "invalid_execution_id", "execution_id_required")
      );
    }

    if (!body.repositoryPath || body.repositoryPath.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendIndexError(body.executionId, "unknown_repository", "invalid_repository_path", "repository_path_required")
      );
    }

    const maxFiles = body.maxFiles ?? 500;
    if (!Number.isInteger(maxFiles) || maxFiles <= 0 || maxFiles > 2000) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendIndexError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_files")
      );
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendIndexError(body.executionId, body.repositoryPath, "invalid_execution_id", "execution_id_not_found")
      );
    }

    const repositoryPath = path.resolve(body.repositoryPath);
    const repositoryStat = await fs.stat(repositoryPath).catch(() => undefined);
    if (!repositoryStat || !repositoryStat.isDirectory()) {
      const failure = recordFrontendRepositoryIndexResult(
        body.executionId,
        frontendIndexError(body.executionId, repositoryPath, "repository_path_not_found", "repository_path_not_found")
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    try {
      await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "frontend_index_queued");
      await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "frontend_index_started");

      const framework = await detectFrontendFramework(repositoryPath);
      const indexedFiles = await collectFrontendFiles(repositoryPath, maxFiles);
      const totalBytes = indexedFiles.reduce((sum, file) => sum + file.bytes, 0);

      const fileTypeCountMap = new Map<string, number>();
      for (const file of indexedFiles) {
        fileTypeCountMap.set(file.extension, (fileTypeCountMap.get(file.extension) ?? 0) + 1);
      }

      const evidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "FRONTEND_INDEX_SUMMARY",
        `memory://frontend-index/${body.executionId}`,
        cid
      );

      const success: FrontendRepositoryIndexResultDto = {
        ok: true,
        data: {
          executionId: body.executionId,
          repositoryPath,
          indexedAt: new Date().toISOString(),
          framework,
          totalFiles: indexedFiles.length,
          totalBytes,
          fileTypeCounts: Array.from(fileTypeCountMap.entries())
            .map(([extension, count]) => ({ extension, count }))
            .sort((a, b) => a.extension.localeCompare(b.extension)),
          sampleFiles: indexedFiles.slice(0, 25),
          evidenceId: evidence.id
        }
      };

      recordFrontendRepositoryIndexResult(body.executionId, success);
      await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "frontend_index_completed");

      return res.status(200).setHeader("x-correlation-id", cid).json(success);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "frontend_index_failed");
      }

      const failure = recordFrontendRepositoryIndexResult(
        body.executionId,
        frontendIndexError(body.executionId, repositoryPath, "indexing_failed", (error as Error).message)
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }
  });

  router.get("/code-analysis/frontend/index/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendIndexError(executionId, "unknown_repository", "invalid_execution_id", "execution_id_not_found")
      );
    }

    const result = getFrontendRepositoryIndexResult(executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json(
        frontendIndexError(executionId, "unknown_repository", "result_not_available", "frontend_index_result_not_available")
      );
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/code-analysis/frontend/patterns/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartFrontendPatternDetectionDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError("unknown_execution", body.repositoryPath ?? "unknown_repository", "invalid_execution_id", "execution_id_required")
      );
    }

    if (!body.repositoryPath || body.repositoryPath.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(body.executionId, "unknown_repository", "invalid_repository_path", "repository_path_required")
      );
    }

    const maxFiles = body.maxFiles ?? 500;
    if (!Number.isInteger(maxFiles) || maxFiles <= 0 || maxFiles > 2000) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_files")
      );
    }

    const maxMatchesPerFile = body.maxMatchesPerFile ?? 5;
    if (!Number.isInteger(maxMatchesPerFile) || maxMatchesPerFile <= 0 || maxMatchesPerFile > 25) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_matches_per_file")
      );
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(body.executionId, body.repositoryPath, "invalid_execution_id", "execution_id_not_found")
      );
    }

    const repositoryPath = path.resolve(body.repositoryPath);
    const repositoryStat = await fs.stat(repositoryPath).catch(() => undefined);
    if (!repositoryStat || !repositoryStat.isDirectory()) {
      const failure = recordFrontendPatternDetectionResult(
        body.executionId,
        frontendPatternDetectionError(body.executionId, repositoryPath, "repository_path_not_found", "repository_path_not_found")
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    try {
      await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "frontend_pattern_detection_queued");
      await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "frontend_pattern_detection_started");

      const indexedFiles = await collectFrontendFiles(repositoryPath, maxFiles);
      const files = await detectFrontendCapturePatterns(repositoryPath, indexedFiles, maxMatchesPerFile);
      const totalMatches = files.reduce((sum, file) => sum + file.matches.length, 0);

      const evidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "FRONTEND_PATTERN_SUMMARY",
        `memory://frontend-patterns/${body.executionId}`,
        cid
      );

      const success: FrontendPatternDetectionResultDto = {
        ok: true,
        data: {
          executionId: body.executionId,
          repositoryPath,
          detectedAt: new Date().toISOString(),
          totalFilesScanned: indexedFiles.length,
          totalFilesWithMatches: files.length,
          totalMatches,
          files,
          evidenceId: evidence.id
        }
      };

      recordFrontendPatternDetectionResult(body.executionId, success);
      await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "frontend_pattern_detection_completed");

      return res.status(200).setHeader("x-correlation-id", cid).json(success);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "frontend_pattern_detection_failed");
      }

      const failure = recordFrontendPatternDetectionResult(
        body.executionId,
        frontendPatternDetectionError(body.executionId, repositoryPath, "detection_failed", (error as Error).message)
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }
  });

  router.get("/code-analysis/frontend/patterns/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(executionId, "unknown_repository", "invalid_execution_id", "execution_id_not_found")
      );
    }

    const result = getFrontendPatternDetectionResult(executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json(
        frontendPatternDetectionError(executionId, "unknown_repository", "result_not_available", "frontend_pattern_detection_result_not_available")
      );
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/code-analysis/frontend/findings/:executionId/view", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const patternResult = getFrontendPatternDetectionResult(executionId);
    if (!patternResult || !patternResult.ok || !patternResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const ruleStats = new Map<FrontendPatternMatchDto["rule"], { matches: number; files: Set<string> }>();
    const fileSummaries = patternResult.data.files
      .map((file) => {
        const rules = Array.from(new Set(file.matches.map((match) => match.rule))).sort();
        for (const match of file.matches) {
          const current = ruleStats.get(match.rule) ?? { matches: 0, files: new Set<string>() };
          current.matches += 1;
          current.files.add(file.relativePath);
          ruleStats.set(match.rule, current);
        }

        return {
          relativePath: file.relativePath,
          matchCount: file.matches.length,
          rules
        };
      })
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const byRule = Array.from(ruleStats.entries())
      .map(([rule, stats]) => ({
        rule,
        matchCount: stats.matches,
        filesCount: stats.files.size
      }))
      .sort((a, b) => a.rule.localeCompare(b.rule));

    const payload: FrontendStaticFindingsViewDto = {
      executionId,
      generatedAt: new Date().toISOString(),
      totals: {
        scannedFiles: patternResult.data.totalFilesScanned,
        filesWithMatches: patternResult.data.totalFilesWithMatches,
        matches: patternResult.data.totalMatches,
        distinctRules: byRule.length
      },
      byRule,
      files: fileSummaries,
      evidenceId: patternResult.data.evidenceId
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.post("/code-analysis/backend/api-index/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartBackendApiIndexDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendApiIndexError("unknown_execution", body.repositoryPath ?? "unknown_repository", "invalid_execution_id", "execution_id_required")
      );
    }

    if (!body.repositoryPath || body.repositoryPath.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendApiIndexError(body.executionId, "unknown_repository", "invalid_repository_path", "repository_path_required")
      );
    }

    const maxFiles = body.maxFiles ?? 500;
    if (!Number.isInteger(maxFiles) || maxFiles <= 0 || maxFiles > 3000) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendApiIndexError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_files")
      );
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendApiIndexError(body.executionId, body.repositoryPath, "invalid_execution_id", "execution_id_not_found")
      );
    }

    const repositoryPath = path.resolve(body.repositoryPath);
    const repositoryStat = await fs.stat(repositoryPath).catch(() => undefined);
    if (!repositoryStat || !repositoryStat.isDirectory()) {
      const failure = recordBackendApiIndexResult(
        body.executionId,
        backendApiIndexError(body.executionId, repositoryPath, "repository_path_not_found", "repository_path_not_found")
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    try {
      const currentState = store.executions.get(body.executionId)?.state;
      const shouldTransitionLifecycle = currentState === ExecutionState.VALIDATED;

      if (
        currentState !== ExecutionState.VALIDATED &&
        currentState !== ExecutionState.COMPLETED &&
        currentState !== ExecutionState.COMPLETED_WITH_WARNINGS
      ) {
        throw new Error(`execution_invalid_state_for_backend_api_index:${currentState ?? "unknown"}`);
      }

      if (shouldTransitionLifecycle) {
        await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "backend_api_index_queued");
        await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "backend_api_index_started");
      }

      const artifacts = await collectBackendApiArtifacts(repositoryPath, maxFiles);
      const typeMap = new Map<BackendApiArtifactType, number>();
      for (const artifact of artifacts) {
        typeMap.set(artifact.artifactType, (typeMap.get(artifact.artifactType) ?? 0) + 1);
      }

      const evidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "BACKEND_API_INDEX_SUMMARY",
        `memory://backend-api-index/${body.executionId}`,
        cid
      );

      const success: BackendApiIndexResultDto = {
        ok: true,
        data: {
          executionId: body.executionId,
          repositoryPath,
          indexedAt: new Date().toISOString(),
          totalArtifacts: artifacts.length,
          artifactTypeCounts: Array.from(typeMap.entries())
            .map(([artifactType, count]) => ({ artifactType, count }))
            .sort((a, b) => a.artifactType.localeCompare(b.artifactType)),
          artifacts: artifacts.slice(0, 200),
          evidenceId: evidence.id
        }
      };

      recordBackendApiIndexResult(body.executionId, success);
      if (shouldTransitionLifecycle) {
        await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "backend_api_index_completed");
      }

      return res.status(200).setHeader("x-correlation-id", cid).json(success);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "backend_api_index_failed");
      }

      const failure = recordBackendApiIndexResult(
        body.executionId,
        backendApiIndexError(body.executionId, repositoryPath, "indexing_failed", (error as Error).message)
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }
  });

  router.get("/code-analysis/backend/api-index/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendApiIndexError(executionId, "unknown_repository", "invalid_execution_id", "execution_id_not_found")
      );
    }

    const result = getBackendApiIndexResult(executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json(
        backendApiIndexError(executionId, "unknown_repository", "result_not_available", "backend_api_index_result_not_available")
      );
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.post("/code-analysis/backend/processing/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartBackendProcessingDetectionDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError("unknown_execution", body.repositoryPath ?? "unknown_repository", "invalid_execution_id", "execution_id_required")
      );
    }

    if (!body.repositoryPath || body.repositoryPath.trim().length === 0) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(body.executionId, "unknown_repository", "invalid_repository_path", "repository_path_required")
      );
    }

    const maxFiles = body.maxFiles ?? 500;
    if (!Number.isInteger(maxFiles) || maxFiles <= 0 || maxFiles > 3000) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_files")
      );
    }

    const maxMatchesPerFile = body.maxMatchesPerFile ?? 5;
    if (!Number.isInteger(maxMatchesPerFile) || maxMatchesPerFile <= 0 || maxMatchesPerFile > 25) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(body.executionId, body.repositoryPath, "invalid_repository_path", "invalid_max_matches_per_file")
      );
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(body.executionId, body.repositoryPath, "invalid_execution_id", "execution_id_not_found")
      );
    }

    const repositoryPath = path.resolve(body.repositoryPath);
    const repositoryStat = await fs.stat(repositoryPath).catch(() => undefined);
    if (!repositoryStat || !repositoryStat.isDirectory()) {
      const failure = recordBackendProcessingDetectionResult(
        body.executionId,
        backendProcessingDetectionError(body.executionId, repositoryPath, "repository_path_not_found", "repository_path_not_found")
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    try {
      const currentState = store.executions.get(body.executionId)?.state;
      const shouldTransitionLifecycle = currentState === ExecutionState.VALIDATED;

      if (
        currentState !== ExecutionState.VALIDATED &&
        currentState !== ExecutionState.COMPLETED &&
        currentState !== ExecutionState.COMPLETED_WITH_WARNINGS
      ) {
        throw new Error(`execution_invalid_state_for_backend_processing_detection:${currentState ?? "unknown"}`);
      }

      if (shouldTransitionLifecycle) {
        await transitionExecutionState(body.executionId, ExecutionState.QUEUED, cid, "backend_processing_detection_queued");
        await transitionExecutionState(body.executionId, ExecutionState.RUNNING, cid, "backend_processing_detection_started");
      }

      const candidates = await collectBackendProcessingCandidates(repositoryPath, maxFiles);
      const files = await detectBackendProcessingPoints(repositoryPath, candidates, maxMatchesPerFile);
      const totalMatches = files.reduce((sum, file) => sum + file.matches.length, 0);

      const evidence = createEvidence(
        body.executionId,
        EvidenceLevel.E2,
        "BACKEND_PROCESSING_SUMMARY",
        `memory://backend-processing/${body.executionId}`,
        cid
      );

      const success: BackendProcessingDetectionResultDto = {
        ok: true,
        data: {
          executionId: body.executionId,
          repositoryPath,
          detectedAt: new Date().toISOString(),
          totalFilesScanned: candidates.length,
          totalFilesWithMatches: files.length,
          totalMatches,
          files,
          evidenceId: evidence.id
        }
      };

      recordBackendProcessingDetectionResult(body.executionId, success);
      if (shouldTransitionLifecycle) {
        await transitionExecutionState(body.executionId, ExecutionState.COMPLETED, cid, "backend_processing_detection_completed");
      }

      return res.status(200).setHeader("x-correlation-id", cid).json(success);
    } catch (error) {
      const currentExecution = store.executions.get(body.executionId);
      if (currentExecution?.state === ExecutionState.RUNNING || currentExecution?.state === ExecutionState.QUEUED) {
        await transitionExecutionState(body.executionId, ExecutionState.FAILED, cid, "backend_processing_detection_failed");
      }

      const failure = recordBackendProcessingDetectionResult(
        body.executionId,
        backendProcessingDetectionError(body.executionId, repositoryPath, "detection_failed", (error as Error).message)
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }
  });

  router.get("/code-analysis/backend/processing/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(executionId, "unknown_repository", "invalid_execution_id", "execution_id_not_found")
      );
    }

    const result = getBackendProcessingDetectionResult(executionId);
    if (!result) {
      return res.status(422).setHeader("x-correlation-id", cid).json(
        backendProcessingDetectionError(executionId, "unknown_repository", "result_not_available", "backend_processing_detection_result_not_available")
      );
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
  });

  router.get("/code-analysis/backend/processing-flow/:executionId/view", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const apiIndexResult = getBackendApiIndexResult(executionId);
    if (!apiIndexResult || !apiIndexResult.ok || !apiIndexResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_api_index_result_not_available" });
    }

    const processingResult = getBackendProcessingDetectionResult(executionId);
    if (!processingResult || !processingResult.ok || !processingResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_detection_result_not_available" });
    }

    const artifactTypeByPath = new Map<string, BackendApiArtifactType>();
    for (const artifact of apiIndexResult.data.artifacts) {
      artifactTypeByPath.set(artifact.relativePath, artifact.artifactType);
    }

    const ruleStats = new Map<BackendProcessingMatchDto["rule"], { matches: number; files: Set<string> }>();
    const fileSummaries = processingResult.data.files
      .map((file) => {
        const rules = Array.from(new Set(file.matches.map((match) => match.rule))).sort();

        for (const match of file.matches) {
          const current = ruleStats.get(match.rule) ?? { matches: 0, files: new Set<string>() };
          current.matches += 1;
          current.files.add(file.relativePath);
          ruleStats.set(match.rule, current);
        }

        return {
          relativePath: file.relativePath,
          artifactType: artifactTypeByPath.get(file.relativePath),
          matchCount: file.matches.length,
          rules
        };
      })
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const byRule = Array.from(ruleStats.entries())
      .map(([rule, stats]) => ({
        rule,
        matchCount: stats.matches,
        filesCount: stats.files.size
      }))
      .sort((a, b) => a.rule.localeCompare(b.rule));

    const payload: BackendProcessingFlowViewDto = {
      executionId,
      generatedAt: new Date().toISOString(),
      totals: {
        apiArtifacts: apiIndexResult.data.totalArtifacts,
        filesWithProcessingMatches: processingResult.data.totalFilesWithMatches,
        processingMatches: processingResult.data.totalMatches,
        distinctProcessingRules: byRule.length
      },
      byRule,
      files: fileSummaries,
      evidenceIds: {
        apiIndexEvidenceId: apiIndexResult.data.evidenceId,
        processingEvidenceId: processingResult.data.evidenceId
      }
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/lineage/correlations/:executionId/by-endpoint", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const frontendResult = getFrontendPatternDetectionResult(executionId);
    if (!frontendResult || !frontendResult.ok || !frontendResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const backendResult = getBackendProcessingDetectionResult(executionId);
    if (!backendResult || !backendResult.ok || !backendResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_detection_result_not_available" });
    }

    const frontendEndpointMap = new Map<string, LineageFrontendReferenceDto[]>();
    for (const file of frontendResult.data.files) {
      for (const match of file.matches) {
        const endpoints = extractSnippetEndpoints(match.snippet);
        for (const endpoint of endpoints) {
          const references = frontendEndpointMap.get(endpoint) ?? [];
          references.push({
            relativePath: file.relativePath,
            rule: match.rule,
            line: match.line,
            snippet: match.snippet
          });
          frontendEndpointMap.set(endpoint, references);
        }
      }
    }

    const backendEndpointMap = new Map<string, LineageBackendReferenceDto[]>();
    for (const file of backendResult.data.files) {
      for (const match of file.matches) {
        const endpoints = extractSnippetEndpoints(match.snippet);
        for (const endpoint of endpoints) {
          const references = backendEndpointMap.get(endpoint) ?? [];
          references.push({
            relativePath: file.relativePath,
            rule: match.rule,
            line: match.line,
            snippet: match.snippet
          });
          backendEndpointMap.set(endpoint, references);
        }
      }
    }

    const allEndpoints = new Set<string>([...frontendEndpointMap.keys(), ...backendEndpointMap.keys()]);
    const correlations = Array.from(allEndpoints)
      .sort((a, b) => a.localeCompare(b))
      .map((endpoint) => {
        const frontendReferences = frontendEndpointMap.get(endpoint) ?? [];
        const backendReferences = backendEndpointMap.get(endpoint) ?? [];
        const hasFrontend = frontendReferences.length > 0;
        const hasBackend = backendReferences.length > 0;

        const status: LineageCorrelationStatus = hasFrontend && hasBackend ? "INFERRED_HIGH" : "PENDING";
        const confidence = hasFrontend && hasBackend ? 0.8 : 0.3;

        return {
          endpoint,
          status,
          confidence,
          frontendReferences,
          backendReferences
        };
      });

    const payload: LineageEndpointCorrelationViewDto = {
      executionId,
      generatedAt: new Date().toISOString(),
      totals: {
        frontendEndpoints: frontendEndpointMap.size,
        backendEndpoints: backendEndpointMap.size,
        correlatedEndpoints: correlations.filter((item) => item.frontendReferences.length > 0 && item.backendReferences.length > 0).length
      },
      correlations,
      evidenceIds: {
        frontendPatternEvidenceId: frontendResult.data.evidenceId,
        backendProcessingEvidenceId: backendResult.data.evidenceId
      }
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/lineage/correlations/:executionId/by-dto-processing", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const apiIndexResult = getBackendApiIndexResult(executionId);
    if (!apiIndexResult || !apiIndexResult.ok || !apiIndexResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_api_index_result_not_available" });
    }

    const processingResult = getBackendProcessingDetectionResult(executionId);
    if (!processingResult || !processingResult.ok || !processingResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_detection_result_not_available" });
    }

    const apiIndexData = apiIndexResult.data;
    const processingData = processingResult.data;

    const dtoArtifacts = apiIndexData.artifacts.filter((artifact) => artifact.artifactType === "DTO");
    const correlations = dtoArtifacts
      .map((artifact) => {
        const dtoName = extractDtoNameFromPath(artifact.relativePath);
        const tokens = buildDtoCorrelationTokens(dtoName);
        const matchedTokens = new Set<string>();
        const processingReferences: LineageBackendReferenceDto[] = [];

        for (const file of processingData.files) {
          const normalizedPath = normalizeTokenSource(file.relativePath);

          for (const match of file.matches) {
            const normalizedSnippet = normalizeTokenSource(match.snippet);
            const hasTokenMatch = tokens.some((token) => {
              const found = normalizedSnippet.includes(token) || normalizedPath.includes(token);
              if (found) {
                matchedTokens.add(token);
              }
              return found;
            });

            if (!hasTokenMatch) {
              continue;
            }

            processingReferences.push({
              relativePath: file.relativePath,
              rule: match.rule,
              line: match.line,
              snippet: match.snippet
            });
          }
        }

        const status: LineageCorrelationStatus = processingReferences.length > 0 ? "INFERRED_HIGH" : "PENDING";
        const confidence = processingReferences.length > 0 ? 0.78 : 0.25;

        return {
          dto: {
            relativePath: artifact.relativePath,
            dtoName
          },
          status,
          confidence,
          matchedTokens: Array.from(matchedTokens).sort((a, b) => a.localeCompare(b)),
          processingReferences
        };
      })
      .sort((a, b) => a.dto.relativePath.localeCompare(b.dto.relativePath));

    const payload: LineageDtoProcessingCorrelationViewDto = {
      executionId,
      generatedAt: new Date().toISOString(),
      totals: {
        dtoArtifacts: dtoArtifacts.length,
        dtoWithProcessingMatches: correlations.filter((item) => item.processingReferences.length > 0).length,
        processingFiles: processingData.totalFilesWithMatches,
        correlations: correlations.length
      },
      correlations,
      evidenceIds: {
        backendApiIndexEvidenceId: apiIndexData.evidenceId,
        backendProcessingEvidenceId: processingData.evidenceId
      }
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.get("/lineage/views/:executionId/consolidated", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res.status(400).setHeader("x-correlation-id", cid).json({ error: "execution_id_not_found" });
    }

    const frontendResult = getFrontendPatternDetectionResult(executionId);
    if (!frontendResult || !frontendResult.ok || !frontendResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "frontend_pattern_detection_result_not_available" });
    }

    const apiIndexResult = getBackendApiIndexResult(executionId);
    if (!apiIndexResult || !apiIndexResult.ok || !apiIndexResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_api_index_result_not_available" });
    }

    const processingResult = getBackendProcessingDetectionResult(executionId);
    if (!processingResult || !processingResult.ok || !processingResult.data) {
      return res.status(422).setHeader("x-correlation-id", cid).json({ error: "backend_processing_detection_result_not_available" });
    }

    const frontendData = frontendResult.data;
    const apiIndexData = apiIndexResult.data;
    const processingData = processingResult.data;

    const frontendEndpointMap = new Map<string, LineageFrontendReferenceDto[]>();
    for (const file of frontendData.files) {
      for (const match of file.matches) {
        const endpoints = extractSnippetEndpoints(match.snippet);
        for (const endpoint of endpoints) {
          const references = frontendEndpointMap.get(endpoint) ?? [];
          references.push({
            relativePath: file.relativePath,
            rule: match.rule,
            line: match.line,
            snippet: match.snippet
          });
          frontendEndpointMap.set(endpoint, references);
        }
      }
    }

    const backendEndpointMap = new Map<string, LineageBackendReferenceDto[]>();
    for (const file of processingData.files) {
      for (const match of file.matches) {
        const endpoints = extractSnippetEndpoints(match.snippet);
        for (const endpoint of endpoints) {
          const references = backendEndpointMap.get(endpoint) ?? [];
          references.push({
            relativePath: file.relativePath,
            rule: match.rule,
            line: match.line,
            snippet: match.snippet
          });
          backendEndpointMap.set(endpoint, references);
        }
      }
    }

    const nodeMap = new Map<string, LineageConsolidatedViewDto["nodes"][number]>();
    const edges: LineageConsolidatedViewDto["edges"] = [];

    const allEndpoints = Array.from(new Set<string>([...frontendEndpointMap.keys(), ...backendEndpointMap.keys()])).sort((a, b) => a.localeCompare(b));
    for (const endpoint of allEndpoints) {
      const frontendRefs = frontendEndpointMap.get(endpoint) ?? [];
      const backendRefs = backendEndpointMap.get(endpoint) ?? [];

      if (frontendRefs.length > 0) {
        nodeMap.set(endpointNodeId("frontend", endpoint), {
          id: endpointNodeId("frontend", endpoint),
          type: "FRONTEND_ENDPOINT",
          label: endpoint,
          status: "INFERRED_HIGH"
        });
      }

      if (backendRefs.length > 0) {
        nodeMap.set(endpointNodeId("backend", endpoint), {
          id: endpointNodeId("backend", endpoint),
          type: "BACKEND_ENDPOINT",
          label: endpoint,
          status: "INFERRED_HIGH"
        });
      }

      if (frontendRefs.length > 0 && backendRefs.length > 0) {
        edges.push({
          id: `edge:endpoint:${endpoint}`,
          type: "CALLS_ENDPOINT",
          sourceId: endpointNodeId("frontend", endpoint),
          targetId: endpointNodeId("backend", endpoint),
          status: "INFERRED_HIGH",
          confidence: 0.8
        });
      }
    }

    const dtoArtifacts = apiIndexData.artifacts.filter((artifact) => artifact.artifactType === "DTO");
    for (const artifact of dtoArtifacts) {
      const dtoName = extractDtoNameFromPath(artifact.relativePath);
      const tokens = buildDtoCorrelationTokens(dtoName);
      const dtoId = dtoNodeId(artifact.relativePath);

      nodeMap.set(dtoId, {
        id: dtoId,
        type: "DTO_ARTIFACT",
        label: dtoName,
        status: "PENDING"
      });

      for (const file of processingData.files) {
        const processingId = processingNodeId(file.relativePath);
        const normalizedPath = normalizeTokenSource(file.relativePath);
        let hasTokenMatch = false;

        for (const match of file.matches) {
          const normalizedSnippet = normalizeTokenSource(match.snippet);
          const found = tokens.some((token) => normalizedSnippet.includes(token) || normalizedPath.includes(token));
          if (found) {
            hasTokenMatch = true;
            break;
          }
        }

        if (!hasTokenMatch) {
          continue;
        }

        nodeMap.set(dtoId, {
          id: dtoId,
          type: "DTO_ARTIFACT",
          label: dtoName,
          status: "INFERRED_HIGH"
        });

        nodeMap.set(processingId, {
          id: processingId,
          type: "BACKEND_PROCESSING_FILE",
          label: file.relativePath,
          status: "INFERRED_HIGH"
        });

        edges.push({
          id: `edge:dto:${artifact.relativePath}->${file.relativePath}`,
          type: "MAPPED_TO_PROCESSING",
          sourceId: dtoId,
          targetId: processingId,
          status: "INFERRED_HIGH",
          confidence: 0.78
        });
      }
    }

    const nodes = Array.from(nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    edges.sort((a, b) => a.id.localeCompare(b.id));

    const payload: LineageConsolidatedViewDto = {
      executionId,
      generatedAt: new Date().toISOString(),
      totals: {
        nodes: nodes.length,
        edges: edges.length,
        endpointLinks: edges.filter((edge) => edge.type === "CALLS_ENDPOINT").length,
        dtoProcessingLinks: edges.filter((edge) => edge.type === "MAPPED_TO_PROCESSING").length
      },
      nodes,
      edges,
      evidenceIds: {
        frontendPatternEvidenceId: frontendData.evidenceId,
        backendApiIndexEvidenceId: apiIndexData.evidenceId,
        backendProcessingEvidenceId: processingData.evidenceId
      }
    };

    return res.status(200).setHeader("x-correlation-id", cid).json({ data: payload });
  });

  router.post("/legal-analysis/discrepancies/start", async (req, res) => {
    const cid = correlationId(req);
    const body = req.body as StartLegalDiscrepancyDetectionDto;

    if (!body.executionId || body.executionId.trim().length === 0) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(legalDiscrepancyDetectionError("unknown_execution", "invalid_execution_id", "execution_id_required"));
    }

    const execution = await getExecutionByIdWithFallback(body.executionId);
    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(legalDiscrepancyDetectionError(body.executionId, "invalid_execution_id", "execution_id_not_found"));
    }

    const declaredThirdParties = normalizeDeclaredValues(body.declaredThirdParties);
    const declaredCookieKeys = normalizeDeclaredValues(body.declaredCookieKeys);
    if (!declaredThirdParties || !declaredCookieKeys) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(legalDiscrepancyDetectionError(body.executionId, "invalid_declared_values", "invalid_declared_values"));
    }

    const dynamicResult = getDynamicObservationResult(body.executionId);
    if (!dynamicResult || !dynamicResult.ok || !dynamicResult.data) {
      const failure = recordLegalDiscrepancyDetectionResult(
        body.executionId,
        legalDiscrepancyDetectionError(body.executionId, "tracking_inventory_not_available", "dynamic_observation_result_not_available")
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }

    try {
      const inventory = listTrackingInventoryByExecutionId(body.executionId);
      const discrepancies: LegalDiscrepancyItemDto[] = [];

      for (const thirdParty of inventory.thirdParties) {
        const normalized = thirdParty.domain.trim().toLowerCase();
        if (!declaredThirdParties.includes(normalized)) {
          discrepancies.push({
            kind: "THIRD_PARTY_OBSERVED_NOT_DECLARED",
            observedValue: thirdParty.domain,
            declaredInPolicy: false,
            message: `Existe una posible discrepancia: se observo tercero ${thirdParty.domain} no encontrado en lo declarado. Requiere validacion.`,
            requiresValidation: true
          });
        }
      }

      for (const cookie of inventory.cookies) {
        const normalized = cookie.key.trim().toLowerCase();
        if (!declaredCookieKeys.includes(normalized)) {
          discrepancies.push({
            kind: "COOKIE_OBSERVED_NOT_DECLARED",
            observedValue: cookie.key,
            declaredInPolicy: false,
            message: `Existe una posible discrepancia: se observo cookie ${cookie.key} no encontrada en lo declarado. Requiere validacion.`,
            requiresValidation: true
          });
        }
      }

      const success: LegalDiscrepancyDetectionResultDto = {
        ok: true,
        data: {
          executionId: body.executionId,
          analyzedAt: new Date().toISOString(),
          totals: {
            observedThirdParties: inventory.thirdParties.length,
            observedCookies: inventory.cookies.length,
            discrepancies: discrepancies.length
          },
          declared: {
            thirdParties: declaredThirdParties,
            cookieKeys: declaredCookieKeys
          },
          discrepancies,
          summary:
            discrepancies.length > 0
              ? "Existe una posible discrepancia entre comportamiento observado y declarado. Requiere validacion."
              : "No se observo discrepancia en terceros o cookies respecto de lo declarado. Requiere validacion humana del contexto."
        }
      };

      recordLegalDiscrepancyDetectionResult(body.executionId, success);
      return res.status(200).setHeader("x-correlation-id", cid).json(success);
    } catch (error) {
      const failure = recordLegalDiscrepancyDetectionResult(
        body.executionId,
        legalDiscrepancyDetectionError(body.executionId, "detection_failed", (error as Error).message)
      );
      return res.status(422).setHeader("x-correlation-id", cid).json(failure);
    }
  });

  router.get("/legal-analysis/discrepancies/:executionId/result", async (req, res) => {
    const cid = correlationId(req);
    const executionId = req.params.executionId;
    const execution = await getExecutionByIdWithFallback(executionId);

    if (!execution) {
      return res
        .status(400)
        .setHeader("x-correlation-id", cid)
        .json(legalDiscrepancyDetectionError(executionId, "invalid_execution_id", "execution_id_not_found"));
    }

    const result = getLegalDiscrepancyDetectionResult(executionId);
    if (!result) {
      return res
        .status(422)
        .setHeader("x-correlation-id", cid)
        .json(legalDiscrepancyDetectionError(executionId, "result_not_available", "legal_discrepancy_result_not_available"));
    }

    return res.status(200).setHeader("x-correlation-id", cid).json(result);
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
