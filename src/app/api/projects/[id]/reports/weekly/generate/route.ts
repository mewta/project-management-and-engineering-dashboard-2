import { NextResponse } from "next/server";
import { enqueueWeeklyReport } from "@/lib/queue";
import { handleApiError, requireProjectRole, requireUserId } from "@/lib/api";
import { generateWeeklyReportSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const payload = generateWeeklyReportSchema.parse(await request.json().catch(() => ({})));
    const { project } = await requireProjectRole(userId, id, "ADMIN");

    const job = await enqueueWeeklyReport({
      projectId: id,
      organizationId: project.organizationId,
      triggeredByUserId: userId,
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
