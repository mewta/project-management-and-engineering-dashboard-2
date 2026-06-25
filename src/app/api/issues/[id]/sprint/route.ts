import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSprintScopeMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ApiError,
  handleApiError,
  requireIssueAccess,
  requireOrganizationRole,
  requireWritableUserId,
} from "@/lib/api";
import { updateIssueSprintSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { id } = await context.params;
    const payload = updateIssueSprintSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);

    await requireOrganizationRole(userId, issue.project.organizationId, "DEVELOPER");

    const currentSprint = issue.sprintId
      ? await prisma.sprint.findUnique({
          where: { id: issue.sprintId },
          select: { id: true, name: true },
        })
      : null;

    const nextSprint = payload.sprintId
      ? await prisma.sprint.findFirst({
          where: {
            id: payload.sprintId,
            projectId: issue.projectId,
            status: { not: "COMPLETED" },
          },
          select: { id: true, name: true },
        })
      : null;

    if (payload.sprintId && !nextSprint) {
      throw new ApiError(400, "Sprint must belong to this project and not be completed");
    }

    if (issue.sprintId === payload.sprintId) {
      return NextResponse.json({ issue });
    }

    const updatedIssue = await prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issue.id },
        data: { sprintId: payload.sprintId },
        include: {
          sprint: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (currentSprint) {
        await tx.activityLog.create({
          data: {
            action: "ISSUE_REMOVED_FROM_SPRINT",
            actorId: userId,
            projectId: issue.projectId,
            issueId: issue.id,
            metadata: buildSprintScopeMetadata({
              issueTitle: issue.title,
              sprintId: currentSprint.id,
              sprintName: currentSprint.name,
              statusAtChange: issue.status,
            }),
          },
        });
      }

      if (nextSprint) {
        await tx.activityLog.create({
          data: {
            action: "ISSUE_ADDED_TO_SPRINT",
            actorId: userId,
            projectId: issue.projectId,
            issueId: issue.id,
            metadata: buildSprintScopeMetadata({
              issueTitle: issue.title,
              sprintId: nextSprint.id,
              sprintName: nextSprint.name,
              statusAtChange: issue.status,
            }),
          },
        });
      }

      return updated;
    });

    await emitProjectEvent(issue.projectId, "sprint.updated", {
      projectId: issue.projectId,
      sprintId: payload.sprintId,
      previousSprintId: issue.sprintId,
      issueId: issue.id,
      action: "scope_changed",
    });

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    return handleApiError(error);
  }
}
