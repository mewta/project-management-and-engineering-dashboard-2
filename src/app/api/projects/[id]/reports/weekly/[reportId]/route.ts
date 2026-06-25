import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";

type RouteContext = {
  params: Promise<{ id: string; reportId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id, reportId } = await context.params;

    await requireProjectAccess(userId, id);

    const report = await prisma.weeklyReport.findFirst({
      where: {
        id: reportId,
        projectId: id,
      },
    });

    if (!report) {
      throw new ApiError(404, "Weekly report not found");
    }

    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
