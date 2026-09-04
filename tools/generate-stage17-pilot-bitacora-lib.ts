import { promises as fs } from "node:fs";
import path from "node:path";

type PilotEvidence = {
  executedAt: string;
  executionIds?: {
    baselineExecutionId?: string;
    currentExecutionId?: string;
    retentionExecutionId?: string;
  };
  status?: {
    baselineRun?: number;
    currentRun?: number;
    comparison?: number;
    purge?: number;
    retention?: number;
  };
  comparisonSummary?: {
    ok?: boolean;
    alert?: {
      status?: string;
    };
  };
  purgeSummary?: {
    ok?: boolean;
  };
  retentionSummary?: {
    ok?: boolean;
    candidateExecutions?: number;
    purgedExecutions?: number;
  };
};

function fail(message: string): never {
  throw new Error(`[pilot:e2e:stage17:bitacora] FAIL ${message}`);
}

function toBoolText(value: boolean | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

function resolveDateToken(executedAt: string): string {
  const date = new Date(executedAt);
  if (Number.isNaN(date.getTime())) {
    fail("executedAt invalido en evidencia JSON");
  }
  return date.toISOString().slice(0, 10);
}

function buildBitacoraMarkdown(input: {
  dateToken: string;
  evidenceRelPath: string;
  evidence: PilotEvidence;
}): string {
  const { dateToken, evidenceRelPath, evidence } = input;

  const baselineExecutionId = evidence.executionIds?.baselineExecutionId ?? "unknown";
  const currentExecutionId = evidence.executionIds?.currentExecutionId ?? "unknown";
  const retentionExecutionId = evidence.executionIds?.retentionExecutionId ?? "unknown";

  const baselineRun = evidence.status?.baselineRun ?? "unknown";
  const currentRun = evidence.status?.currentRun ?? "unknown";
  const comparison = evidence.status?.comparison ?? "unknown";
  const purge = evidence.status?.purge ?? "unknown";
  const retention = evidence.status?.retention ?? "unknown";

  const comparisonOk = toBoolText(evidence.comparisonSummary?.ok);
  const comparisonAlert = evidence.comparisonSummary?.alert?.status ?? "unknown";
  const purgeOk = toBoolText(evidence.purgeSummary?.ok);
  const retentionOk = toBoolText(evidence.retentionSummary?.ok);
  const candidateExecutions = evidence.retentionSummary?.candidateExecutions ?? "unknown";
  const purgedExecutions = evidence.retentionSummary?.purgedExecutions ?? "unknown";

  return `# Bitacora de corrida real - Piloto E2E autorizado

Fecha: ${dateToken}

## Objetivo de la corrida

Ejecutar una corrida piloto E2E controlada con evidencia real y cierre seguro post-ejecucion.

## Referencias operativas

1. Checklist: docs/etapa-17/checklist-piloto-e2e-autorizado.md.
2. Runbook: docs/etapa-17/runbook-operativo-piloto.md.
3. Plan de corrida: docs/etapa-17/plan-primera-corrida-piloto-e2e.md.
4. Evidencia JSON: ${evidenceRelPath}.

## Execution IDs de la corrida

1. baselineExecutionId: ${baselineExecutionId}
2. currentExecutionId: ${currentExecutionId}
3. retentionExecutionId: ${retentionExecutionId}

## Resultado por fase

1. Observacion baseline: HTTP ${baselineRun}.
2. Observacion current: HTTP ${currentRun}.
3. Comparacion baseline vs current: HTTP ${comparison}, ok=${comparisonOk}, estado de alerta ${comparisonAlert}.
4. Purga puntual de currentExecutionId: HTTP ${purge}, ok=${purgeOk}.
5. Retencion por ventana: HTTP ${retention}, ok=${retentionOk}, candidateExecutions=${candidateExecutions}, purgedExecutions=${purgedExecutions}.

## Evidencia de cierre seguro

1. Purga puntual devolvio deletedCounts para artefactos operativos.
2. Retencion elimino ejecuciones fuera de ventana segun politica configurada.
3. Trazabilidad completa conservada mediante executionId y archivo JSON de evidencia.

## Cierre de credenciales

1. [INDICAR_ESTADO_CREDENCIALES_TEMPORALES: REVOCADAS | ROTADAS | NO_APLICA]
2. [INDICAR_EVIDENCIA_O_REFERENCIA_INTERNA_DE_CIERRE]

## Incidencias

1. [DETALLAR_INCIDENCIAS_O_INDICAR_SIN_INCIDENCIAS_BLOQUEANTES]

## Decision

Corrida piloto E2E controlada finalizada en estado [APTO | APTO_CON_OBSERVACIONES | NO_APTO], con evidencia operativa y limpieza post-ejecucion aplicada.
`;
}

async function resolveEvidencePath(rootDir: string, inputPath?: string): Promise<string> {
  if (inputPath && inputPath.trim().length > 0) {
    return path.isAbsolute(inputPath) ? inputPath : path.join(rootDir, inputPath);
  }

  const evidenceDir = path.join(rootDir, "docs", "etapa-17", "evidencias");
  const entries = await fs.readdir(evidenceDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && /^piloto-e2e-controlado-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (candidates.length === 0) {
    fail("no existe evidencia JSON en docs/etapa-17/evidencias");
  }

  return path.join(evidenceDir, candidates[candidates.length - 1]);
}

export async function generateStage17PilotBitacora(input?: {
  rootDir?: string;
  evidencePath?: string;
  silent?: boolean;
}): Promise<{ evidencePath: string; bitacoraPath: string }> {
  const rootDir = input?.rootDir ?? process.cwd();
  const evidencePath = await resolveEvidencePath(rootDir, input?.evidencePath);

  const rawEvidence = await fs.readFile(evidencePath, "utf8");
  const evidence = JSON.parse(rawEvidence) as PilotEvidence;

  if (!evidence.executedAt) {
    fail("evidencia sin campo executedAt");
  }

  const dateToken = resolveDateToken(evidence.executedAt);
  const stage17Dir = path.join(rootDir, "docs", "etapa-17");
  const bitacoraPath = path.join(stage17Dir, `bitacora-corrida-piloto-e2e-${dateToken}.md`);
  const evidenceRelPath = path.relative(rootDir, evidencePath).replaceAll(path.sep, "/");

  const markdown = buildBitacoraMarkdown({ dateToken, evidenceRelPath, evidence });
  await fs.writeFile(bitacoraPath, markdown, "utf8");

  if (!input?.silent) {
    process.stdout.write("[pilot:e2e:stage17:bitacora] OK\n");
    process.stdout.write(`evidence_file=${evidencePath}\n`);
    process.stdout.write(`bitacora_file=${bitacoraPath}\n`);
  }

  return { evidencePath, bitacoraPath };
}
