-- AlterTable
ALTER TABLE "assessment_lines" ADD COLUMN     "claimedValueToDate" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "application_lines" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemRef" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contractValue" DECIMAL(14,2) NOT NULL,
    "isVariation" BOOLEAN NOT NULL DEFAULT false,
    "indentLevel" INTEGER NOT NULL DEFAULT 0,
    "variationId" TEXT,
    "qtyOrPctClaimed" DECIMAL(8,4),
    "valueToDateClaimed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_lines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "application_lines" ADD CONSTRAINT "application_lines_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
