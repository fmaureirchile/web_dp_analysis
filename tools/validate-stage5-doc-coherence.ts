import fs from "node:fs";
import path from "node:path";

type RequiredCheck = {
  file: string;
  requiredSnippets: string[];
};

const ROOT = process.cwd();
const DOCS_STAGE5_DIR = path.join(ROOT, "docs", "etapa-5");
const CI_WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "ci.yml");

const FORBIDDEN_DOC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /23\/23/g, label: "conteo antiguo 23/23" },
  { pattern: /3\/3/g, label: "conteo antiguo 3/3" },
  { pattern: /23 tests/g, label: "texto antiguo 23 tests" },
  { pattern: /3 tests/g, label: "texto antiguo 3 tests" }
];

const REQUIRED_CHECKS: RequiredCheck[] = [
  {
    file: ".github/workflows/ci.yml",
    requiredSnippets: [
      "E5.2 gate integration coverage: 9 files / 26 tests expected",
      "E5.3 gate coverage: Stage 5.2 gate (9 files / 26 tests) + observability regression (1 file / 4 tests)",
      "E5.3 gate result: stage5_gate_files=9/9; stage5_gate_tests=26/26; obs_regression_files=1/1; obs_regression_tests=4/4"
    ]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-2.md",
    requiredSnippets: ["integration_tests_passed=26/26"]
  },
  {
    file: "docs/etapa-5/guia-gate-cierre-e5-3.md",
    requiredSnippets: ["stage5_gate_tests=26/26", "obs_regression_tests=4/4"]
  },
  {
    file: "docs/etapa-5/checklist-entrega-pr-e5-3.md",
    requiredSnippets: ["stage5_gate_tests=26/26", "obs_regression_tests=4/4"]
  },
  {
    file: "docs/etapa-5/acta-cierre-etapa-5-3.md",
    requiredSnippets: ["stage5_gate_tests=26/26", "obs_regression_tests=4/4"]
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

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function validateForbiddenPatterns(docFiles: string[]): string[] {
  const issues: string[] = [];

  for (const filePath of docFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativeFile = path.relative(ROOT, filePath).replaceAll("\\", "/");

    for (const rule of FORBIDDEN_DOC_PATTERNS) {
      const hits = countMatches(content, rule.pattern);
      if (hits > 0) {
        issues.push(`${relativeFile}: encontrado ${rule.label} (${hits} coincidencia/s)`);
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

function validateCiFileHasNoLegacyMetrics(): string[] {
  const issues: string[] = [];
  const content = fs.readFileSync(CI_WORKFLOW_PATH, "utf8");
  const legacyPatterns = [/23\/23/g, /3\/3/g, /23 tests/g, /3 tests/g];

  for (const pattern of legacyPatterns) {
    const hits = countMatches(content, pattern);
    if (hits > 0) {
      issues.push(`.github/workflows/ci.yml: contiene metrica legacy (${pattern.source}) en ${hits} coincidencia/s`);
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
  const issues = [
    ...validateForbiddenPatterns(docFiles),
    ...validateRequiredSnippets(),
    ...validateCiFileHasNoLegacyMetrics()
  ];

  if (issues.length > 0) {
    fail(issues);
  }

  process.stdout.write("[docs:stage5:coherence] OK\n");
}

main();
