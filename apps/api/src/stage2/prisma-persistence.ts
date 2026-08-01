import { PrismaClient } from "@prisma/client";
import { ExecutionState } from "../../../../packages/domain/src";

const prisma = new PrismaClient() as any;
const concurrencyTrackedStates: ExecutionState[] = [ExecutionState.QUEUED, ExecutionState.RUNNING];

function isEnabled(): boolean {
  return String(process.env.USE_PRISMA_PERSISTENCE).toLowerCase() === "true";
}

function isMissingTableError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2021";
}

export function isPrismaPersistenceEnabled(): boolean {
  return isEnabled();
}

export async function persistOrganization(entity: { id: string; name: string; correlationId: string; createdAt: string; updatedAt: string }): Promise<void> {
  if (!isEnabled()) return;
  await prisma.organization.create({
    data: {
      id: entity.id,
      name: entity.name,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function persistProject(entity: {
  id: string;
  organizationId: string;
  name: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  if (!isEnabled()) return;
  await prisma.project.create({
    data: {
      id: entity.id,
      organizationId: entity.organizationId,
      name: entity.name,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function persistAuthorization(entity: any): Promise<void> {
  if (!isEnabled()) return;
  await prisma.authorization.create({
    data: {
      id: entity.id,
      projectId: entity.projectId,
      status: entity.status,
      validFrom: entity.validFrom,
      validTo: entity.validTo,
      allowedDomains: entity.allowedDomains,
      allowSubdomains: entity.allowSubdomains,
      excludedPaths: entity.excludedPaths,
      permittedOperations: entity.permittedOperations,
      prohibitedActions: entity.prohibitedActions,
      maxRequestsPerMinute: entity.maxRequestsPerMinute,
      maxConcurrentExecutions: entity.maxConcurrentExecutions,
      maxDepth: entity.maxDepth,
      maxDurationSeconds: entity.maxDurationSeconds,
      agentId: entity.agentId,
      emergencyContact: entity.emergencyContact,
      killSwitchActive: entity.killSwitchActive,
      killSwitchActivatedAt: entity.killSwitchActivatedAt,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function persistTarget(entity: any): Promise<void> {
  if (!isEnabled()) return;
  await prisma.target.create({
    data: {
      id: entity.id,
      projectId: entity.projectId,
      authorizationId: entity.authorizationId,
      baseUrl: entity.baseUrl,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function persistExecution(entity: any): Promise<void> {
  if (!isEnabled()) return;
  await prisma.execution.create({
    data: {
      id: entity.id,
      projectId: entity.projectId,
      authorizationId: entity.authorizationId,
      targetId: entity.targetId,
      state: entity.state,
      operation: entity.operation,
      entryUrl: entity.entryUrl,
      redirectUrl: entity.redirectUrl,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function updateExecutionState(entity: {
  executionId: string;
  state: ExecutionState;
  correlationId: string;
  updatedAt: string;
}): Promise<void> {
  if (!isEnabled()) return;

  await prisma.execution.update({
    where: { id: entity.executionId },
    data: {
      state: entity.state,
      correlationId: entity.correlationId,
      updatedAt: entity.updatedAt
    }
  });
}

export async function persistEvidence(entity: {
  id: string;
  executionId: string;
  level: string;
  kind: string;
  location: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  if (!isEnabled()) return;

  await prisma.evidence.create({
    data: {
      id: entity.id,
      executionId: entity.executionId,
      level: entity.level,
      kind: entity.kind,
      location: entity.location,
      correlationId: entity.correlationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  });
}

export async function getLatestEvidenceByExecutionIdAndKind(
  executionId: string,
  kind: string
): Promise<
  | {
      id: string;
      executionId: string;
      kind: string;
      location: string;
      correlationId: string;
      createdAt: Date;
      updatedAt: Date;
    }
  | undefined
> {
  if (!isEnabled()) return undefined;
  const row = await prisma.evidence.findFirst({
    where: {
      executionId,
      kind
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    executionId: row.executionId,
    kind: row.kind,
    location: row.location,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function getExecutionById(executionId: string): Promise<
  | {
      id: string;
      projectId: string;
      authorizationId: string;
      targetId: string;
      state: ExecutionState;
      operation: string;
      entryUrl?: string;
      redirectUrl?: string;
      correlationId: string;
      createdAt: Date;
      updatedAt: Date;
    }
  | undefined
> {
  if (!isEnabled()) return undefined;
  const row = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!row) return undefined;

  return {
    id: row.id,
    projectId: row.projectId,
    authorizationId: row.authorizationId,
    targetId: row.targetId,
    state: row.state,
    operation: row.operation,
    entryUrl: row.entryUrl ?? undefined,
    redirectUrl: row.redirectUrl ?? undefined,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function listExecutionsByStateAndWindow(input: {
  states: ExecutionState[];
  from?: string;
  to?: string;
  limit: number;
}): Promise<
  Array<{
    id: string;
    state: ExecutionState;
    entryUrl?: string;
    updatedAt: Date;
  }>
> {
  if (!isEnabled()) return [];

  const where: {
    state: { in: ExecutionState[] };
    updatedAt?: { gte?: string; lte?: string };
  } = {
    state: { in: input.states }
  };

  if (input.from || input.to) {
    where.updatedAt = {};
    if (input.from) {
      where.updatedAt.gte = input.from;
    }
    if (input.to) {
      where.updatedAt.lte = input.to;
    }
  }

  const rows = await prisma.execution.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: input.limit
  });

  return rows.map((row: any) => ({
    id: row.id,
    state: row.state,
    entryUrl: row.entryUrl ?? undefined,
    updatedAt: row.updatedAt
  }));
}

export async function persistPassiveSinglePageResult(entity: {
  executionId: string;
  ok: boolean;
  entryUrl: string;
  statusHttp?: number;
  title?: string;
  evidenceId?: string;
  fetchedAt?: string;
  contentType?: string;
  contentLength?: number;
  errorCode?: string;
  errorMessage?: string;
  correlationId: string;
}): Promise<void> {
  if (!isEnabled()) return;

  try {
    await prisma.passiveSinglePageResult.upsert({
      where: { executionId: entity.executionId },
      create: {
        executionId: entity.executionId,
        ok: entity.ok,
        entryUrl: entity.entryUrl,
        statusHttp: entity.statusHttp,
        title: entity.title,
        evidenceId: entity.evidenceId,
        fetchedAt: entity.fetchedAt,
        contentType: entity.contentType,
        contentLength: entity.contentLength,
        errorCode: entity.errorCode,
        errorMessage: entity.errorMessage,
        correlationId: entity.correlationId
      },
      update: {
        ok: entity.ok,
        entryUrl: entity.entryUrl,
        statusHttp: entity.statusHttp,
        title: entity.title,
        evidenceId: entity.evidenceId,
        fetchedAt: entity.fetchedAt,
        contentType: entity.contentType,
        contentLength: entity.contentLength,
        errorCode: entity.errorCode,
        errorMessage: entity.errorMessage,
        correlationId: entity.correlationId
      }
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function getPassiveSinglePageResultByExecutionId(executionId: string): Promise<
  | {
      executionId: string;
      ok: boolean;
      entryUrl: string;
      statusHttp?: number;
      title?: string;
      evidenceId?: string;
      fetchedAt?: Date;
      contentType?: string;
      contentLength?: number;
      errorCode?: string;
      errorMessage?: string;
    }
  | undefined
> {
  if (!isEnabled()) return undefined;
  let row;
  try {
    row = await prisma.passiveSinglePageResult.findUnique({ where: { executionId } });
  } catch (error) {
    if (isMissingTableError(error)) {
      return undefined;
    }
    throw error;
  }
  if (!row) return undefined;

  return {
    executionId: row.executionId,
    ok: row.ok,
    entryUrl: row.entryUrl,
    statusHttp: row.statusHttp ?? undefined,
    title: row.title ?? undefined,
    evidenceId: row.evidenceId ?? undefined,
    fetchedAt: row.fetchedAt ?? undefined,
    contentType: row.contentType ?? undefined,
    contentLength: row.contentLength ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined
  };
}

export async function persistScopeAudit(entry: any): Promise<void> {
  if (!isEnabled()) return;
  await prisma.scopeAuditRequest.create({
    data: {
      id: entry.id,
      authorizationId: entry.authorizationId,
      url: entry.url,
      operation: entry.operation,
      allowed: entry.allowed,
      reason: entry.reason,
      timestamp: entry.timestamp,
      correlationId: entry.correlationId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  });
}

export async function countScopeRequestsLastMinute(authorizationId: string, windowStartIso: string): Promise<number> {
  if (!isEnabled()) return 0;
  return prisma.scopeAuditRequest.count({
    where: {
      authorizationId,
      timestamp: {
        gte: windowStartIso
      }
    }
  });
}

export async function countActiveExecutions(authorizationId: string): Promise<number> {
  if (!isEnabled()) return 0;
  return prisma.execution.count({
    where: {
      authorizationId,
      state: {
        in: concurrencyTrackedStates
      }
    }
  });
}

export async function updateAuthorizationKillSwitch(
  authorizationId: string,
  active: boolean,
  killSwitchActivatedAt: string | undefined,
  correlationId: string
): Promise<void> {
  if (!isEnabled()) return;
  await prisma.authorization.update({
    where: { id: authorizationId },
    data: {
      killSwitchActive: active,
      killSwitchActivatedAt,
      correlationId
    }
  });
}
