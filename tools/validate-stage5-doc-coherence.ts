import fs from "node:fs";
import path from "node:path";

type RequiredCheck = {
  file: string;
  requiredSnippets: string[];
};

type ForbiddenCheck = {
  file: string;
  forbiddenSnippets: string[];
};

const ROOT = process.cwd();
const DOCS_STAGE5_DIR = path.join(ROOT, "docs", "etapa-5");
const CI_WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "ci.yml");

const REQUIRED_CHECKS: RequiredCheck[] = [
  {
    file: ".github/workflows/ci.yml",
    requiredSnippets: [
      "E5.2 gate integration coverage: 10 files / 23 tests expected",
      "tests/integration/stage5-e2e-lab-failure-matrix.integration.test.ts",
      "E5.3 gate coverage: Stage 5.2 gate (10 files / 23 tests) + observability regression (1 file / 3 tests)",
      "E5.3 gate result: stage5_gate_files=10/10; stage5_gate_tests=23/23; obs_regression_files=1/1; obs_regression_tests=3/3",
      "E5.3 gate timing trend: status=",
      "previous_duration_seconds=",
      "delta_seconds=",
      "name: stage5-gate-timing-history",
      "E5.4 gate result: stage5_gate_files=10/10; stage5_gate_tests=23/23; obs_regression_files=1/1; obs_regression_tests=3/3; docs_stage5_coherence=ok"
    ]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-4.md",
    requiredSnippets: ["stage5_gate_tests=23/23", "obs_regression_tests=3/3", "10/10 archivos y 23/23 tests"]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-5.md",
    requiredSnippets: ["stage5_gate_tests=23/23", "obs_regression_tests=3/3"]
  },
  {
    file: "docs/etapa-5/checklist-entrega-pr-e5-5.md",
    requiredSnippets: ["stage5_gate_tests=23/23", "obs_regression_tests=3/3"]
  },
  {
    file: "docs/etapa-5/acta-cierre-etapa-5-5.md",
    requiredSnippets: ["E5-5-T01: completada.", "E5-5-T04: completada."]
  },
  {
    file: "docs/etapa-5/revision-coherencia-etapa-5-5.md",
    requiredSnippets: ["No se detectan desalineaciones bloqueantes para cierre E5.5."]
  },
  {
    file: "docs/etapa-5/nota-release-e5-5.md",
    requiredSnippets: ["E5.5 consolida continuidad operativa de Stage 5"]
  }
];

const FORBIDDEN_CHECKS: ForbiddenCheck[] = [
  {
    file: ".github/workflows/ci.yml",
    forbiddenSnippets: [
      "E5.2 gate integration coverage: 9 files / 26 tests expected",
      "E5.3 gate coverage: Stage 5.2 gate (9 files / 26 tests) + observability regression (1 file / 4 tests)",
      "E5.3 gate result: stage5_gate_files=9/9; stage5_gate_tests=26/26; obs_regression_files=1/1; obs_regression_tests=4/4",
      "E5.4 gate result: stage5_gate_files=9/9; stage5_gate_tests=26/26; obs_regression_files=1/1; obs_regression_tests=4/4; docs_stage5_coherence=ok"
    ]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-4.md",
    forbiddenSnippets: ["stage5_gate_tests=29/29", "obs_regression_tests=4/4"]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-5.md",
    forbiddenSnippets: ["stage5_gate_tests=29/29", "obs_regression_tests=4/4"]
  },
  {
    file: "docs/etapa-5/checklist-entrega-pr-e5-5.md",
    forbiddenSnippets: ["stage5_gate_tests=29/29", "obs_regression_tests=4/4"]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-5.md",
    forbiddenSnippets: ["last_stage5_3_gate_duration_seconds=15."]
  }
];

function fail(messages: string[]): never {
  throw new Error(`[docs:stage5:coherence] FAIL\n${messages.map((msg) => `- ${msg}`).join("\n")}`);
}

function getMarkdownFilesRecursively(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...getMarkdownFilesRecursively(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

function validateForbiddenSnippets(): string[] {
  const issues: string[] = [];

  for (const check of FORBIDDEN_CHECKS) {
    const fullPath = path.join(ROOT, check.file.replaceAll("/", path.sep));
    if (!fs.existsSync(fullPath)) {
      issues.push(`${check.file}: archivo requerido no existe`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    for (const snippet of check.forbiddenSnippets) {
      if (content.includes(snippet)) {
        issues.push(`${check.file}: contiene fragmento obsoleto -> ${snippet}`);
      }
    }
  }

  return issues;
}

function validateRequiredSnippets(): string[] {
  const issues: string[] = [];

  for (const check of REQUIRED_CHECKS) {
    const fullPath = path.join(ROOT, check.file.replaceAll("/", path.sep));
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

function main(): void {
  if (!fs.existsSync(DOCS_STAGE5_DIR)) {
    throw new Error("[docs:stage5:coherence] FAIL\n- No existe docs/etapa-5");
  }

  if (!fs.existsSync(CI_WORKFLOW_PATH)) {
    throw new Error("[docs:stage5:coherence] FAIL\n- No existe .github/workflows/ci.yml");
  }

  const docFiles = getMarkdownFilesRecursively(DOCS_STAGE5_DIR);
  if (docFiles.length === 0) {
    throw new Error("[docs:stage5:coherence] FAIL\n- No se detectaron archivos markdown en docs/etapa-5");
  }

  const issues = [
    ...validateRequiredSnippets(),
    ...validateForbiddenSnippets()
  ];

  if (issues.length > 0) {
    fail(issues);
  }

  process.stdout.write("[docs:stage5:coherence] OK\n");
}

main();
