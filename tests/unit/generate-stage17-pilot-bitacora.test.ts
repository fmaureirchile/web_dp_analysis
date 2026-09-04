import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateStage17PilotBitacora } from "../../tools/generate-stage17-pilot-bitacora-lib";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage17-bitacora-"));
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

describe("generateStage17PilotBitacora", () => {
  it("genera bitacora desde la evidencia mas reciente", async () => {
    const root = createTempWorkspace();

    writeFile(
      root,
      "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json",
      JSON.stringify(
        {
          executedAt: "2026-09-03T10:00:00.000Z",
          executionIds: {
            baselineExecutionId: "baseline-id",
            currentExecutionId: "current-id",
            retentionExecutionId: "retention-id"
          },
          status: {
            baselineRun: 200,
            currentRun: 200,
            comparison: 200,
            purge: 200,
            retention: 200
          },
          comparisonSummary: { ok: true, alert: { status: "CHANGES_DETECTED" } },
          purgeSummary: { ok: true },
          retentionSummary: { ok: true, candidateExecutions: 1, purgedExecutions: 1 }
        },
        null,
        2
      )
    );

    const result = await generateStage17PilotBitacora({ rootDir: root, silent: true });
    const content = fs.readFileSync(result.bitacoraPath, "utf8");

    expect(result.bitacoraPath.endsWith("bitacora-corrida-piloto-e2e-2026-09-03.md")).toBe(true);
    expect(content).toContain("baselineExecutionId: baseline-id");
    expect(content).toContain("ok=true");
    expect(content).toContain("estado de alerta CHANGES_DETECTED");
  });

  it("falla cuando no existe evidencia", async () => {
    const root = createTempWorkspace();

    await expect(generateStage17PilotBitacora({ rootDir: root, silent: true })).rejects.toThrowError(
      "no existe evidencia JSON"
    );
  });
});
