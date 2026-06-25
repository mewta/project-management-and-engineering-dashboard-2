import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSprintMetadata } from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import { generateSprintSnapshot } from "@/lib/sprints";
import {
  ApiError,
  handleApiError,
  requireProjectRole,
  requireSprintAccess,
  requireWritableUserId,
} from "@/lib/api";
import { updateSprintSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

const allowedTransitions = {
  PLANNED: ["ACTIVE"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: [],
} as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { sprintId } = await context.params;
    const payload = updateSprintSchema.parse(await request.json());
    const sprint = await requireSprintAccess(userId, sprintId);

    await requireProjectRole(userId, sprint.projectId, "ADMIN");

    if (payload.status === sprint.status) {
      return NextResponse.json({ sprint });
    }

    const allowed = allowedTransitions[sprint.status] as readonly string[];
    if (!allowed.includes(payload.status)) {
      throw new ApiError(
        400,
        `Invalid sprint transition from ${sprint.status} to ${payload.status}`,
      );
    }

    if (payload.status === "ACTIVE") {
      const activeSprint = await prisma.sprint.findFirst({
        where: {
          projectId: sprint.projectId,
          status: "ACTIVE",
          id: { not: sprint.id },
        },
        select: { id: true },
      });

      if (activeSprint) {
        throw new ApiError(409, "This project already has an active sprint");
      }
    }

    const updatedSprint = await prisma.$transaction(async (tx) => {
      const updated = await tx.sprint.update({
        where: { id: sprint.id },
        data: { status: payload.status },
      });

      await tx.activityLog.create({
        data: {
          action: "SPRINT_UPDATED",
          actorId: userId,
          projectId: sprint.projectId,
          metadata: buildSprintMetadata({
            sprintId: sprint.id,
            sprintName: sprint.name,
            status: payload.status,
          }),
        },
      });

      if (payload.status === "COMPLETED") {
        await generateSprintSnapshot(tx, sprint.id);
      }

      return updated;
    });

    await emitProjectEvent(sprint.projectId, "sprint.updated", {
      projectId: sprint.projectId,
      sprintId: sprint.id,
      action: "status_changed",
      status: payload.status,
    });

    return NextResponse.json({ sprint: updatedSprint });
  } catch (error) {
    return handleApiError(error);
  }
}
