import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildDependencyAddedMetadata,
} from "@/lib/activity";
import { assertIssueDependencyCanBeCreated, getIssueDependencySummary } from "@/lib/dependencies";
import { emitProjectEvent } from "@/lib/realtime";
import {
  handleApiError,
  requireIssueAccess,
  requireProjectRole,
  requireUserId,
} from "@/lib/api";
import { createIssueDependencySchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id: issueId } = await context.params;

    await requireIssueAccess(userId, issueId);
    const summary = await getIssueDependencySummary(prisma, issueId);

    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id: issueId } = await context.params;
    const payload = createIssueDependencySchema.parse(await request.json());
    const issue = await requireIssueAccess(userId, issueId);
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    await requireProjectRole(userId, issue.projectId, "DEVELOPER");

    let activityId: string | null = null;

    const dependency = await prisma.$transaction(async (tx) => {
      const { blockedIssue, blockingIssue } = await assertIssueDependencyCanBeCreated(
        tx,
        issueId,
        payload.blockingIssueId,
      );

      const createdDependency = await tx.issueDependency.create({
        data: {
          blockedIssueId: blockedIssue.id,
          blockingIssueId: blockingIssue.id,
        },
      });

      const activity = await tx.activityLog.create({
        data: {
          action: "ISSUE_DEPENDENCY_ADDED",
          actorId: userId,
          projectId: issue.projectId,
          issueId,
          metadata: buildDependencyAddedMetadata({
            issueTitle: blockedIssue.title,
            blockingIssueId: blockingIssue.id,
            blockingIssueTitle: blockingIssue.title,
          }),
        },
      });
      activityId = activity.id;

      return createdDependency;
    });

    await emitProjectEvent(issue.projectId, "dependency.added", {
      projectId: issue.projectId,
      issueId,
      dependencyId: dependency.id,
      blockingIssueId: payload.blockingIssueId,
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

    return NextResponse.json({ dependency }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
