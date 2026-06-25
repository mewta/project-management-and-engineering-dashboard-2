import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSprintSnapshot } from "@/lib/sprints";
import {
  handleApiError,
  requireSprintAccess,
  requireWritableUserId,
} from "@/lib/api";

type RouteContext = {
  params: Promise<{ sprintId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { sprintId } = await context.params;

    await requireSprintAccess(userId, sprintId);

    const snapshot = await generateSprintSnapshot(prisma, sprintId);

    return NextResponse.json({ snapshot });
  } catch (error) {
    return handleApiError(error);
  }
}
