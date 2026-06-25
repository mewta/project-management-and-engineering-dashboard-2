import crypto from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  requireProjectRole,
  requireWritableUserId,
} from "@/lib/api";
import { publicRoadmapCacheTag } from "@/lib/public-roadmap";
import { updateProjectPublicLinkSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { id } = await context.params;
    const payload = updateProjectPublicLinkSchema.parse(await request.json());
    const { project } = await requireProjectRole(userId, id, "ADMIN");
    const publicSlug =
      project.publicSlug ??
      `${slugify(project.name)}-${crypto.randomBytes(6).toString("base64url").toLowerCase()}`;

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        isPublic: payload.enabled,
        publicSlug,
      },
      select: {
        id: true,
        isPublic: true,
        publicSlug: true,
      },
    });

    revalidateTag(publicRoadmapCacheTag(publicSlug), { expire: 0 });

    const origin = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

    return NextResponse.json({
      project: updatedProject,
      publicUrl: `${origin}/p/${publicSlug}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "roadmap"
  );
}
