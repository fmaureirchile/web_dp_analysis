-- AlterTable
ALTER TABLE "Authorization"
ADD COLUMN "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "allowSubdomains" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "excludedPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "permittedOperations" TEXT[] NOT NULL DEFAULT ARRAY['SCAN_PASSIVE']::TEXT[],
ADD COLUMN "prohibitedActions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "maxConcurrentExecutions" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "maxDepth" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "maxDurationSeconds" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN "agentId" TEXT NOT NULL DEFAULT 'stage3-agent',
ADD COLUMN "emergencyContact" TEXT NOT NULL DEFAULT 'security@example.local',
ADD COLUMN "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "killSwitchActivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Execution"
ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'SCAN_PASSIVE',
ADD COLUMN "entryUrl" TEXT,
ADD COLUMN "redirectUrl" TEXT;

-- CreateTable
CREATE TABLE "ScopeAuditRequest" (
    "id" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeAuditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScopeAuditRequest_authorizationId_idx" ON "ScopeAuditRequest"("authorizationId");

-- CreateIndex
CREATE INDEX "ScopeAuditRequest_timestamp_idx" ON "ScopeAuditRequest"("timestamp");

-- AddForeignKey
ALTER TABLE "ScopeAuditRequest" ADD CONSTRAINT "ScopeAuditRequest_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "Authorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
