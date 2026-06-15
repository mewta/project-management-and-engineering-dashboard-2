import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function requireUserId() {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  return userId;
}

export async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new ApiError(403, "You do not have access to this organization");
  }

  return membership;
}

const roleRank: Record<MembershipRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasMinimumRole(role: MembershipRole, minimumRole: MembershipRole) {
  return roleRank[role] >= roleRank[minimumRole];
}

export async function requireOrganizationRole(
  userId: string,
  organizationId: string,
  minimumRole: MembershipRole,
) {
  const membership = await requireOrganizationMembership(userId, organizationId);

  if (!hasMinimumRole(membership.role, minimumRole)) {
    throw new ApiError(403, `Requires ${minimumRole} access`);
  }

  return membership;
}

export async function requireProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: {
        memberships: {
          some: { userId },
        },
      },
    },
    include: {
      organization: true,
    },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return project;
}

export async function requireIssueAccess(userId: string, issueId: string) {
  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      project: {
        organization: {
          memberships: {
            some: { userId },
          },
        },
      },
    },
    include: {
      project: {
        include: {
          organization: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  return issue;
}

export async function getProjectMembership(userId: string, projectId: string) {
  const project = await requireProjectAccess(userId, projectId);
  const membership = await requireOrganizationMembership(userId, project.organizationId);

  return { project, membership };
}

export async function requireProjectRole(
  userId: string,
  projectId: string,
  minimumRole: MembershipRole,
) {
  const { project, membership } = await getProjectMembership(userId, projectId);

  if (!hasMinimumRole(membership.role, minimumRole)) {
    throw new ApiError(403, `Requires ${minimumRole} access`);
  }

  return { project, membership };
}

export async function ensureUserBelongsToOrganization(
  userId: string,
  organizationId: string,
  message = "User must belong to the organization",
) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new ApiError(400, message);
  }

  return membership;
}
