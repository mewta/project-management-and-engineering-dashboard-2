import { Queue, Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  buildWeeklyReportGeneratedMetadata,
} from "@/lib/activity";
import { emitProjectEvent } from "@/lib/realtime";
import { buildWeeklyReportSummary, getPreviousWeekRange } from "@/lib/reports";

const redisUrl = process.env.REDIS_URL;

const connection = redisUrl
  ? {
      url: redisUrl,
      maxRetriesPerRequest: null,
    }
  : null;

export const weeklyReportQueue = connection
  ? new Queue("weekly-report", { connection })
  : null;

type WeeklyReportJobData = {
  projectId: string;
  organizationId: string;
  triggeredByUserId: string;
  weekStart?: string;
  weekEnd?: string;
};

export async function generateWeeklyReportJob(data: WeeklyReportJobData) {
  const weekStart = data.weekStart ? new Date(data.weekStart) : getPreviousWeekRange().weekStart;
  const weekEnd = data.weekEnd ? new Date(data.weekEnd) : getPreviousWeekRange().weekEnd;

  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });

  if (!project) {
    throw new Error("Project not found for weekly report generation");
  }

  const summary = await buildWeeklyReportSummary(
    prisma,
    data.projectId,
    data.organizationId,
    weekStart,
    weekEnd,
  );

  let activityId: string | null = null;

  const report = await prisma.$transaction(async (tx) => {
    const createdReport = await tx.weeklyReport.upsert({
      where: {
        projectId_weekStart_weekEnd: {
          projectId: data.projectId,
          weekStart,
          weekEnd,
        },
      },
      update: {
        summary,
      },
      create: {
        projectId: data.projectId,
        organizationId: data.organizationId,
        weekStart,
        weekEnd,
        summary,
      },
    });

    const activity = await tx.activityLog.create({
      data: {
        action: "WEEKLY_REPORT_GENERATED",
        actorId: data.triggeredByUserId,
        projectId: data.projectId,
        metadata: buildWeeklyReportGeneratedMetadata({
          projectName: project.name,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
        }),
      },
    });
    activityId = activity.id;

    return createdReport;
  });

  await emitProjectEvent(data.projectId, "report.generated", {
    projectId: data.projectId,
    reportId: report.id,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString(),
  });

  if (activityId) {
    await emitProjectEvent(data.projectId, "activity.created", {
      projectId: data.projectId,
      activityId,
    });
  }

  return report;
}

export async function enqueueWeeklyReport(data: WeeklyReportJobData) {
  if (!weeklyReportQueue) {
    const report = await generateWeeklyReportJob(data);
    return { id: `inline-${report.id}`, reportId: report.id, queued: false };
  }

  const job = await weeklyReportQueue.add("generate", data, {
    removeOnComplete: 50,
    removeOnFail: 50,
  });

  return { id: job.id ?? "queued", queued: true };
}

let workerStarted = false;

export function startWeeklyReportWorker() {
  if (!connection || workerStarted) {
    return null;
  }

  workerStarted = true;

  return new Worker(
    "weekly-report",
    async (job) => {
      await generateWeeklyReportJob(job.data as WeeklyReportJobData);
    },
    { connection },
  );
}

export async function scheduleWeeklyReportJob(data: WeeklyReportJobData) {
  if (!weeklyReportQueue) {
    return null;
  }

  return weeklyReportQueue.upsertJobScheduler(
    `weekly-report:${data.projectId}`,
    {
      pattern: "0 9 * * 1",
      tz: "UTC",
    },
    {
      name: "generate",
      data,
      opts: {
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    },
  );
}
