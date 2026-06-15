import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      hasMinimumRole(membership.role, "ADMIN") ||
      issue.reporterId === userId ||
      issue.assigneeId === userId;

    if (!canMoveIssue) {
      throw new ApiError(403, "Only admins, the reporter, or the assignee can move this issue");
    }

    if (!canTransitionIssueStatus(issue.status, payload.status)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${issue.status} to ${payload.status}`,
      );
    }

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
        await tx.activityLog.create({
          data: {
            action: "ISSUE_STATUS_CHANGED",
            actorId: userId,
            projectId: issue.projectId,
            issueId: issue.id,
            metadata: {
              issueTitle: issue.title,
              fromStatus: issue.status,
              toStatus: payload.status,
            },
          },
        });
      }

      return changedIssue;
    });

    await emitProjectEvent(issue.projectId, "issue:updated", {
      issueId: issue.id,
      projectId: issue.projectId,
      status: updatedIssue.status,
    });

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    return handleApiError(error);
  }
}
