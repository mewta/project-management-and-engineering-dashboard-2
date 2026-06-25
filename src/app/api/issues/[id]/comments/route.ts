import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCommentCreatedMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  handleApiError,
  requireIssueAccess,
  requireOrganizationRole,
  requireUserId,
  requireWritableUserId,
} from "@/lib/api";
import { createCommentSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;

    await requireIssueAccess(userId, id);

    const comments = await prisma.comment.findMany({
      where: { issueId: id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { id } = await context.params;
    const payload = createCommentSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);
    await requireOrganizationRole(userId, issue.project.organizationId, "DEVELOPER");
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    let activityId: string | null = null;

    const comment = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.comment.create({
        data: {
          body: payload.body,
          issueId: id,
          authorId: userId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const activity = await tx.activityLog.create({
        data: {
          action: "COMMENT_CREATED",
          actorId: userId,
          projectId: issue.projectId,
          issueId: issue.id,
          metadata: buildCommentCreatedMetadata({
            issueTitle: issue.title,
            commentId: createdComment.id,
          }),
        },
      });
      activityId = activity.id;

      return createdComment;
    });

    await emitProjectEvent(issue.projectId, "comment.created", {
      issueId: issue.id,
      projectId: issue.projectId,
      comment: {
        id: comment.id,
        content: comment.body,
        author: {
          id: actor?.id ?? comment.author.id,
          name: actor?.name ?? comment.author.name,
        },
        createdAt: comment.createdAt.toISOString(),
      },
    });

    if (activityId) {
      await emitProjectEvent(issue.projectId, "activity.created", {
        projectId: issue.projectId,
        activityId,
        issueId: issue.id,
      });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
