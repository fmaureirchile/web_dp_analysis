-- CreateTable
CREATE TABLE "PassiveSinglePageResult" (
    "executionId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "entryUrl" TEXT NOT NULL,
    "statusHttp" INTEGER,
    "title" TEXT,
    "evidenceId" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "contentType" TEXT,
    "contentLength" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassiveSinglePageResult_pkey" PRIMARY KEY ("executionId")
);

-- CreateIndex
CREATE INDEX "PassiveSinglePageResult_updatedAt_idx" ON "PassiveSinglePageResult"("updatedAt");

-- AddForeignKey
ALTER TABLE "PassiveSinglePageResult" ADD CONSTRAINT "PassiveSinglePageResult_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
