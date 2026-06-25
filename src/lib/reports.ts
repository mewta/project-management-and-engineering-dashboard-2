import type { Prisma, PrismaClient } from "@prisma/client";
import { getBlockedIssueIds } from "@/lib/dependencies";

type DbClient = PrismaClient | Prisma.TransactionClient;

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function getPreviousWeekRange(now = new Date()) {
  const current = startOfDay(now);
  const day = current.getDay();
  const offsetToMonday = (day + 6) % 7;
  const thisWeekMonday = new Date(current);
  thisWeekMonday.setDate(current.getDate() - offsetToMonday);

  const weekStart = new Date(thisWeekMonday);
  weekStart.setDate(thisWeekMonday.getDate() - 7);

  const weekEnd = new Date(thisWeekMonday);
  weekEnd.setDate(thisWeekMonday.getDate() - 1);

  return {
    weekStart: startOfDay(weekStart),
    weekEnd: endOfDay(weekEnd),
  };
}

export async function buildWeeklyReportSummary(
  db: DbClient,
  projectId: string,
  organizationId: string,
  weekStart: Date,
  weekEnd: Date,
) {
  const issueWhere = {
    projectId,
    createdAt: {
      gte: weekStart,
      lte: weekEnd,
    },
  } as const;

  const [totalIssuesCreated, totalCommentsAdded, completedIssues, reviewMoves, overdueIssues] =
    await Promise.all([
      db.issue.count({ where: issueWhere }),
      db.comment.count({
        where: {
          issue: { projectId },
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      }),
      db.activityLog.findMany({
        where: {
          projectId,
          action: "ISSUE_STATUS_CHANGED",
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        select: {
          actorId: true,
          metadata: true,
        },
      }),
      db.activityLog.count({
        where: {
          projectId,
          action: "ISSUE_STATUS_CHANGED",
          createdAt: { gte: weekStart, lte: weekEnd },
          metadata: {
            path: ["toStatus"],
            equals: "IN_REVIEW",
          },
        },
      }),
      db.issue.count({
        where: {
          projectId,
          dueDate: { lt: weekEnd },
          status: { not: "DONE" },
        },
      }),
    ]);

  const blockedIssueIds = await getBlockedIssueIds(db, projectId);
  const totalBlockedIssues = blockedIssueIds.size;

  const statusBreakdownRows = await db.issue.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });

  const priorityBreakdownRows = await db.issue.groupBy({
    by: ["priority"],
    where: { projectId },
    _count: { _all: true },
  });

  const members = await db.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const memberIds = members.map((member) => member.userId);

  const [memberIssues, memberComments] = await Promise.all([
    db.issue.findMany({
      where: {
        projectId,
        OR: [{ assigneeId: { in: memberIds } }, { reporterId: { in: memberIds } }],
      },
      select: {
        id: true,
        assigneeId: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
      },
    }),
    db.comment.groupBy({
      by: ["authorId"],
      where: {
        issue: { projectId },
        authorId: { in: memberIds },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      _count: { _all: true },
    }),
  ]);

  const completedIssueCounts = new Map<string, number>();
  for (const move of completedIssues) {
    const toStatus = (move.metadata as Record<string, unknown> | null)?.toStatus;
    if (toStatus === "DONE") {
      completedIssueCounts.set(move.actorId, (completedIssueCounts.get(move.actorId) ?? 0) + 1);
    }
  }

  const commentCounts = new Map(
    memberComments.map((item) => [item.authorId, item._count._all]),
  );

  const topContributors = members
    .map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      completedIssues: completedIssueCounts.get(member.user.id) ?? 0,
      commentsAdded: commentCounts.get(member.user.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.completedIssues +
        right.commentsAdded -
        (left.completedIssues + left.commentsAdded),
    )
    .slice(0, 5);

  const workloadSummary = members.map((member) => {
    const issues = memberIssues.filter((issue) => issue.assigneeId === member.user.id);
    return {
      userId: member.user.id,
      name: member.user.name,
      openIssues: issues.filter((issue) => issue.status !== "DONE").length,
      completedIssues: issues.filter((issue) => issue.status === "DONE").length,
      overdueIssues: issues.filter(
        (issue) => issue.status !== "DONE" && issue.dueDate && issue.dueDate < weekEnd,
      ).length,
    };
  });

  const priorityBreakdown = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };

  for (const row of priorityBreakdownRows) {
    if (row.priority === "LOW") priorityBreakdown.low = row._count._all;
    if (row.priority === "MEDIUM") priorityBreakdown.medium = row._count._all;
    if (row.priority === "HIGH") priorityBreakdown.high = row._count._all;
    if (row.priority === "URGENT") priorityBreakdown.urgent = row._count._all;
  }

  const statusBreakdown = {
    todo: 0,
    inProgress: 0,
    review: 0,
    done: 0,
  };

  for (const row of statusBreakdownRows) {
    if (row.status === "TODO") statusBreakdown.todo = row._count._all;
    if (row.status === "IN_PROGRESS") statusBreakdown.inProgress = row._count._all;
    if (row.status === "IN_REVIEW") statusBreakdown.review = row._count._all;
    if (row.status === "DONE") statusBreakdown.done = row._count._all;
  }

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalIssuesCreated,
    totalIssuesCompleted: Array.from(completedIssueCounts.values()).reduce(
      (total, count) => total + count,
      0,
    ),
    totalIssuesMovedToReview: reviewMoves,
    totalCommentsAdded,
    totalOverdueIssues: overdueIssues,
    totalBlockedIssues,
    topContributors,
    priorityBreakdown,
    statusBreakdown,
    workloadSummary,
  };
}
