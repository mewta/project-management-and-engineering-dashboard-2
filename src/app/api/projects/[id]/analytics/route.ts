import { IssuePriority, IssueStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statusValues: IssueStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const priorityValues: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;

    await requireProjectAccess(userId, id);

    const [totalIssues, completedIssues, overdueIssues, byStatus, byPriority, workload] =
      await Promise.all([
        prisma.issue.count({ where: { projectId: id } }),
        prisma.issue.count({ where: { projectId: id, status: "DONE" } }),
        prisma.issue.count({
          where: {
            projectId: id,
            dueDate: { lt: new Date() },
            status: { not: "DONE" },
          },
        }),
        prisma.issue.groupBy({
          by: ["status"],
          where: { projectId: id },
          _count: { _all: true },
        }),
        prisma.issue.groupBy({
          by: ["priority"],
          where: { projectId: id },
          _count: { _all: true },
        }),
        prisma.issue.groupBy({
          by: ["assigneeId"],
          where: { projectId: id },
          _count: { _all: true },
        }),
      ]);

    const assigneeIds = workload
      .map((item) => item.assigneeId)
      .filter((assigneeId): assigneeId is string => Boolean(assigneeId));

    const assignees = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, email: true },
    });

    const assigneeById = new Map(assignees.map((assignee) => [assignee.id, assignee]));

    const statusCountByKey = new Map(
      byStatus.map((item) => [item.status, item._count._all]),
    );
    const priorityCountByKey = new Map(
      byPriority.map((item) => [item.priority, item._count._all]),
    );

    const analytics = {
      totalIssues,
      completedIssues,
      overdueIssues,
      issuesByStatus: statusValues.map((status) => ({
        status,
        count: statusCountByKey.get(status) ?? 0,
      })),
      issuesByPriority: priorityValues.map((priority) => ({
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

    return NextResponse.json({ analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
