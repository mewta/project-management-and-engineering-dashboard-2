ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ISSUE_DEPENDENCY_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'ISSUE_DEPENDENCY_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'WEEKLY_REPORT_GENERATED';

ALTER TABLE "Issue"
ADD COLUMN "estimatedHours" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "IssueDependency" (
    "id" TEXT NOT NULL,
    "blockedIssueId" TEXT NOT NULL,
    "blockingIssueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueDependency_blockedIssueId_blockingIssueId_key"
ON "IssueDependency"("blockedIssueId", "blockingIssueId");

CREATE INDEX "IssueDependency_blockedIssueId_idx"
ON "IssueDependency"("blockedIssueId");

CREATE INDEX "IssueDependency_blockingIssueId_idx"
ON "IssueDependency"("blockingIssueId");

CREATE INDEX "WeeklyReport_projectId_idx"
ON "WeeklyReport"("projectId");

CREATE INDEX "WeeklyReport_organizationId_idx"
ON "WeeklyReport"("organizationId");

CREATE UNIQUE INDEX "WeeklyReport_projectId_weekStart_weekEnd_key"
ON "WeeklyReport"("projectId", "weekStart", "weekEnd");

ALTER TABLE "IssueDependency"
ADD CONSTRAINT "IssueDependency_blockedIssueId_fkey"
FOREIGN KEY ("blockedIssueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueDependency"
ADD CONSTRAINT "IssueDependency_blockingIssueId_fkey"
FOREIGN KEY ("blockingIssueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyReport"
ADD CONSTRAINT "WeeklyReport_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeeklyReport"
ADD CONSTRAINT "WeeklyReport_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
