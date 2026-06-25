import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildStatusChangeMetadata } from "@/lib/activity";
import { getIssueDependencySummary } from "@/lib/dependencies";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ApiError,
  handleApiError,
  hasMinimumRole,
  requireIssueAccess,
  requireOrganizationMembership,
  requireUserId,
} from "@/lib/api";
import { canTransitionIssueStatus } from "@/lib/issues";
import { updateIssueStatusSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const payload = updateIssueStatusSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);
    const membership = await requireOrganizationMembership(
      userId,
      issue.project.organizationId,
    );

    const canMoveIssue =
      hasMinimumRole(membership.role, "DEVELOPER") ||
      issue.reporterId === userId ||
      issue.assigneeId === userId;

    if (!canMoveIssue) {
      throw new ApiError(403, "Only developers, admins, the reporter, or the assignee can move this issue");
    }

    if (!canTransitionIssueStatus(issue.status, payload.status)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${issue.status} to ${payload.status}`,
      );
    }

    if (payload.status === "DONE") {
      const dependencySummary = await getIssueDependencySummary(prisma, issue.id);
      if (dependencySummary.isBlocked) {
        throw new ApiError(
          400,
          "This issue is blocked by unresolved dependencies and cannot be moved to Done",
        );
      }
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    let activityId: string | null = null;

    const updatedIssue = await prisma.$transaction(async (tx) => {
      const changedIssue = await tx.issue.update({
        where: { id },
        data: { status: payload.status },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (issue.status !== payload.status) {
        const activity = await tx.activityLog.create({
          data: {
            action: "ISSUE_STATUS_CHANGED",
            actorId: userId,
            projectId: issue.projectId,
            issueId: issue.id,
            metadata: buildStatusChangeMetadata({
              issueTitle: issue.title,
              fromStatus: issue.status,
              toStatus: payload.status,
            }),
          },
        });

        activityId = activity.id;
      }

      return changedIssue;
    });

    if (activityId) {
      await emitProjectEvent(issue.projectId, "activity.created", {
        projectId: issue.projectId,
        activityId,
        issueId: issue.id,
      });
    }

    await emitProjectEvent(issue.projectId, "issue.moved", {
      issueId: issue.id,
      projectId: issue.projectId,
      fromStatus: issue.status,
      toStatus: updatedIssue.status,
      updatedBy: {
        id: userId,
        name: actor?.name ?? "Unknown user",
      },
      updatedAt: updatedIssue.updatedAt.toISOString(),
    });

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    return handleApiError(error);
  }
}
