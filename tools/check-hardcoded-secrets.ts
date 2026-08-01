import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOT = process.cwd();

const SCAN_FOLDERS = ["apps", "packages", "tools", ".github"];
const SCAN_FILES = ["package.json", "redocly.yaml"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".js", ".json", ".yaml", ".yml", ".md"]);

const SECRET_RULES = [
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub token", regex: /ghp_[A-Za-z0-9]{36}/g },
  { name: "Generic API key assignment", regex: /(api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{12,}["']/gi },
  { name: "Hardcoded password", regex: /password\s*[:=]\s*["'][^"']{8,}["']/gi }
];

const ALLOWLIST = ["example", "localhost", "web_analysis", "postgres://user:pass@localhost"];

function collectFiles(dir: string): string[] {
  const found: string[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const full = join(dir, item);
    const relativePath = relative(ROOT, full);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      if (item === "node_modules" || item === "dist" || item === ".git") {
        continue;
      }

      found.push(...collectFiles(full));
      continue;
    }

    const extension = relativePath.slice(relativePath.lastIndexOf("."));
    if (ALLOWED_EXTENSIONS.has(extension)) {
      found.push(relativePath);
    }
  }

  return found;
}

function scanFile(path: string): string[] {
  const fullPath = join(ROOT, path);
  const content = readFileSync(fullPath, "utf8");
  const findings: string[] = [];

  for (const rule of SECRET_RULES) {
    const matches = content.match(rule.regex);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      const lower = match.toLowerCase();
      const allowed = ALLOWLIST.some((entry) => lower.includes(entry));
      if (!allowed) {
        findings.push(`${rule.name}: ${match}`);
      }
    }
  }

  return findings;
}

function main(): void {
  const violations: Array<{ file: string; finding: string }> = [];
  const files = [...SCAN_FILES];

  for (const folder of SCAN_FOLDERS) {
    files.push(...collectFiles(join(ROOT, folder)));
  }

  const uniqueFiles = [...new Set(files)];

  for (const file of uniqueFiles) {
    const findings = scanFile(file);
    for (const finding of findings) {
      violations.push({ file, finding });
    }
  }

  if (violations.length > 0) {
    const lines = violations.map((entry) => `- ${relative(ROOT, join(ROOT, entry.file))}: ${entry.finding}`);
    throw new Error(`[secret:check] Potential hardcoded secrets found:\n${lines.join("\n")}`);
  }

  process.stdout.write("[secret:check] OK\n");
}

main();
