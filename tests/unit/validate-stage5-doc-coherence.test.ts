import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type ForbiddenCheck,
  type RequiredCheck,
  validateStage5DocCoherence
} from "../../tools/validate-stage5-doc-coherence-lib";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage5-doc-coherence-"));
  tempRoots.push(root);

  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "etapa-5"), { recursive: true });

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

describe("validateStage5DocCoherence", () => {
  it("pasa cuando se cumplen snippets requeridos y no hay obsoletos", () => {
    const root = createTempWorkspace();
    writeFile(root, ".github/workflows/ci.yml", "required-ci-snippet\n");
    writeFile(root, "docs/etapa-5/check.md", "required-doc-snippet\n");

    const requiredChecks: RequiredCheck[] = [
      {
        file: ".github/workflows/ci.yml",
        requiredSnippets: ["required-ci-snippet"]
      },
      {
        file: "docs/etapa-5/check.md",
        requiredSnippets: ["required-doc-snippet"]
      }
    ];

    const forbiddenChecks: ForbiddenCheck[] = [
      {
        file: ".github/workflows/ci.yml",
        forbiddenSnippets: ["legacy-snippet"]
      }
    ];

    expect(() =>
      validateStage5DocCoherence({
        rootDir: root,
        requiredChecks,
        forbiddenChecks
      })
    ).not.toThrow();
  });

  it("falla cuando falta un snippet requerido", () => {
    const root = createTempWorkspace();
    writeFile(root, ".github/workflows/ci.yml", "required-ci-snippet\n");
    writeFile(root, "docs/etapa-5/check.md", "contenido\n");

    const requiredChecks: RequiredCheck[] = [
      {
        file: "docs/etapa-5/check.md",
        requiredSnippets: ["required-doc-snippet"]
      }
    ];

    expect(() =>
      validateStage5DocCoherence({
        rootDir: root,
        requiredChecks,
        forbiddenChecks: []
      })
    ).toThrowError("falta fragmento requerido");
  });

  it("falla cuando existe un snippet obsoleto", () => {
    const root = createTempWorkspace();
    writeFile(root, ".github/workflows/ci.yml", "legacy-snippet\n");
    writeFile(root, "docs/etapa-5/check.md", "required-doc-snippet\n");

    const forbiddenChecks: ForbiddenCheck[] = [
      {
        file: ".github/workflows/ci.yml",
        forbiddenSnippets: ["legacy-snippet"]
      }
    ];

    expect(() =>
      validateStage5DocCoherence({
        rootDir: root,
        requiredChecks: [],
        forbiddenChecks
      })
    ).toThrowError("contiene fragmento obsoleto");
  });

  it("falla cuando no existe docs/etapa-5", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage5-doc-coherence-missing-docs-"));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
    writeFile(root, ".github/workflows/ci.yml", "ok\n");

    expect(() =>
      validateStage5DocCoherence({
        rootDir: root,
        requiredChecks: [],
        forbiddenChecks: []
      })
    ).toThrowError("No existe docs/etapa-5");
  });
});
