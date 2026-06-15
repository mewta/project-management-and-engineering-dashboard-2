import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  requireOrganizationMembership,
  requireOrganizationRole,
  requireUserId,
} from "@/lib/api";
import { createProjectSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;

    if (organizationId) {
      await requireOrganizationMembership(userId, organizationId);
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId,
        organization: {
          memberships: {
            some: { userId },
          },
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            issues: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const payload = createProjectSchema.parse(await request.json());

    await requireOrganizationRole(userId, payload.organizationId, "ADMIN");

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: payload.name,
          key: payload.key,
          description: payload.description,
          organizationId: payload.organizationId,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "PROJECT_CREATED",
          actorId: userId,
          projectId: createdProject.id,
          metadata: {
            projectName: createdProject.name,
            projectKey: createdProject.key,
          },
        },
      });

      return createdProject;
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
