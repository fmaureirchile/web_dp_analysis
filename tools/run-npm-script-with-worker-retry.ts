import { spawn } from "node:child_process";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isTransientFailure(output: string, code: number): boolean {
  if (output.includes("Worker exited unexpectedly")) {
    return true;
  }

  if (output.includes("exit code 134") || output.includes("exit code 3221226505")) {
    return true;
  }

  // Windows native process abort codes can surface as npm lifecycle failures.
  return code === 134 || code === 3221226505;
}

async function runNpmScript(scriptName: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", scriptName], {
      shell: true,
      env: process.env
    });

    let combined = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      combined += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, output: combined });
    });

    child.on("error", (error) => {
      const text = String(error);
      combined += text;
      process.stderr.write(`${text}\n`);
      resolve({ code: 1, output: combined });
    });
  });
}

async function main(): Promise<void> {
  const scriptName = process.argv[2];
  if (!scriptName) {
    process.stderr.write("Usage: tsx tools/run-npm-script-with-worker-retry.ts <npm-script> [maxAttempts]\n");
    process.exit(1);
    return;
  }

  const maxAttempts = parsePositiveInt(process.argv[3], 2);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runNpmScript(scriptName);

    if (result.code === 0) {
      process.exit(0);
      return;
    }

    if (isTransientFailure(result.output, result.code) && attempt < maxAttempts) {
      process.stdout.write(
        `Se detecto error intermitente de ejecucion. Reintentando ${scriptName} (intento ${attempt + 1}/${maxAttempts})...\n`
      );
      continue;
    }

    process.exit(result.code);
    return;
  }
}

void main();
