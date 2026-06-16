import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAssignmentMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ensureUserBelongsToOrganization,
  handleApiError,
  requireIssueAccess,
  requireProjectRole,
  requireUserId,
} from "@/lib/api";
import { assignIssueSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const payload = assignIssueSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);

    await requireProjectRole(userId, issue.projectId, "ADMIN");

    if (payload.assigneeId) {
      await ensureUserBelongsToOrganization(
        payload.assigneeId,
        issue.project.organizationId,
        "Assignee must be a member of the project organization",
      );
    }

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
        await tx.activityLog.create({
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
      }

      return changedIssue;
    });

    await emitProjectEvent(issue.projectId, "issue:updated", {
      issueId: issue.id,
      projectId: issue.projectId,
      assigneeId: updatedIssue.assigneeId,
    });

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    return handleApiError(error);
  }
}
