import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  handleApiError,
  requireOrganizationMembership,
  requireOrganizationRole,
  requireUserId,
  requireWritableUserId,
} from "@/lib/api";
import { updateMembershipRoleSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { orgId } = await context.params;

    await requireOrganizationMembership(userId, orgId);

    const members = await prisma.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireWritableUserId();
    const { orgId } = await context.params;
    const { membershipId, role } = updateMembershipRoleSchema
      .extend({ membershipId: z.string().min(1) })
      .parse(await request.json());

    const actingMembership = await requireOrganizationRole(userId, orgId, "ADMIN");
    const targetMembership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: orgId,
      },
    });

    if (!targetMembership) {
      throw new ApiError(404, "Membership not found");
    }

    if (targetMembership.role === "OWNER") {
      throw new ApiError(403, "Owner membership cannot be edited from this endpoint");
    }

    if (actingMembership.role !== "OWNER" && targetMembership.role === "ADMIN") {
      throw new ApiError(403, "Only owners can change another admin");
    }

    const member = await prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}
