import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateStage17PilotEvidence } from "../../tools/validate-stage17-pilot-evidence-lib";

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

    writeFile(root, "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json", "{}");
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
    writeFile(root, "docs/etapa-17/evidencias/piloto-e2e-controlado-2026-09-03.json", "{}");

    expect(() => validateStage17PilotEvidence({ rootDir: root, silent: true })).toThrowError("No existe bitacora real");
  });
});
