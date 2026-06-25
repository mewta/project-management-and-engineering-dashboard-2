import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type PublicRoadmapData = {
  project: {
    name: string;
    description: string | null;
  };
  progress: {
    total: number;
    byStatus: {
      todo: number;
      inProgress: number;
      review: number;
      done: number;
    };
  };
  issues: {
    key: string;
    title: string;
    status: string;
    priority: string;
    labels: string[];
    createdAt: string;
  }[];
  lastUpdatedAt: string;
};

export function publicRoadmapCacheTag(slug: string) {
  return `public-roadmap:${slug}`;
}

export async function getPublicRoadmap(slug: string) {
  return unstable_cache(
    async (): Promise<PublicRoadmapData | null> => {
      const project = await prisma.project.findFirst({
        where: {
          publicSlug: slug,
          isPublic: true,
        },
        select: {
          name: true,
          key: true,
          description: true,
          updatedAt: true,
          issues: {
            select: {
              title: true,
              status: true,
              priority: true,
              labels: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!project) {
        return null;
      }

      const byStatus = {
        todo: 0,
        inProgress: 0,
        review: 0,
        done: 0,
      };

      for (const issue of project.issues) {
        if (issue.status === "TODO") byStatus.todo += 1;
        if (issue.status === "IN_PROGRESS") byStatus.inProgress += 1;
        if (issue.status === "IN_REVIEW") byStatus.review += 1;
        if (issue.status === "DONE") byStatus.done += 1;
      }

      const lastUpdatedAt = project.issues.reduce(
        (latest, issue) => (issue.updatedAt > latest ? issue.updatedAt : latest),
        project.updatedAt,
      );

      return {
        project: {
          name: project.name,
          description: project.description,
        },
        progress: {
          total: project.issues.length,
          byStatus,
        },
        issues: project.issues.map((issue, index) => ({
          key: `${project.key}-${index + 1}`,
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          labels: issue.labels,
          createdAt: issue.createdAt.toISOString(),
        })),
        lastUpdatedAt: lastUpdatedAt.toISOString(),
      };
    },
    ["public-roadmap", slug],
    {
      tags: [publicRoadmapCacheTag(slug)],
      revalidate: 60,
    },
  )();
}
