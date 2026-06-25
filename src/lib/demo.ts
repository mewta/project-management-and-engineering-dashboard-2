import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { generateSprintSnapshot, listUtcDates } from "@/lib/sprints";

export const DEMO_ORGANIZATION_ID = "demo-org-devboard";
export const DEMO_USER_ID = "demo-user-alex";
export const DEMO_USER_EMAIL = "demo.visitor@devboard.local";

const demoUsers = [
  {
    id: DEMO_USER_ID,
    name: "Alex Morgan",
    email: DEMO_USER_EMAIL,
    role: "OWNER" as const,
  },
  {
    id: "demo-user-riya",
    name: "Riya Sharma",
    email: "riya@demo.devboard.local",
    role: "ADMIN" as const,
  },
  {
    id: "demo-user-jordan",
    name: "Jordan Lee",
    email: "jordan@demo.devboard.local",
    role: "DEVELOPER" as const,
  },
];

const demoProjects = [
  {
    id: "demo-project-platform",
    name: "Developer Platform",
    key: "PLAT",
    description: "Internal developer tooling, deployment workflows, and service reliability.",
    isPublic: true,
    publicSlug: "devboard-demo-platform",
  },
  {
    id: "demo-project-mobile",
    name: "Mobile Experience",
    key: "MOB",
    description: "Customer-facing mobile application and onboarding improvements.",
    isPublic: false,
    publicSlug: null,
  },
  {
    id: "demo-project-data",
    name: "Analytics Pipeline",
    key: "DATA",
    description: "Event ingestion, reporting, and product analytics infrastructure.",
    isPublic: false,
    publicSlug: null,
  },
];

const issueTemplates = [
  "Add deployment health checks",
  "Improve onboarding checklist",
  "Instrument API latency metrics",
  "Build release approval workflow",
  "Reduce dashboard query time",
  "Document incident response",
  "Add offline synchronization",
  "Create usage analytics export",
  "Improve empty states",
  "Add dependency visualization",
  "Harden authentication sessions",
  "Build weekly progress digest",
];

const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function getDemoSprintDefinitions(projectIndex: number, projectId: string, now: Date) {
  return [
    {
      id: `demo-sprint-${projectIndex + 1}-1`,
      name: "Foundation Sprint",
      status: "COMPLETED" as const,
      startDate: daysAgo(now, 36),
      endDate: daysAgo(now, 27),
      projectId,
    },
    {
      id: `demo-sprint-${projectIndex + 1}-2`,
      name: "Delivery Sprint",
      status: "COMPLETED" as const,
      startDate: daysAgo(now, 24),
      endDate: daysAgo(now, 15),
      projectId,
    },
    {
      id: `demo-sprint-${projectIndex + 1}-3`,
      name: "Current Sprint",
      status: "ACTIVE" as const,
      startDate: daysAgo(now, 10),
      endDate: daysAgo(now, -3),
      projectId,
    },
  ];
}

function getDemoSprintSlot(issueIndex: number) {
  if (issueIndex < 3) {
    return 0;
  }

  if (issueIndex < 6) {
    return 1;
  }

  return 2;
}

export async function resetDemoWorkspace(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("demo-account-no-password-login", 10);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.organization.deleteMany({
      where: { id: DEMO_ORGANIZATION_ID },
    });

    for (const user of demoUsers) {
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          name: user.name,
          email: user.email,
          passwordHash,
          isDemo: true,
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          passwordHash,
          isDemo: true,
        },
      });
    }

    await tx.organization.create({
      data: {
        id: DEMO_ORGANIZATION_ID,
        name: "DevBoard Demo Co",
        slug: "devboard-demo-co",
        memberships: {
          create: demoUsers.map((user) => ({
            userId: user.id,
            role: user.role,
          })),
        },
      },
    });

    for (const project of demoProjects) {
      await tx.project.create({
        data: {
          ...project,
          organizationId: DEMO_ORGANIZATION_ID,
        },
      });
    }

    for (const [projectIndex, project] of demoProjects.entries()) {
      await tx.sprint.createMany({
        data: getDemoSprintDefinitions(projectIndex, project.id, now),
      });
    }

    const issueIds: string[] = [];

    for (const [projectIndex, project] of demoProjects.entries()) {
      for (let index = 0; index < 10; index += 1) {
        const id = `demo-issue-${projectIndex + 1}-${index + 1}`;
        const status = statuses[(index + projectIndex) % statuses.length];
        const priority = priorities[(index * 2 + projectIndex) % priorities.length];
        const assignee = demoUsers[(index + 1) % demoUsers.length];
        const sprintSlot = getDemoSprintSlot(index);
        const sprint = getDemoSprintDefinitions(projectIndex, project.id, now)[sprintSlot];
        const createdAt = daysAgo(now, [39, 27, 13][sprintSlot] - (index % 3));

        issueIds.push(id);
        await tx.issue.create({
          data: {
            id,
            title: issueTemplates[(index + projectIndex * 4) % issueTemplates.length],
            description: `Demo work item for ${project.name}. It includes realistic context, ownership, and delivery expectations.`,
            status,
            priority,
            dueDate:
              index % 4 === 0
                ? daysAgo(now, index % 8 === 0 ? 2 : -7)
                : null,
            estimatedHours: 2 + ((index * 3) % 14),
            labels: [
              ["backend", "frontend", "reliability", "analytics"][index % 4],
              ["planned", "customer", "platform"][index % 3],
            ],
            projectId: project.id,
            sprintId: sprint.id,
            reporterId: DEMO_USER_ID,
            assigneeId: assignee.id,
            createdAt,
            updatedAt: daysAgo(now, Math.max(0, 8 - index)),
          },
        });
      }
    }

    await seedComments(tx, issueIds, now);
    await tx.issueDependency.createMany({
      data: [
        {
          id: "demo-dependency-1",
          blockedIssueId: "demo-issue-1-1",
          blockingIssueId: "demo-issue-1-4",
        },
        {
          id: "demo-dependency-2",
          blockedIssueId: "demo-issue-2-5",
          blockingIssueId: "demo-issue-2-8",
        },
      ],
    });

    await seedActivities(tx, issueIds, now);
    await seedWeeklyReports(tx, now);
  });

  for (const [projectIndex, project] of demoProjects.entries()) {
    for (const sprint of getDemoSprintDefinitions(projectIndex, project.id, now)) {
      const snapshotEnd =
        sprint.status === "ACTIVE" && sprint.endDate > now ? now : sprint.endDate;

      for (const date of listUtcDates(sprint.startDate, snapshotEnd)) {
        await generateSprintSnapshot(prisma, sprint.id, date);
      }
    }
  }

  return {
    organizationId: DEMO_ORGANIZATION_ID,
    userId: DEMO_USER_ID,
  };
}

