type RuntimeEnv = {
  nodeEnv: string;
  appPort: number;
  databaseUrl: string;
  redisUrl: string;
};

const REQUIRED_KEYS = ["NODE_ENV", "APP_PORT", "DATABASE_URL", "REDIS_URL"] as const;

function assertRequiredEnv(): void {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function parsePort(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("APP_PORT must be an integer between 1 and 65535");
  }

  return parsed;
}

export function getRuntimeEnv(): RuntimeEnv {
  assertRequiredEnv();

  const appPort = parsePort(process.env.APP_PORT as string);
  const nodeEnv = (process.env.NODE_ENV as string).toLowerCase();
  const allowedNodeEnvs = new Set(["development", "test", "production"]);

  if (!allowedNodeEnvs.has(nodeEnv)) {
    throw new Error("NODE_ENV must be one of: development, test, production");
  }

  return {
    nodeEnv,
    appPort,
    databaseUrl: process.env.DATABASE_URL as string,
    redisUrl: process.env.REDIS_URL as string
  };
}
