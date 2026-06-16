import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireProjectAccess, requireUserId } from "@/lib/api";
import { issueFilterSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    await requireProjectAccess(userId, id);

    const filters = issueFilterSchema.omit({ projectId: true }).parse({
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assigneeId: searchParams.get("assigneeId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      label: searchParams.get("label") ?? undefined,
    });

    const issues = await prisma.issue.findMany({
      where: {
        projectId: id,
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
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, email: true },
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
