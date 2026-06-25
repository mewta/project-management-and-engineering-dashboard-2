import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireSprintAccess, requireUserId } from "@/lib/api";
import { listUtcDates } from "@/lib/sprints";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { sprintId } = await context.params;
    const sprint = await requireSprintAccess(userId, sprintId);
    const snapshots = await prisma.sprintSnapshot.findMany({
      where: { sprintId },
      orderBy: { date: "asc" },
    });

    const dates = listUtcDates(sprint.startDate, sprint.endDate);
    const startingScope = snapshots[0]?.totalScope ?? 0;
    const denominator = Math.max(dates.length - 1, 1);
    const idealLine =
      startingScope === 0
        ? dates.map((date) => ({
            date: date.toISOString(),
            remaining: 0,
          }))
        : dates.map((date, index) => ({
            date: date.toISOString(),
            remaining: Number(
              Math.max(0, startingScope * (1 - index / denominator)).toFixed(2),
            ),
          }));

    return NextResponse.json({
      sprintId,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      idealLine,
      actualLine: snapshots.map((snapshot) => ({
        date: snapshot.date.toISOString(),
        remaining: snapshot.remaining,
        totalScope: snapshot.totalScope,
        completed: snapshot.completed,
      })),
      isComplete: sprint.status === "COMPLETED",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
