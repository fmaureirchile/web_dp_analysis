import {
  type PassiveSinglePageCrawlErrorDto,
  type StartPassiveSinglePageCrawlDto
} from "../../../packages/contracts/src";

export interface PassiveScopeSimulationInput {
  authorizationId: string;
  entryUrl: string;
  operation: string;
  correlationId: string;
}

export interface PassiveScopeGateDependencies {
  runScopeSimulation: (input: PassiveScopeSimulationInput) => Promise<{ allowed: boolean; reasons: string[] }>;
}

export type PassiveScopeGateResult =
  | { allowed: true }
  | {
      allowed: false;
      error: PassiveSinglePageCrawlErrorDto;
    };

export interface EvaluatePassiveScopeInput {
  request: StartPassiveSinglePageCrawlDto;
  authorizationId: string;
  operation: string;
  correlationId: string;
}

function formatScopeRejectionMessage(reasons: string[]): string {
  if (reasons.length === 0) {
    return "entryUrl rejected by authorization scope";
  }

  return `entryUrl rejected by authorization scope: ${reasons.join(",")}`;
}

export async function evaluatePassiveSinglePageScope(
  input: EvaluatePassiveScopeInput,
  deps: PassiveScopeGateDependencies
): Promise<PassiveScopeGateResult> {
  const simulation = await deps.runScopeSimulation({
    authorizationId: input.authorizationId,
    entryUrl: input.request.entryUrl,
    operation: input.operation,
    correlationId: input.correlationId
  });

  if (simulation.allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: {
      executionId: input.request.executionId,
      entryUrl: input.request.entryUrl,
      errorCode: "authorization_scope_rejected",
      message: formatScopeRejectionMessage(simulation.reasons)
    }
  };
}
