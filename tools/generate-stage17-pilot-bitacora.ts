import path from "node:path";

import { generateStage17PilotBitacora } from "./generate-stage17-pilot-bitacora-lib";

function readEvidenceArg(): string | undefined {
  const rawArg = process.argv[2];
  if (!rawArg || rawArg.trim().length === 0) {
    return undefined;
  }

  const normalized = rawArg.replace("--evidence=", "").trim();
  if (normalized.length === 0 || normalized === rawArg) {
    return rawArg;
  }

  return normalized;
}

const evidenceArg = readEvidenceArg();
const evidencePath = evidenceArg ? path.resolve(process.cwd(), evidenceArg) : undefined;

generateStage17PilotBitacora({ evidencePath }).catch((error) => {
  process.stderr.write(
    `[pilot:e2e:stage17:bitacora] FAIL ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
