import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
