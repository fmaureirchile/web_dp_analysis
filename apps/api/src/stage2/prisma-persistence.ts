import { PrismaClient } from "@prisma/client";
import { ExecutionState } from "../../../../packages/domain/src";

const prisma = new PrismaClient() as any;
const terminalStates: ExecutionState[] = [
  ExecutionState.COMPLETED,
  ExecutionState.COMPLETED_WITH_WARNINGS,
  ExecutionState.FAILED,
  ExecutionState.CANCELLED
];

function isEnabled(): boolean {
  return String(process.env.USE_PRISMA_PERSISTENCE).toLowerCase() === "true";
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
        notIn: terminalStates
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
