-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('IPLICIT', 'SAGE', 'XERO', 'QUICKBOOKS');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER_RUN', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "legalEntityId" TEXT;

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "cursorState" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_logs_connectionId_startedAt_idx" ON "sync_logs"("connectionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_organisationId_externalId_provider_key" ON "legal_entities"("organisationId", "externalId", "provider");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
