import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function fail(messages: string[]): never {
  throw new Error(`[docs:stage17:evidence] FAIL\n${messages.map((msg) => `- ${msg}`).join("\n")}`);
}

function hasAnyMatch(dirPath: string, matcher: RegExp): boolean {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.some((entry) => entry.isFile() && matcher.test(entry.name));
}

export function validateStage17PilotEvidence(input?: { rootDir?: string; silent?: boolean }): void {
  const rootDir = input?.rootDir ?? ROOT;
  const stage17Dir = path.join(rootDir, "docs", "etapa-17");
  const evidenceDir = path.join(stage17Dir, "evidencias");

  const issues: string[] = [];

  if (!fs.existsSync(stage17Dir)) {
    fail(["No existe docs/etapa-17"]);
  }

  if (!fs.existsSync(evidenceDir)) {
    issues.push("No existe docs/etapa-17/evidencias");
  } else if (!hasAnyMatch(evidenceDir, /^piloto-e2e-controlado-\d{4}-\d{2}-\d{2}\.json$/)) {
    issues.push("No existe evidencia JSON de corrida piloto controlada (piloto-e2e-controlado-YYYY-MM-DD.json)");
  }

  if (!hasAnyMatch(stage17Dir, /^bitacora-corrida-piloto-e2e-\d{4}-\d{2}-\d{2}\.md$/)) {
    issues.push("No existe bitacora real de corrida piloto (bitacora-corrida-piloto-e2e-YYYY-MM-DD.md)");
  }

  if (issues.length > 0) {
    fail(issues);
  }

  if (!input?.silent) {
    process.stdout.write("[docs:stage17:evidence] OK\n");
  }
}
