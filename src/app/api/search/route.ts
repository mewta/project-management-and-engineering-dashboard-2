import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  requireProjectAccess,
  requireUserId,
} from "@/lib/api";
import { commandSearchSchema } from "@/lib/validators";

const resultLimit = 5;

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const filters = commandSearchSchema.parse({
      q: searchParams.get("q") ?? "",
      scope: searchParams.get("scope") ?? "all",
      projectId: searchParams.get("projectId") ?? undefined,
    });

    const project = filters.projectId
      ? await requireProjectAccess(userId, filters.projectId)
      : null;
    const query = filters.q;
    const includeIssues = filters.scope === "all" || filters.scope === "issues";
    const includeProjects = filters.scope === "all" || filters.scope === "projects";
    const includeMembers = filters.scope === "all" || filters.scope === "members";

    const [issues, projects, memberships] = await Promise.all([
      includeIssues
        ? prisma.issue.findMany({
            where: {
              projectId: filters.projectId,
              project: {
                organization: {
                  memberships: {
                    some: { userId },
                  },
                },
              },
              OR: query
                ? [
                    { title: { contains: query, mode: "insensitive" } },
                    {
                      project: {
                        key: { contains: query, mode: "insensitive" },
                      },
                    },
                  ]
                : undefined,
            },
            select: {
              id: true,
              title: true,
              status: true,
              projectId: true,
              project: {
                select: {
                  key: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: resultLimit,
          })
        : Promise.resolve([]),
      includeProjects
        ? prisma.project.findMany({
            where: {
              id: filters.projectId,
              organization: {
                memberships: {
                  some: { userId },
                },
              },
              OR: query
                ? [
                    { name: { contains: query, mode: "insensitive" } },
                    { key: { contains: query, mode: "insensitive" } },
                  ]
                : undefined,
            },
            select: {
              id: true,
              name: true,
              organizationId: true,
            },
            orderBy: { updatedAt: "desc" },
            take: resultLimit,
          })
        : Promise.resolve([]),
      includeMembers
        ? prisma.membership.findMany({
            where: {
              organizationId: project?.organizationId,
              organization: project
                ? undefined
                : {
                    memberships: {
                      some: { userId },
                    },
                  },
              user: query
                ? {
                    OR: [
                      { name: { contains: query, mode: "insensitive" } },
                      { email: { contains: query, mode: "insensitive" } },
                    ],
                  }
                : undefined,
            },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            distinct: ["userId"],
            orderBy: { updatedAt: "desc" },
            take: resultLimit,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      issues: issues.map((issue) => ({
        id: issue.id,
        key: issue.project.key,
        title: issue.title,
        status: issue.status,
        projectId: issue.projectId,
      })),
      projects: projects.map((item) => ({
        id: item.id,
        name: item.name,
        orgId: item.organizationId,
      })),
      members: memberships.map(({ user }) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.image,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
