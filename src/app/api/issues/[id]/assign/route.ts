import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAssignmentMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ensureUserBelongsToOrganization,
  handleApiError,
  requireIssueAccess,
  requireProjectRole,
  requireWritableUserId,
} from "@/lib/api";
import { assignIssueSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { id } = await context.params;
    const payload = assignIssueSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    await requireProjectRole(userId, issue.projectId, "ADMIN");

    if (payload.assigneeId) {
      await ensureUserBelongsToOrganization(
        payload.assigneeId,
        issue.project.organizationId,
        "Assignee must be a member of the project organization",
      );
    }

    let activityId: string | null = null;

    const updatedIssue = await prisma.$transaction(async (tx) => {
      const changedIssue = await tx.issue.update({
        where: { id },
        data: { assigneeId: payload.assigneeId },
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
          reporter: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (issue.assigneeId !== payload.assigneeId) {
        const activity = await tx.activityLog.create({
          data: {
            action: "ISSUE_ASSIGNED",
            actorId: userId,
            projectId: issue.projectId,
            issueId: issue.id,
            metadata: buildAssignmentMetadata({
              issueTitle: issue.title,
              previousAssigneeId: issue.assigneeId,
              assigneeId: payload.assigneeId,
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

    await emitProjectEvent(issue.projectId, "issue.assigned", {
      issueId: issue.id,
      projectId: issue.projectId,
      assigneeId: updatedIssue.assigneeId,
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
