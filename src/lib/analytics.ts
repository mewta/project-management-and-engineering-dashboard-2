import { IssuePriority, IssueStatus } from "@prisma/client";

export const issueStatusValues: IssueStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const issuePriorityValues: IssuePriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

type CountGroup<TKey extends string> = {
  _count: { _all: number };
} & Record<TKey, string | null>;

type AssigneeSummary = {
  id: string;
  name: string;
  email: string;
};

export function buildProjectAnalytics({
  totalIssues,
  completedIssues,
  overdueIssues,
  byStatus,
  byPriority,
  workload,
  assignees,
}: {
  totalIssues: number;
  completedIssues: number;
  overdueIssues: number;
  byStatus: CountGroup<"status">[];
  byPriority: CountGroup<"priority">[];
  workload: CountGroup<"assigneeId">[];
  assignees: AssigneeSummary[];
}) {
  const assigneeById = new Map(assignees.map((assignee) => [assignee.id, assignee]));
  const statusCountByKey = new Map(
    byStatus.map((item) => [item.status, item._count._all]),
  );
  const priorityCountByKey = new Map(
    byPriority.map((item) => [item.priority, item._count._all]),
  );

  return {
    totalIssues,
    completedIssues,
    overdueIssues,
    issuesByStatus: issueStatusValues.map((status) => ({
      status,
      count: statusCountByKey.get(status) ?? 0,
    })),
    issuesByPriority: issuePriorityValues.map((priority) => ({
      priority,
      count: priorityCountByKey.get(priority) ?? 0,
    })),
    memberWorkload: workload.map((item) => {
      const assignee = item.assigneeId ? assigneeById.get(item.assigneeId) : null;

      return {
        assigneeId: item.assigneeId,
        name: assignee?.name ?? "Unassigned",
        email: assignee?.email ?? null,
        count: item._count._all,
      };
    }),
  };
}
