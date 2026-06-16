import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIssueCreatedMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  ensureUserBelongsToOrganization,
  handleApiError,
  requireProjectAccess,
  requireProjectRole,
  requireUserId,
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
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ issues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const payload = createIssueSchema.parse(await request.json());
    const { project } = await requireProjectRole(userId, payload.projectId, "DEVELOPER");

    if (payload.assigneeId) {
      await ensureUserBelongsToOrganization(
        payload.assigneeId,
        project.organizationId,
        "Assignee must be a member of the project organization",
      );
    }

    const issue = await prisma.$transaction(async (tx) => {
      const createdIssue = await tx.issue.create({
        data: {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: payload.status,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
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
        },
      });

      await tx.activityLog.create({
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

      return createdIssue;
    });

    await emitProjectEvent(payload.projectId, "issue:created", {
      issueId: issue.id,
      projectId: payload.projectId,
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
