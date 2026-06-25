import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIssueCreatedMetadata } from "@/lib/activity";
import { getBlockedIssueIds } from "@/lib/dependencies";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ensureUserBelongsToOrganization,
  handleApiError,
  requireProjectAccess,
  requireProjectRole,
  requireUserId,
  requireWritableUserId,
} from "@/lib/api";
import { createIssueSchema, issueFilterSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const filters = issueFilterSchema.parse({
      projectId: searchParams.get("projectId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assigneeId: searchParams.get("assigneeId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      label: searchParams.get("label") ?? undefined,
    });

    if (filters.projectId) {
      await requireProjectAccess(userId, filters.projectId);
    }

    const issues = await prisma.issue.findMany({
      where: {
        projectId: filters.projectId,
        status: filters.status,
        priority: filters.priority,
        assigneeId: filters.assigneeId,
        labels: filters.label ? { has: filters.label } : undefined,
        OR: filters.q
          ? [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
            ]
          : undefined,
        project: {
          organization: {
            memberships: {
              some: { userId },
            },
          },
        },
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const blockedIssueIds =
      filters.projectId && issues.length > 0
        ? await getBlockedIssueIds(prisma, filters.projectId, issues.map((issue) => issue.id))
        : new Set<string>();

    const filteredIssues = filters.blocked
      ? issues.filter((issue) => blockedIssueIds.has(issue.id))
      : issues;

    return NextResponse.json({
      issues: filteredIssues.map((issue) => ({
        ...issue,
        isBlocked: blockedIssueIds.has(issue.id),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireWritableUserId();
    const payload = createIssueSchema.parse(await request.json());
    const { project } = await requireProjectRole(userId, payload.projectId, "DEVELOPER");
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (payload.assigneeId) {
      await ensureUserBelongsToOrganization(
        payload.assigneeId,
        project.organizationId,
        "Assignee must be a member of the project organization",
      );
    }

    let activityId: string | null = null;

    const issue = await prisma.$transaction(async (tx) => {
      const createdIssue = await tx.issue.create({
        data: {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: payload.status,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
          estimatedHours: payload.estimatedHours ?? 0,
          labels: payload.labels ?? [],
          projectId: payload.projectId,
          assigneeId: payload.assigneeId,
          reporterId: userId,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sprint: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      const activity = await tx.activityLog.create({
        data: {
          action: "ISSUE_CREATED",
          actorId: userId,
          projectId: payload.projectId,
          issueId: createdIssue.id,
          metadata: buildIssueCreatedMetadata({
            issueTitle: createdIssue.title,
            priority: createdIssue.priority,
            status: createdIssue.status,
          }),
        },
      });
      activityId = activity.id;

      return createdIssue;
    });

    await emitProjectEvent(payload.projectId, "issue.created", {
      issueId: issue.id,
      projectId: payload.projectId,
      issue,
      updatedBy: {
        id: actor?.id ?? userId,
        name: actor?.name ?? "Unknown user",
      },
    });

    if (activityId) {
      await emitProjectEvent(payload.projectId, "activity.created", {
        projectId: payload.projectId,
        activityId,
        issueId: issue.id,
        updatedBy: {
          id: actor?.id ?? userId,
          name: actor?.name ?? "Unknown user",
        },
      });
    }

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
