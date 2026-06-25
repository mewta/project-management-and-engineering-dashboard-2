import { MembershipRole } from "@prisma/client";

export type WorkloadMemberAnalytics = {
  userId: string;
  name: string;
  role: MembershipRole;
  openIssues: number;
  completedIssues: number;
  overdueIssues: number;
  highPriorityIssues: number;
  urgentIssues: number;
  blockedIssues: number;
  totalEstimatedHours: number;
  workloadScore: number;
  status: "UNDERLOADED" | "BALANCED" | "OVERLOADED";
};

export function getWorkloadStatus(score: number) {
  if (score <= 3) {
    return "UNDERLOADED" as const;
  }

  if (score <= 8) {
    return "BALANCED" as const;
  }

  return "OVERLOADED" as const;
}

export function buildWorkloadScore({
  openIssues,
  highPriorityIssues,
  urgentIssues,
  overdueIssues,
  blockedIssues,
  totalEstimatedHours,
}: {
  openIssues: number;
  highPriorityIssues: number;
  urgentIssues: number;
  overdueIssues: number;
  blockedIssues: number;
  totalEstimatedHours: number;
}) {
  return (
    openIssues +
    highPriorityIssues * 2 +
    urgentIssues * 3 +
    overdueIssues * 2 +
    blockedIssues +
    Math.ceil(totalEstimatedHours / 8)
  );
}
