-- CreateEnum
CREATE TYPE "SiteReportStatus" AS ENUM ('OPEN', 'SUBMITTED');

-- CreateTable
CREATE TABLE "site_reports" (
    "id" TEXT NOT NULL,
    "paymentCycleId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "SiteReportStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_report_lines" (
    "id" TEXT NOT NULL,
    "siteReportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemRef" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "indentLevel" INTEGER NOT NULL DEFAULT 0,
    "contractValue" DECIMAL(14,2) NOT NULL,
    "pctComplete" DECIMAL(8,4),
    "note" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_report_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_reports_paymentCycleId_key" ON "site_reports"("paymentCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "site_reports_token_key" ON "site_reports"("token");

-- AddForeignKey
ALTER TABLE "site_reports" ADD CONSTRAINT "site_reports_paymentCycleId_fkey" FOREIGN KEY ("paymentCycleId") REFERENCES "payment_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_report_lines" ADD CONSTRAINT "site_report_lines_siteReportId_fkey" FOREIGN KEY ("siteReportId") REFERENCES "site_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
