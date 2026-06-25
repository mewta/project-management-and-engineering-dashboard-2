import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSprintMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import {
  handleApiError,
  requireProjectAccess,
  requireProjectRole,
  requireUserId,
  requireWritableUserId,
} from "@/lib/api";
import { createSprintSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;

    await requireProjectAccess(userId, id);

    const sprints = await prisma.sprint.findMany({
      where: { projectId: id },
      include: {
        _count: {
          select: {
            issues: true,
            snapshots: true,
          },
        },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ sprints });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { id } = await context.params;
    const payload = createSprintSchema.parse(await request.json());

    await requireProjectRole(userId, id, "ADMIN");

    const sprint = await prisma.$transaction(async (tx) => {
      const createdSprint = await tx.sprint.create({
        data: {
          projectId: id,
          name: payload.name,
          startDate: new Date(payload.startDate),
          endDate: new Date(payload.endDate),
        },
      });

      await tx.activityLog.create({
        data: {
          action: "SPRINT_CREATED",
          actorId: userId,
          projectId: id,
          metadata: buildSprintMetadata({
            sprintId: createdSprint.id,
            sprintName: createdSprint.name,
            status: createdSprint.status,
          }),
        },
      });

      return createdSprint;
    });

    await emitProjectEvent(id, "sprint.updated", {
      projectId: id,
      sprintId: sprint.id,
      action: "created",
    });

    return NextResponse.json({ sprint }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
