import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

type CommandResult = {
  name: string;
  code: number;
  durationMs: number;
  stdout: string;
  stderr: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function dateToken(): string {
  return nowIso().slice(0, 10);
}

function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  // Remove noisy keys when nested npm executions happen.
  delete env.npm_config_verify_deps_before_run;
  delete env.npm_config__jsr_registry;

  return env;
}

async function runNpmScript(scriptName: string): Promise<CommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(`npm run ${scriptName}`, {
      shell: true,
      env: buildEnv()
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({
        name: scriptName,
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
      });
    });

    child.on("error", (error) => {
      stderr += `${String(error)}\n`;
      resolve({
        name: scriptName,
        code: 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
      });
    });
  });
}

function trimOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n... [truncated]`;
}

function renderResultSection(result: CommandResult): string {
  const status = result.code === 0 ? "OK" : "FAIL";
  const header = `## ${result.name} - ${status}`;
  const details = [
    `- exit_code: ${result.code}`,
    `- duration_ms: ${result.durationMs}`,
    "",
    "### stdout",
    "```text",
    trimOutput(result.stdout.trim(), 6000),
    "```",
    "",
    "### stderr",
    "```text",
    trimOutput(result.stderr.trim(), 4000),
    "```"
  ].join("\n");

  return `${header}\n\n${details}`;
}

async function writeBaselineRecord(results: CommandResult[]): Promise<string> {
  const outputDir = path.join(process.cwd(), "docs", "etapa-17", "evidencias");
  await fs.mkdir(outputDir, { recursive: true });

  const outputFile = path.join(outputDir, `baseline-stage17-${dateToken()}.md`);
  const allOk = results.every((item) => item.code === 0);

  const content = [
    "# Registro baseline Stage 17",
    "",
    `- generated_at: ${nowIso()}`,
    `- status: ${allOk ? "OK" : "FAIL"}`,
    "- commands:",
    "  - npm run lab:e17:gate",
    "  - npm run docs:stage17:evidence:json",
    "",
    ...results.map((result) => renderResultSection(result)),
    ""
  ].join("\n");

  await fs.writeFile(outputFile, content, "utf8");
  return outputFile;
}

async function main(): Promise<void> {
  const results: CommandResult[] = [];

  const gateResult = await runNpmScript("lab:e17:gate");
  results.push(gateResult);

  const evidenceResult = await runNpmScript("docs:stage17:evidence:json");
  results.push(evidenceResult);

  const outputFile = await writeBaselineRecord(results);
  const allOk = results.every((item) => item.code === 0);

  process.stdout.write(`[ops:stage17:baseline:record] ${allOk ? "OK" : "FAIL"}\n`);
  process.stdout.write(`record_file=${outputFile}\n`);

  if (!allOk) {
    process.exitCode = 1;
  }
}

void main();
