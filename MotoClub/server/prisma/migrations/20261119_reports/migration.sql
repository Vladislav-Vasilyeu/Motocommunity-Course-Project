CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'POST', 'LISTING', 'COMMUNITY');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');
CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetTitle" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "action" TEXT,
  "note" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_reporterId_createdAt_id_idx" ON "Report"("reporterId", "createdAt", "id");
CREATE INDEX "Report_status_createdAt_id_idx" ON "Report"("status", "createdAt", "id");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE UNIQUE INDEX "Report_pending_unique" ON "Report"("reporterId", "targetType", "targetId") WHERE "status" = 'PENDING';
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
