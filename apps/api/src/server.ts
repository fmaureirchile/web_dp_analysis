import express from "express";
import { getRuntimeEnv } from "./env";
import { createStage2Router } from "./stage2/routes";

const app = express();
const startedAt = new Date().toISOString();

app.use(express.json());
app.use("/api/v1", createStage2Router());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "web-analysis-api",
    version: "0.1.0",
    startedAt,
    timestamp: new Date().toISOString()
  });
});

export { app };

if (require.main === module) {
  const env = getRuntimeEnv();

  app.listen(env.appPort, () => {
    console.log(`API listening on port ${env.appPort}`);
  });
}
