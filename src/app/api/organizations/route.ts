import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireUserId, requireWritableUserId } from "@/lib/api";
import { createOrganizationSchema } from "@/lib/validators";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "org"}-${Date.now().toString(36)}`;
}

export async function GET() {
  try {
    const userId = await requireUserId();

    const organizations = await prisma.organization.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      include: {
        memberships: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: {
            projects: true,
            memberships: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireWritableUserId();
    const payload = createOrganizationSchema.parse(await request.json());

    const organization = await prisma.$transaction(async (tx) => {
      const createdOrganization = await tx.organization.create({
        data: {
          name: payload.name,
          slug: slugify(payload.name),
          memberships: {
            create: {
              userId,
              role: "OWNER",
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          action: "ORGANIZATION_CREATED",
          actorId: userId,
          metadata: {
            organizationId: createdOrganization.id,
            organizationName: createdOrganization.name,
          },
        },
      });

      return createdOrganization;
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
