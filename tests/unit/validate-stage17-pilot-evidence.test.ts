import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getStage17PilotEvidenceReport, validateStage17PilotEvidence } from "../../tools/validate-stage17-pilot-evidence-lib";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage17-pilot-evidence-"));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, "docs", "etapa-17", "evidencias"), { recursive: true });
  return root;
}

function writeFile(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("validateStage17PilotEvidence", () => {
  it("pasa cuando existe JSON de evidencia y bitacora real", () => {
    const root = createTempWorkspace();

    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json",
      JSON.stringify({
        executedAt: "2026-09-03T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-03.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).not.toThrow();
  });

  it("falla cuando no existe evidencia JSON", () => {
    const root = createTempWorkspace();
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-03.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError("No existe evidencia JSON");
  });

  it("falla cuando no existe bitacora real", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json",
      JSON.stringify({
        executedAt: "2026-09-03T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError("No existe bitacora real");
  });

  it("falla cuando JSON esta mal formado", () => {
    const root = createTempWorkspace();
    writeFile(root, "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json", "{ bad json");
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-03.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError("no se pudo parsear");
  });

  it("falla cuando faltan campos estructurales obligatorios", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json",
      JSON.stringify({
        executedAt: "2026-09-03T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id"
        },
        status: {
          baselineRun: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-03.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError(
      "executionIds.currentExecutionId requerido"
    );
  });

  it("falla cuando no existe bitacora asociada al ultimo JSON", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-04.json",
      JSON.stringify({
        executedAt: "2026-09-04T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-03.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError(
      "No existe bitacora real asociada al ultimo JSON"
    );
  });

  it("falla cuando algun status no es 200", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-04.json",
      JSON.stringify({
        executedAt: "2026-09-04T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 500,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-04.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError(
      "status.retentionRun debe ser 200"
    );
  });

  it("falla cuando purgedExecutions excede candidateExecutions", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-04.json",
      JSON.stringify({
        executedAt: "2026-09-04T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 2 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-04.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError(
      "purgedExecutions no puede exceder candidateExecutions"
    );
  });

  it("falla cuando executedAt no coincide con fecha de archivo", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-04.json",
      JSON.stringify({
        executedAt: "2026-09-03T23:59:00.000Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-04.md", "# bitacora\n");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError(
      "executedAt no coincide con la fecha del archivo"
    );
  });

  it("genera reporte machine-readable con checks y archivos", () => {
    const root = createTempWorkspace();
    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-04.json",
      JSON.stringify({
        executedAt: "2026-09-04T05:36:56.950Z",
        executionIds: {
          baselineExecutionId: "baseline-id",
          currentExecutionId: "current-id",
          retentionExecutionId: "retention-id"
        },
        status: {
          baselineRun: 200,
          currentRun: 200,
          retentionRun: 200,
          comparison: 200,
          purge: 200,
          retention: 200
        },
        comparisonSummary: { ok: true },
        purgeSummary: { ok: true },
        retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
      })
    );
    writeFile(root, "docs/etapa-17/bitacora-corrida-piloto-e2e-2026-09-04.md", "# bitacora\n");

    const report = getStage17PilotEvidenceReport({ rootDir: root });

    expect(report.ok).toBe(true);
    expect(report.latestEvidenceFile).toBe("piloto-e2e-controlado-2026-09-04.json");
    expect(report.expectedBitacoraFile).toBe("bitacora-corrida-piloto-e2e-2026-09-04.md");
    expect(report.checks.latestEvidenceJsonValid).toBe(true);
    expect(report.checks.latestBitacoraExists).toBe(true);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(report.issues.length).toBe(0);
  });
});
