import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDependencyRemovedMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ApiError,
  handleApiError,
  requireIssueAccess,
  requireProjectRole,
  requireUserId,
} from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string; dependencyId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id: issueId, dependencyId } = await context.params;
    const issue = await requireIssueAccess(userId, issueId);
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    await requireProjectRole(userId, issue.projectId, "DEVELOPER");

    let activityId: string | null = null;

    await prisma.$transaction(async (tx) => {
      const dependency = await tx.issueDependency.findFirst({
        where: {
          id: dependencyId,
          blockedIssueId: issueId,
        },
        include: {
          blockingIssue: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!dependency) {
        throw new ApiError(404, "Dependency not found");
      }

      await tx.issueDependency.delete({
        where: { id: dependencyId },
      });

      const activity = await tx.activityLog.create({
        data: {
          action: "ISSUE_DEPENDENCY_REMOVED",
          actorId: userId,
          projectId: issue.projectId,
          issueId,
          metadata: buildDependencyRemovedMetadata({
            issueTitle: issue.title,
            blockingIssueId: dependency.blockingIssue.id,
            blockingIssueTitle: dependency.blockingIssue.title,
          }),
        },
      });
      activityId = activity.id;
    });

    await emitProjectEvent(issue.projectId, "dependency.removed", {
      projectId: issue.projectId,
      issueId,
      dependencyId,
      updatedBy: {
        id: actor?.id ?? userId,
        name: actor?.name ?? "Unknown user",
      },
    });

    if (activityId) {
      await emitProjectEvent(issue.projectId, "activity.created", {
        projectId: issue.projectId,
        activityId,
        issueId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
