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

function isNonNegativeInteger(value: unknown): boolean {
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

export function validateStage17PilotEvidence(input?: { rootDir?: string; silent?: boolean }): void {
  const rootDir = input?.rootDir ?? ROOT;
  const stage17Dir = path.join(rootDir, "docs", "etapa-17");
  const evidenceDir = path.join(stage17Dir, "evidencias");

  const issues: string[] = [];

  if (!fs.existsSync(stage17Dir)) {
    fail(["No existe docs/etapa-17"]);
  }

  if (!fs.existsSync(evidenceDir)) {
    issues.push("No existe docs/etapa-17/evidencias");
  }

  const evidenceFiles = fs.existsSync(evidenceDir) ? listMatchingFiles(evidenceDir, EVIDENCE_FILE_REGEX).sort() : [];
  if (evidenceFiles.length === 0) {
    issues.push("No existe evidencia JSON de corrida piloto controlada (piloto-e2e-controlado-YYYY-MM-DD.json)");
  }

  if (evidenceFiles.length > 0) {
    const latestEvidenceFile = evidenceFiles[evidenceFiles.length - 1];
    const evidencePath = path.join(evidenceDir, latestEvidenceFile);
    const dateToken = latestEvidenceFile.match(EVIDENCE_FILE_REGEX)?.[1] ?? "";

    let parsedEvidence: PilotEvidence | null = null;
    try {
      parsedEvidence = JSON.parse(fs.readFileSync(evidencePath, "utf8")) as PilotEvidence;
    } catch {
      issues.push(`evidencia JSON invalida: no se pudo parsear ${latestEvidenceFile}`);
    }

    if (parsedEvidence) {
      validateEvidenceShape(parsedEvidence, issues);
    }

    const expectedBitacora = `bitacora-corrida-piloto-e2e-${dateToken}.md`;
    if (!fs.existsSync(path.join(stage17Dir, expectedBitacora))) {
      issues.push(`No existe bitacora real asociada al ultimo JSON: ${expectedBitacora}`);
    }
  }

  if (listMatchingFiles(stage17Dir, /^bitacora-corrida-piloto-e2e-\d{4}-\d{2}-\d{2}\.md$/).length === 0) {
    issues.push("No existe bitacora real de corrida piloto (bitacora-corrida-piloto-e2e-YYYY-MM-DD.md)");
  }

  if (issues.length > 0) {
    fail(issues);
  }

  if (!input?.silent) {
    process.stdout.write("[docs:stage17:evidence] OK\n");
  }
}
