import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBlockedIssueIds } from "@/lib/dependencies";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";
import {
  buildWorkloadScore,
  getWorkloadStatus,
  type WorkloadMemberAnalytics,
} from "@/lib/workload";
import { workloadFilterSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const filters = workloadFilterSchema.parse({
      view: searchParams.get("view") ?? undefined,
      sprint: searchParams.get("sprint") ?? undefined,
    });

    const project = await requireProjectAccess(userId, id);
    const now = new Date();

    const memberships = await prisma.membership.findMany({
      where: { organizationId: project.organizationId },
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

    const memberIds = memberships.map((membership) => membership.userId);
    const issues = await prisma.issue.findMany({
      where: {
        projectId: id,
        assigneeId: { in: memberIds },
        ...(filters.view === "OPEN" ? { status: { not: "DONE" } } : {}),
        ...(filters.view === "OVERDUE"
          ? {
              dueDate: { lt: now },
              status: { not: "DONE" },
            }
          : {}),
      },
      select: {
        id: true,
        assigneeId: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
      },
    });

    const issueIds = issues.map((issue) => issue.id);
    const blockedIssueIds = await getBlockedIssueIds(prisma, id, issueIds);

    const members: WorkloadMemberAnalytics[] = memberships.map((membership) => {
      const assignedIssues = issues.filter((issue) => issue.assigneeId === membership.userId);
      const openIssues = assignedIssues.filter((issue) => issue.status !== "DONE");
      const completedIssues = assignedIssues.filter((issue) => issue.status === "DONE").length;
      const overdueIssues = openIssues.filter(
        (issue) => issue.dueDate && issue.dueDate < now,
      ).length;
      const highPriorityIssues = openIssues.filter(
        (issue) => issue.priority === "HIGH",
      ).length;
      const urgentIssues = openIssues.filter(
        (issue) => issue.priority === "URGENT",
      ).length;
      const blockedIssues = openIssues.filter((issue) => blockedIssueIds.has(issue.id)).length;
      const totalEstimatedHours = openIssues.reduce(
        (total, issue) => total + issue.estimatedHours,
        0,
      );
      const workloadScore = buildWorkloadScore({
        openIssues: openIssues.length,
        highPriorityIssues,
        urgentIssues,
        overdueIssues,
        blockedIssues,
        totalEstimatedHours,
      });

      return {
        userId: membership.user.id,
        name: membership.user.name,
        role: membership.role,
        openIssues: openIssues.length,
        completedIssues,
        overdueIssues,
        highPriorityIssues,
        urgentIssues,
        blockedIssues,
        totalEstimatedHours,
        workloadScore,
        status: getWorkloadStatus(workloadScore),
      };
    });

    const summary = {
      totalOpenIssues: members.reduce((total, member) => total + member.openIssues, 0),
      totalCompletedIssues: members.reduce(
        (total, member) => total + member.completedIssues,
        0,
      ),
      totalOverdueIssues: members.reduce((total, member) => total + member.overdueIssues, 0),
      totalBlockedIssues: members.reduce((total, member) => total + member.blockedIssues, 0),
      overloadedMembers: members.filter((member) => member.status === "OVERLOADED").length,
    };

    return NextResponse.json({
      projectId: id,
      generatedAt: new Date().toISOString(),
      members,
      summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
