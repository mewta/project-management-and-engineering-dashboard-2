import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitProjectEvent } from "@/lib/realtime";
import {
  handleApiError,
  requireIssueAccess,
  requireProjectRole,
  requireUserId,
} from "@/lib/api";
import { updateIssueLabelsSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const payload = updateIssueLabelsSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);

    await requireProjectRole(userId, issue.projectId, "DEVELOPER");

    const labels = Array.from(new Set(payload.labels));
    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: { labels },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await emitProjectEvent(issue.projectId, "issue.updated", {
      issueId: issue.id,
      projectId: issue.projectId,
      labels,
      updatedBy: {
        id: userId,
      },
      updatedAt: updatedIssue.updatedAt.toISOString(),
    });

    return NextResponse.json({ issue: updatedIssue });
  } catch (error) {
    return handleApiError(error);
  }
}
