import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;

    await requireProjectAccess(userId, id);

    const reports = await prisma.weeklyReport.findMany({
      where: { projectId: id },
      orderBy: { weekStart: "desc" },
      take: 20,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}
