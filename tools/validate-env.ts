const REQUIRED_KEYS = ["NODE_ENV", "APP_PORT", "DATABASE_URL", "REDIS_URL"] as const;

const ALLOWED_NODE_ENVS = new Set(["development", "test", "production"]);

function fail(message: string): never {
  throw new Error(`[env:validate] ${message}`);
}

function validateRequiredKeys(): void {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    fail(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function validateNodeEnv(): void {
  const value = (process.env.NODE_ENV as string).toLowerCase();
  if (!ALLOWED_NODE_ENVS.has(value)) {
    fail("NODE_ENV must be development, test or production");
  }
}

function validateAppPort(): void {
  const value = Number(process.env.APP_PORT);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    fail("APP_PORT must be an integer between 1 and 65535");
  }
}

function validateUrlLike(name: "DATABASE_URL" | "REDIS_URL"): void {
  const raw = process.env[name] as string;
  try {
    const parsed = new URL(raw);
    if (!parsed.protocol) {
      fail(`${name} must include a protocol`);
    }
  } catch {
    fail(`${name} must be a valid URL`);
  }
}

function main(): void {
  validateRequiredKeys();
  validateNodeEnv();
  validateAppPort();
  validateUrlLike("DATABASE_URL");
  validateUrlLike("REDIS_URL");

  process.stdout.write("[env:validate] OK\n");
}

main();
