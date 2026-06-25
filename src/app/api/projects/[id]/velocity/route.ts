import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id: projectId } = await context.params;
    const { searchParams } = new URL(request.url);
    const { limit } = querySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
    });

    await requireProjectAccess(userId, projectId);

    const completedSprints = await prisma.sprint.findMany({
      where: {
        projectId,
        status: "COMPLETED",
      },
      select: {
        id: true,
        name: true,
        endDate: true,
        snapshots: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            completed: true,
            totalScope: true,
          },
        },
      },
      orderBy: { endDate: "desc" },
      take: limit,
    });

    const sprints = completedSprints
      .filter((sprint) => sprint.snapshots[0])
      .map((sprint) => ({
        sprintId: sprint.id,
        name: sprint.name,
        completed: sprint.snapshots[0].completed,
        totalScope: sprint.snapshots[0].totalScope,
        endDate: sprint.endDate.toISOString(),
      }))
      .reverse();

    const averageVelocity =
      sprints.length === 0
        ? 0
        : Number(
            (
              sprints.reduce((sum, sprint) => sum + sprint.completed, 0) /
              sprints.length
            ).toFixed(1),
          );

    return NextResponse.json({
      projectId,
      sprints,
      averageVelocity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
