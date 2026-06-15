import { IssuePriority, IssueStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handleApiError,
  requireProjectAccess,
  requireUserId,
} from "@/lib/api";
import { createIssueSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") as IssueStatus | null;
    const priority = searchParams.get("priority") as IssuePriority | null;

    if (projectId) {
      await requireProjectAccess(userId, projectId);
    }

    const issues = await prisma.issue.findMany({
      where: {
        projectId,
        status: status ?? undefined,
        priority: priority ?? undefined,
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
    const project = await requireProjectAccess(userId, payload.projectId);

    if (payload.assigneeId) {
      const assigneeMembership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: payload.assigneeId,
            organizationId: project.organizationId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new ApiError(400, "Assignee must be a member of the project organization");
      }
    }

    const issue = await prisma.$transaction(async (tx) => {
      const createdIssue = await tx.issue.create({
        data: {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: payload.status,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
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
          metadata: {
            issueTitle: createdIssue.title,
            priority: createdIssue.priority,
            status: createdIssue.status,
          },
        },
      });

      return createdIssue;
    });

    return NextResponse.json({ issue }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
