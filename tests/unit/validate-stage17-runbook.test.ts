import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type RequiredCheck, validateStage17Runbook } from "../../tools/validate-stage17-runbook-lib";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage17-runbook-"));
  tempRoots.push(root);

  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "etapa-17"), { recursive: true });

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

describe("validateStage17Runbook", () => {
  it("pasa cuando estan todos los fragmentos requeridos", () => {
    const root = createTempWorkspace();
    writeFile(root, "docs/etapa-17/runbook-operativo-piloto.md", "objetivo\nwindowMinutes\nstates\n");
    writeFile(root, "docs/etapa-17/README.md", "runbook-operativo-piloto.md\nnpm run docs:stage17:runbook\n");
    writeFile(root, "docs/etapa-17/backlog-etapa-17.md", "## E17-T03 - Runbook operativo inicial\nEstado: completada.\n");
    writeFile(root, "package.json", "docs:stage17:runbook\nlab:e17-3:gate\n");
    writeFile(root, ".github/workflows/ci.yml", "Report Stage 17 gate coverage\nStage 17 gate E17-T03\ndocs_stage17_runbook=ok\n");

    const requiredChecks: RequiredCheck[] = [
      { file: "docs/etapa-17/runbook-operativo-piloto.md", requiredSnippets: ["windowMinutes", "states"] },
      { file: "docs/etapa-17/README.md", requiredSnippets: ["runbook-operativo-piloto.md"] }
    ];

    expect(() => validateStage17Runbook({ rootDir: root, requiredChecks })).not.toThrow();
  });

  it("falla cuando falta snippet requerido", () => {
    const root = createTempWorkspace();
    writeFile(root, "docs/etapa-17/runbook-operativo-piloto.md", "contenido\n");

    const requiredChecks: RequiredCheck[] = [
      { file: "docs/etapa-17/runbook-operativo-piloto.md", requiredSnippets: ["windowMinutes"] }
    ];

    expect(() => validateStage17Runbook({ rootDir: root, requiredChecks })).toThrowError("falta fragmento requerido");
  });

  it("falla cuando no existe docs/etapa-17", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage17-runbook-missing-docs-"));
    tempRoots.push(root);

    expect(() => validateStage17Runbook({ rootDir: root, requiredChecks: [] })).toThrowError("No existe docs/etapa-17");
  });
});
