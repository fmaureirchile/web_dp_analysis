import fs from "node:fs";
import path from "node:path";

export type RequiredCheck = {
  file: string;
  requiredSnippets: string[];
};

const ROOT = process.cwd();

const REQUIRED_CHECKS: RequiredCheck[] = [
  {
    file: "docs/etapa-17/runbook-operativo-piloto.md",
    requiredSnippets: [
      "## Objetivo",
      "## Flujo operativo recomendado",
      "## Comandos operativos",
      "## Checklist de cierre seguro",
      "/api/v1/privacy/executions/<executionId>/purge",
      "/api/v1/privacy/retention/apply",
      "windowMinutes",
      "states"
    ]
  },
  {
    file: "docs/etapa-17/README.md",
    requiredSnippets: [
      "runbook-operativo-piloto.md",
      "npm run docs:stage17:runbook"
    ]
  },
  {
    file: "docs/etapa-17/backlog-etapa-17.md",
    requiredSnippets: ["## E17-T03 - Runbook operativo inicial", "Estado: completada."]
  },
  {
    file: "package.json",
    requiredSnippets: ["docs:stage17:runbook", "lab:e17-3:gate"]
  },
  {
    file: ".github/workflows/ci.yml",
    requiredSnippets: ["Report Stage 17 gate coverage", "Stage 17 gate E17-T03", "docs_stage17_runbook=ok"]
  }
];

function fail(messages: string[]): never {
  throw new Error(`[docs:stage17:runbook] FAIL\n${messages.map((msg) => `- ${msg}`).join("\n")}`);
}

function validateRequiredSnippets(rootDir: string, checks: RequiredCheck[]): string[] {
  const issues: string[] = [];

  for (const check of checks) {
    const fullPath = path.join(rootDir, check.file.replaceAll("/", path.sep));
    if (!fs.existsSync(fullPath)) {
      issues.push(`${check.file}: archivo requerido no existe`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    for (const snippet of check.requiredSnippets) {
      if (!content.includes(snippet)) {
        issues.push(`${check.file}: falta fragmento requerido -> ${snippet}`);
      }
    }
  }

  return issues;
}

export function validateStage17Runbook(input?: { rootDir?: string; requiredChecks?: RequiredCheck[]; silent?: boolean }): void {
  const rootDir = input?.rootDir ?? ROOT;
  const docsStage17Dir = path.join(rootDir, "docs", "etapa-17");
  const requiredChecks = input?.requiredChecks ?? REQUIRED_CHECKS;

  if (!fs.existsSync(docsStage17Dir)) {
    throw new Error("[docs:stage17:runbook] FAIL\n- No existe docs/etapa-17");
  }

  const issues = validateRequiredSnippets(rootDir, requiredChecks);
  if (issues.length > 0) {
    fail(issues);
  }

  if (!input?.silent) {
    process.stdout.write("[docs:stage17:runbook] OK\n");
  }
}
