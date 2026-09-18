import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv(cwd: string): Record<string, string> {
  const envPath = path.join(cwd, ".env");
  if (!existsSync(envPath)) {
    return {};
  }

  const raw = readFileSync(envPath, "utf-8");
  const parsed: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const sep = trimmed.indexOf("=");
    if (sep <= 0) {
      continue;
    }

    const key = trimmed.slice(0, sep).trim();
    const valueRaw = trimmed.slice(sep + 1).trim();
    const unquoted = valueRaw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    parsed[key] = unquoted;
  }

  return parsed;
}

const repoRoot = process.cwd();
const fileEnv = loadDotEnv(repoRoot);

function mergeEnvPreferNonEmpty(fileValues: Record<string, string>, runtimeValues: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...fileValues };

  for (const [key, runtimeValue] of Object.entries(runtimeValues)) {
    if (typeof runtimeValue !== "string") {
      continue;
    }

    if (runtimeValue.trim().length > 0) {
      merged[key] = runtimeValue;
      continue;
    }

    if (typeof merged[key] !== "string" || merged[key]?.trim().length === 0) {
      merged[key] = runtimeValue;
    }
  }

  return merged;
}

const mergedEnv = mergeEnvPreferNonEmpty(fileEnv, process.env);
const apiPort = String(mergedEnv.API_PORT ?? "3001");
const webPort = String(mergedEnv.WEB_PORT ?? "4182");
const apiBaseUrl = mergedEnv.ANALYSIS_API_BASE_URL ?? `http://localhost:${apiPort}/api/v1`;

const baseEnv = {
  ...mergedEnv,
  NODE_ENV: mergedEnv.NODE_ENV ?? "development",
  DATABASE_URL: mergedEnv.DATABASE_URL ?? "postgres://user:pass@localhost:5432/web_analysis",
  REDIS_URL: mergedEnv.REDIS_URL ?? "redis://localhost:6379",
  USE_PRISMA_PERSISTENCE: mergedEnv.USE_PRISMA_PERSISTENCE ?? "false"
};

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      next[key] = value;
    }
  }
  return next;
}

function run(label: string, command: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, {
    env: sanitizeEnv(env),
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${label}] finalizado por senal ${signal}`);
      return;
    }
    console.log(`[${label}] finalizado con codigo ${code ?? 0}`);
  });

  child.on("error", (error) => {
    console.error(`[${label}] error al iniciar`, error);
  });

  return child;
}

const children: ChildProcess[] = [];
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`\n[stack] apagando procesos por ${signal}...`);

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    process.exit(0);
  }, 300);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`[stack] API_PORT=${apiPort} WEB_PORT=${webPort}`);
console.log(`[stack] ANALYSIS_API_BASE_URL=${apiBaseUrl}`);
console.log(`[stack] USE_PRISMA_PERSISTENCE=${baseEnv.USE_PRISMA_PERSISTENCE}`);
console.log(`[stack] OPENAI_MODEL=${baseEnv.OPENAI_MODEL ?? "gpt-4o-mini"}`);
console.log(`[stack] OPENAI_API_KEY=${baseEnv.OPENAI_API_KEY ? "configured" : "missing"}`);

const apiProc = run("api", "npm run api:start", {
  ...baseEnv,
  APP_PORT: apiPort
});
children.push(apiProc);

const webProc = run("web", "npm run web:analysis:start", {
  ...baseEnv,
  WEB_PORT: webPort,
  ANALYSIS_API_BASE_URL: apiBaseUrl
});
children.push(webProc);
