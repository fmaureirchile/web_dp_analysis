import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EVIDENCE_FILE_REGEX = /^piloto-e2e-controlado-(\d{4}-\d{2}-\d{2})\.json$/;

type PilotEvidence = {
  executedAt?: unknown;
  executionIds?: {
    baselineExecutionId?: unknown;
    currentExecutionId?: unknown;
    retentionExecutionId?: unknown;
  };
  status?: {
    baselineRun?: unknown;
    currentRun?: unknown;
    retentionRun?: unknown;
    comparison?: unknown;
    purge?: unknown;
    retention?: unknown;
  };
  comparisonSummary?: {
    ok?: unknown;
  };
  purgeSummary?: {
    ok?: unknown;
  };
  retentionSummary?: {
    ok?: unknown;
    candidateExecutions?: unknown;
    purgedExecutions?: unknown;
  };
};

export type Stage17EvidenceValidationReport = {
  ok: boolean;
  checkedAt: string;
  latestEvidenceFile: string | null;
  expectedBitacoraFile: string | null;
  issues: string[];
  checks: {
    stage17DirExists: boolean;
    evidenceDirExists: boolean;
    hasEvidenceJson: boolean;
    hasAnyBitacora: boolean;
    latestEvidenceJsonValid: boolean;
    latestBitacoraExists: boolean;
  };
};

function fail(messages: string[]): never {
  throw new Error(`[docs:stage17:evidence] FAIL\n${messages.map((msg) => `- ${msg}`).join("\n")}`);
}

function listMatchingFiles(dirPath: string, matcher: RegExp): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && matcher.test(entry.name)).map((entry) => entry.name);
}

function isValidDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpStatusCode(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateEvidenceShape(evidence: PilotEvidence, issues: string[]): void {
  if (!isNonEmptyString(evidence.executedAt) || !isValidDate(evidence.executedAt)) {
    issues.push("evidencia JSON invalida: executedAt debe ser fecha ISO valida");
  }

  if (!isNonEmptyString(evidence.executionIds?.baselineExecutionId)) {
    issues.push("evidencia JSON invalida: executionIds.baselineExecutionId requerido");
  }
  if (!isNonEmptyString(evidence.executionIds?.currentExecutionId)) {
    issues.push("evidencia JSON invalida: executionIds.currentExecutionId requerido");
  }
  if (!isNonEmptyString(evidence.executionIds?.retentionExecutionId)) {
    issues.push("evidencia JSON invalida: executionIds.retentionExecutionId requerido");
  }

  if (!isHttpStatusCode(evidence.status?.baselineRun)) {
    issues.push("evidencia JSON invalida: status.baselineRun debe ser HTTP status valido");
  }
  if (!isHttpStatusCode(evidence.status?.currentRun)) {
    issues.push("evidencia JSON invalida: status.currentRun debe ser HTTP status valido");
  }
  if (!isHttpStatusCode(evidence.status?.retentionRun)) {
    issues.push("evidencia JSON invalida: status.retentionRun debe ser HTTP status valido");
  }
  if (!isHttpStatusCode(evidence.status?.comparison)) {
    issues.push("evidencia JSON invalida: status.comparison debe ser HTTP status valido");
  }
  if (!isHttpStatusCode(evidence.status?.purge)) {
    issues.push("evidencia JSON invalida: status.purge debe ser HTTP status valido");
  }
  if (!isHttpStatusCode(evidence.status?.retention)) {
    issues.push("evidencia JSON invalida: status.retention debe ser HTTP status valido");
  }

  if (!isBoolean(evidence.comparisonSummary?.ok)) {
    issues.push("evidencia JSON invalida: comparisonSummary.ok debe ser boolean");
  }
  if (!isBoolean(evidence.purgeSummary?.ok)) {
    issues.push("evidencia JSON invalida: purgeSummary.ok debe ser boolean");
  }
  if (!isBoolean(evidence.retentionSummary?.ok)) {
    issues.push("evidencia JSON invalida: retentionSummary.ok debe ser boolean");
  }
  if (!isNonNegativeInteger(evidence.retentionSummary?.candidateExecutions)) {
    issues.push("evidencia JSON invalida: retentionSummary.candidateExecutions debe ser entero >= 0");
  }
  if (!isNonNegativeInteger(evidence.retentionSummary?.purgedExecutions)) {
    issues.push("evidencia JSON invalida: retentionSummary.purgedExecutions debe ser entero >= 0");
  }
}

function validateEvidenceSemantics(evidence: PilotEvidence, dateToken: string, issues: string[]): void {
  const executedAt = evidence.executedAt;
  if (isNonEmptyString(executedAt)) {
    const executedDateToken = new Date(executedAt).toISOString().slice(0, 10);
    if (executedDateToken !== dateToken) {
      issues.push("evidencia JSON inconsistente: executedAt no coincide con la fecha del archivo");
    }
  }

  const statuses = evidence.status;
  const expectedStatusFields: Array<keyof NonNullable<PilotEvidence["status"]>> = [
    "baselineRun",
    "currentRun",
    "retentionRun",
    "comparison",
    "purge",
    "retention"
  ];

  for (const field of expectedStatusFields) {
    if (statuses?.[field] !== 200) {
      issues.push(`evidencia JSON inconsistente: status.${field} debe ser 200 en corrida controlada`);
    }
  }

  if (evidence.comparisonSummary?.ok !== true) {
    issues.push("evidencia JSON inconsistente: comparisonSummary.ok debe ser true");
  }
  if (evidence.purgeSummary?.ok !== true) {
    issues.push("evidencia JSON inconsistente: purgeSummary.ok debe ser true");
  }
  if (evidence.retentionSummary?.ok !== true) {
    issues.push("evidencia JSON inconsistente: retentionSummary.ok debe ser true");
  }

  const candidateExecutions = evidence.retentionSummary?.candidateExecutions;
  const purgedExecutions = evidence.retentionSummary?.purgedExecutions;
  if (isNonNegativeInteger(candidateExecutions) && isNonNegativeInteger(purgedExecutions)) {
    if (purgedExecutions > candidateExecutions) {
      issues.push("evidencia JSON inconsistente: purgedExecutions no puede exceder candidateExecutions");
    }
  }
}

export function validateStage17PilotEvidence(input?: { rootDir?: string; silent?: boolean }): void {
  const report = getStage17PilotEvidenceReport(input);

  if (!report.ok) {
    fail(report.issues);
  }

  if (!input?.silent) {
    process.stdout.write("[docs:stage17:evidence] OK\n");
  }
}

export function getStage17PilotEvidenceReport(input?: { rootDir?: string }): Stage17EvidenceValidationReport {
  const rootDir = input?.rootDir ?? ROOT;
  const stage17Dir = path.join(rootDir, "docs", "etapa-17");
  const evidenceDir = path.join(stage17Dir, "evidencias");

  const issues: string[] = [];
  const checks: Stage17EvidenceValidationReport["checks"] = {
    stage17DirExists: false,
    evidenceDirExists: false,
    hasEvidenceJson: false,
    hasAnyBitacora: false,
    latestEvidenceJsonValid: false,
    latestBitacoraExists: false
  };

  let latestEvidenceFile: string | null = null;
  let expectedBitacoraFile: string | null = null;

  checks.stage17DirExists = fs.existsSync(stage17Dir);

  if (!checks.stage17DirExists) {
    issues.push("No existe docs/etapa-17");
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      latestEvidenceFile,
      expectedBitacoraFile,
      issues,
      checks
    };
  }

  checks.evidenceDirExists = fs.existsSync(evidenceDir);

  if (!checks.evidenceDirExists) {
    issues.push("No existe docs/etapa-17/evidencias");
  }

  const evidenceFiles = fs.existsSync(evidenceDir) ? listMatchingFiles(evidenceDir, EVIDENCE_FILE_REGEX).sort() : [];
  checks.hasEvidenceJson = evidenceFiles.length > 0;

  if (evidenceFiles.length === 0) {
    issues.push("No existe evidencia JSON de corrida piloto controlada (piloto-e2e-controlado-YYYY-MM-DD.json)");
  }

  if (evidenceFiles.length > 0) {
    const latestEvidenceFileName = evidenceFiles[evidenceFiles.length - 1];
    const evidencePath = path.join(evidenceDir, latestEvidenceFileName);
    const dateToken = latestEvidenceFileName.match(EVIDENCE_FILE_REGEX)?.[1] ?? "";
    expectedBitacoraFile = `bitacora-corrida-piloto-e2e-${dateToken}.md`;
    checks.latestBitacoraExists = fs.existsSync(path.join(stage17Dir, expectedBitacoraFile));

    let parsedEvidence: PilotEvidence | null = null;
    try {
      parsedEvidence = JSON.parse(fs.readFileSync(evidencePath, "utf8")) as PilotEvidence;
      checks.latestEvidenceJsonValid = true;
    } catch {
      issues.push(`evidencia JSON invalida: no se pudo parsear ${latestEvidenceFileName}`);
    }

    if (parsedEvidence) {
      validateEvidenceShape(parsedEvidence, issues);
      validateEvidenceSemantics(parsedEvidence, dateToken, issues);
    }

    if (!checks.latestBitacoraExists) {
      issues.push(`No existe bitacora real asociada al ultimo JSON: ${expectedBitacoraFile}`);
    }

    latestEvidenceFile = latestEvidenceFileName;
  }

  checks.hasAnyBitacora = listMatchingFiles(stage17Dir, /^bitacora-corrida-piloto-e2e-\d{4}-\d{2}-\d{2}\.md$/).length > 0;
  if (!checks.hasAnyBitacora) {
    issues.push("No existe bitacora real de corrida piloto (bitacora-corrida-piloto-e2e-YYYY-MM-DD.md)");
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    latestEvidenceFile,
    expectedBitacoraFile,
    issues,
    checks
  };
}
