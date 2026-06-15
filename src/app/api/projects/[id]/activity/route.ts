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

    const activity = await prisma.activityLog.findMany({
      where: { projectId: id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ activity });
  } catch (error) {
    return handleApiError(error);
  }
}
