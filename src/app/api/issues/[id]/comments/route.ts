import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitProjectEvent } from "@/lib/realtime";
import {
  handleApiError,
  requireIssueAccess,
  requireUserId,
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
    const userId = await requireUserId();
    const { id } = await context.params;
    const payload = createCommentSchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, id);

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

      await tx.activityLog.create({
        data: {
          action: "COMMENT_CREATED",
          actorId: userId,
          projectId: issue.projectId,
          issueId: issue.id,
          metadata: {
            issueTitle: issue.title,
            commentId: createdComment.id,
          },
        },
      });

      return createdComment;
    });

    await emitProjectEvent(issue.projectId, "issue:commented", {
      issueId: issue.id,
      projectId: issue.projectId,
      commentId: comment.id,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