async function seedComments(tx: Prisma.TransactionClient, issueIds: string[], now: Date) {
  const bodies = [
    "The implementation is ready for review. I added tests for the main edge cases.",
    "This is blocked until the deployment workflow is available.",
    "Product confirmed the acceptance criteria. We can proceed with the smaller scope.",
    "Metrics look stable in staging after the latest changes.",
    "I documented the rollout and rollback steps in the project notes.",
  ];

  for (let index = 0; index < 12; index += 1) {
    await tx.comment.create({
      data: {
        id: `demo-comment-${index + 1}`,
        body: bodies[index % bodies.length],
        issueId: issueIds[(index * 2) % issueIds.length],
        authorId: demoUsers[index % demoUsers.length].id,
        createdAt: daysAgo(now, 10 - (index % 8)),
      },
    });
  }
}

async function seedActivities(
  tx: Prisma.TransactionClient,
  issueIds: string[],
  now: Date,
) {
  for (let index = 0; index < issueIds.length; index += 1) {
    const projectIndex = Math.floor(index / 10);
    const issueIndex = index % 10;
    const project = demoProjects[projectIndex];
    const title = issueTemplates[(issueIndex + projectIndex * 4) % issueTemplates.length];
    const status = statuses[(issueIndex + projectIndex) % statuses.length];
    const sprintSlot = getDemoSprintSlot(issueIndex);
    const sprint = getDemoSprintDefinitions(projectIndex, project.id, now)[sprintSlot];
    const createdDaysAgo = [39, 27, 13][sprintSlot] - (issueIndex % 3);
    const addedDaysAgo = [36, 24, 10][sprintSlot] - (issueIndex % 2);
    const changedDaysAgo = [31, 19, 5][sprintSlot] - (issueIndex % 2);

    await tx.activityLog.create({
      data: {
        id: `demo-activity-created-${index + 1}`,
        action: "ISSUE_CREATED",
        actorId: DEMO_USER_ID,
        projectId: project.id,
        issueId: issueIds[index],
        metadata: {
          issueTitle: title,
          priority: priorities[(index * 2) % priorities.length],
          status: "TODO",
        },
        createdAt: daysAgo(now, createdDaysAgo),
      },
    });

    await tx.activityLog.create({
      data: {
        id: `demo-activity-sprint-add-${index + 1}`,
        action: "ISSUE_ADDED_TO_SPRINT",
        actorId: DEMO_USER_ID,
        projectId: project.id,
        issueId: issueIds[index],
        metadata: {
          issueTitle: title,
          sprintId: sprint.id,
          sprintName: sprint.name,
          statusAtChange: "TODO",
        },
        createdAt: daysAgo(now, addedDaysAgo),
      },
    });

    if (status !== "TODO") {
      await tx.activityLog.create({
        data: {
          id: `demo-activity-status-${index + 1}`,
          action: "ISSUE_STATUS_CHANGED",
          actorId: demoUsers[index % demoUsers.length].id,
          projectId: project.id,
          issueId: issueIds[index],
          metadata: {
            issueTitle: title,
            fromStatus: "TODO",
            toStatus: status,
          },
          createdAt: daysAgo(now, changedDaysAgo),
        },
      });
    }
  }
}

async function seedWeeklyReports(tx: Prisma.TransactionClient, now: Date) {
  for (const project of demoProjects) {
    const weekStart = daysAgo(now, 13);
    const weekEnd = daysAgo(now, 7);

    await tx.weeklyReport.create({
      data: {
        id: `demo-report-${project.id}`,
        projectId: project.id,
        organizationId: DEMO_ORGANIZATION_ID,
        weekStart,
        weekEnd,
        summary: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          totalIssuesCreated: 5,
          totalIssuesCompleted: 3,
          totalIssuesMovedToReview: 2,
          totalCommentsAdded: 4,
          totalOverdueIssues: 1,
          totalBlockedIssues: 1,
          topContributors: demoUsers.map((user, index) => ({
            userId: user.id,
            name: user.name,
            completedIssues: 3 - index,
            commentsAdded: index + 1,
          })),
          priorityBreakdown: { low: 2, medium: 3, high: 3, urgent: 2 },
          statusBreakdown: { todo: 3, inProgress: 3, review: 2, done: 2 },
          workloadSummary: demoUsers.map((user, index) => ({
            userId: user.id,
            name: user.name,
            openIssues: 4 - index,
            completedIssues: index + 1,
            overdueIssues: index === 1 ? 1 : 0,
          })),
        },
      },
    });
  }
}

function daysAgo(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}
