import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProjectAnalytics } from "@/lib/analytics";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
          where: {
            projectId: id,
            status: { not: "DONE" },
          },
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

    const analytics = buildProjectAnalytics({
      totalIssues,
      completedIssues,
      overdueIssues,
      byStatus,
      byPriority,
      workload,
      assignees,
    });

    return NextResponse.json({ analytics });
  } catch (error) {
    return handleApiError(error);
  }
}
