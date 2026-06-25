import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/api";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function hasPathInDependencyGraph(
  adjacency: Map<string, string[]>,
  startIssueId: string,
  targetIssueId: string,
) {
  const stack = [startIssueId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentIssueId = stack.pop();
    if (!currentIssueId || visited.has(currentIssueId)) {
      continue;
    }

    visited.add(currentIssueId);

    if (currentIssueId === targetIssueId) {
      return true;
    }

    const neighbors = adjacency.get(currentIssueId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

export async function assertIssueDependencyCanBeCreated(
  db: DbClient,
  blockedIssueId: string,
  blockingIssueId: string,
) {
  if (blockedIssueId === blockingIssueId) {
    throw new ApiError(400, "An issue cannot depend on itself");
  }

  const [blockedIssue, blockingIssue, existingDependency] = await Promise.all([
    db.issue.findUnique({
      where: { id: blockedIssueId },
      select: { id: true, projectId: true, title: true },
    }),
    db.issue.findUnique({
      where: { id: blockingIssueId },
      select: { id: true, projectId: true, title: true, status: true },
    }),
    db.issueDependency.findUnique({
      where: {
        blockedIssueId_blockingIssueId: {
          blockedIssueId,
          blockingIssueId,
        },
      },
    }),
  ]);

  if (!blockedIssue || !blockingIssue) {
    throw new ApiError(404, "Issue not found");
  }

  if (blockedIssue.projectId !== blockingIssue.projectId) {
    throw new ApiError(400, "Dependencies must be within the same project");
  }

  if (existingDependency) {
    throw new ApiError(409, "This dependency already exists");
  }

  const createsCycle = await wouldCreateDependencyCycle(db, blockedIssueId, blockingIssueId);
  if (createsCycle) {
    throw new ApiError(400, "Circular dependency detected");
  }

  return { blockedIssue, blockingIssue };
}

export async function wouldCreateDependencyCycle(
  db: DbClient,
  blockedIssueId: string,
  blockingIssueId: string,
) {
  const dependencies = await db.issueDependency.findMany({
    select: {
      blockedIssueId: true,
      blockingIssueId: true,
    },
  });

  const adjacency = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const current = adjacency.get(dependency.blockedIssueId) ?? [];
    current.push(dependency.blockingIssueId);
    adjacency.set(dependency.blockedIssueId, current);
  }

  return hasPathInDependencyGraph(adjacency, blockingIssueId, blockedIssueId);
}

export async function getIssueDependencySummary(db: DbClient, issueId: string) {
  const [blockedByDependencies, blockingDependencies] = await Promise.all([
    db.issueDependency.findMany({
      where: { blockedIssueId: issueId },
      include: {
        blockingIssue: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.issueDependency.findMany({
      where: { blockingIssueId: issueId },
      include: {
        blockedIssue: {
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const unresolvedBlockedBy = blockedByDependencies.filter(
    (dependency) => dependency.blockingIssue.status !== "DONE",
  );

  return {
    blockedBy: blockedByDependencies.map((dependency) => ({
      dependencyId: dependency.id,
      ...dependency.blockingIssue,
    })),
    blocking: blockingDependencies.map((dependency) => ({
      dependencyId: dependency.id,
      ...dependency.blockedIssue,
    })),
    isBlocked: unresolvedBlockedBy.length > 0,
    unresolvedBlockerIds: unresolvedBlockedBy.map((dependency) => dependency.blockingIssueId),
  };
}

export async function getBlockedIssueIds(
  db: DbClient,
  projectId: string,
  issueIds?: string[],
) {
  const dependencies = await db.issueDependency.findMany({
    where: {
      blockedIssue: {
        projectId,
        id: issueIds ? { in: issueIds } : undefined,
      },
      blockingIssue: {
        status: {
          not: "DONE",
        },
      },
    },
    select: { blockedIssueId: true },
    distinct: ["blockedIssueId"],
  });

  return new Set(dependencies.map((dependency) => dependency.blockedIssueId));
}
