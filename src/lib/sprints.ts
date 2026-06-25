import {
  ActivityAction,
  IssueStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

type SprintDatabase = PrismaClient | Prisma.TransactionClient;

type ReplayActivity = {
  action: ActivityAction;
  issueId: string | null;
  metadata: Prisma.JsonValue | null;
};

type SprintActivityMetadata = {
  sprintId?: string;
  statusAtChange?: IssueStatus;
  toStatus?: IssueStatus;
};

const sprintReplayActions: ActivityAction[] = [
  "ISSUE_ADDED_TO_SPRINT",
  "ISSUE_REMOVED_FROM_SPRINT",
  "ISSUE_STATUS_CHANGED",
];

function readMetadata(metadata: Prisma.JsonValue | null): SprintActivityMetadata {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return {};
  }

  return metadata as SprintActivityMetadata;
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date) {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 86_400_000 - 1);
}

export function replaySprintActivity(sprintId: string, activities: ReplayActivity[]) {
  const issueStatuses = new Map<string, IssueStatus>();

  for (const activity of activities) {
    if (!activity.issueId) {
      continue;
    }

    const metadata = readMetadata(activity.metadata);

    if (activity.action === "ISSUE_ADDED_TO_SPRINT" && metadata.sprintId === sprintId) {
      issueStatuses.set(activity.issueId, metadata.statusAtChange ?? "TODO");
      continue;
    }

    if (activity.action === "ISSUE_REMOVED_FROM_SPRINT" && metadata.sprintId === sprintId) {
      issueStatuses.delete(activity.issueId);
      continue;
    }

    if (
      activity.action === "ISSUE_STATUS_CHANGED" &&
      issueStatuses.has(activity.issueId) &&
      metadata.toStatus
    ) {
      issueStatuses.set(activity.issueId, metadata.toStatus);
    }
  }

  const completed = [...issueStatuses.values()].filter((status) => status === "DONE").length;
  const totalScope = issueStatuses.size;

  return {
    totalScope,
    completed,
    remaining: totalScope - completed,
  };
}

export async function generateSprintSnapshot(
  database: SprintDatabase,
  sprintId: string,
  snapshotDate = new Date(),
) {
  const sprint = await database.sprint.findUnique({
    where: { id: sprintId },
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!sprint) {
    throw new Error("Sprint not found for snapshot generation");
  }

  const date = startOfUtcDay(snapshotDate);
  const activities = await database.activityLog.findMany({
    where: {
      projectId: sprint.projectId,
      action: { in: sprintReplayActions },
      createdAt: { lte: endOfUtcDay(date) },
    },
    select: {
      action: true,
      issueId: true,
      metadata: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const counts = replaySprintActivity(sprintId, activities);

  return database.sprintSnapshot.upsert({
    where: {
      sprintId_date: {
        sprintId,
        date,
      },
    },
    update: counts,
    create: {
      sprintId,
      date,
      ...counts,
    },
  });
}

export function listUtcDates(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    dates.push(cursor);
  }

  return dates;
}
